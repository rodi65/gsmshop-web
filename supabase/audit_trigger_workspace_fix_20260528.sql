-- CEPLOG audit trigger workspace/event_type duzeltmesi
-- Bu dosyayi Supabase SQL Editor'da manuel calistirin.
-- Veri silmez, tablo drop etmez.

alter table public.audit_logs
  add column if not exists workspace_id text,
  add column if not exists event_type text,
  add column if not exists reason text,
  add column if not exists source text not null default 'trigger',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists request_key text,
  add column if not exists note text,
  add column if not exists created_by uuid references auth.users(id);

update public.audit_logs
set workspace_id = coalesce(
  nullif(new_data->>'workspace_id', ''),
  nullif(old_data->>'workspace_id', ''),
  workspace_id,
  'main'
)
where workspace_id is null;

update public.audit_logs
set event_type = lower(table_name || '_' || action)
where event_type is null;

update public.audit_logs
set reason = note
where reason is null
  and note is not null;

alter table public.audit_logs drop constraint if exists audit_logs_action_check;
update public.audit_logs
set action = upper(action)
where action is not null;

alter table public.audit_logs
  add constraint audit_logs_action_check
  check (upper(action) in ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'CANCEL'));

create index if not exists audit_logs_workspace_changed_idx
on public.audit_logs(workspace_id, changed_at desc);

create index if not exists audit_logs_event_type_idx
on public.audit_logs(event_type);

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_json jsonb;
  old_json jsonb;
  row_id_text text;
  row_id uuid;
  row_workspace_id text;
  row_action text;
begin
  if tg_op = 'DELETE' then
    row_json := null;
    old_json := to_jsonb(old);
    row_id_text := old_json->>'id';
    row_workspace_id := nullif(old_json->>'workspace_id', '');
  else
    row_json := to_jsonb(new);
    old_json := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
    row_id_text := row_json->>'id';
    row_workspace_id := nullif(row_json->>'workspace_id', '');
  end if;

  if coalesce(row_id_text, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    row_id := row_id_text::uuid;
  else
    row_id := null;
  end if;

  row_workspace_id := coalesce(
    row_workspace_id,
    (
      select nullif(profile.workspace_id, '')
      from public.profiles profile
      where profile.id = auth.uid()
      limit 1
    ),
    'main'
  );

  if tg_op = 'INSERT' then
    row_action := 'INSERT';
  elsif tg_op = 'UPDATE' then
    row_action := case
      when coalesce(old_json->>'status', '') <> 'deleted' and coalesce(row_json->>'status', '') = 'deleted' then 'SOFT_DELETE'
      when coalesce(old_json->>'status', '') <> 'cancelled' and coalesce(row_json->>'status', '') = 'cancelled' then 'CANCEL'
      else 'UPDATE'
    end;
  else
    row_action := 'DELETE';
  end if;

  insert into public.audit_logs (
    workspace_id,
    table_name,
    record_id,
    action,
    event_type,
    old_data,
    new_data,
    source,
    metadata,
    changed_by,
    created_by
  )
  values (
    row_workspace_id,
    tg_table_name,
    row_id,
    row_action,
    lower(tg_table_name || '_' || row_action),
    old_json,
    row_json,
    'trigger',
    jsonb_build_object('trigger_op', tg_op),
    auth.uid(),
    auth.uid()
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
