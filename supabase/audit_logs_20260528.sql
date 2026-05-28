-- CEPLOG Supabase audit log altyapisi
-- Bu dosyayi Supabase SQL Editor'da manuel calistirin.
-- Veri silmez, tablo drop etmez.

create extension if not exists pgcrypto;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null default 'UPDATE',
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

alter table public.audit_logs
  add column if not exists workspace_id text,
  add column if not exists event_type text,
  add column if not exists reason text,
  add column if not exists source text not null default 'app',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists request_key text;

alter table public.audit_logs drop constraint if exists audit_logs_action_check;
alter table public.audit_logs
  add constraint audit_logs_action_check
  check (action in ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'CANCEL'));

create index if not exists audit_logs_workspace_changed_idx
on public.audit_logs(workspace_id, changed_at desc);

create index if not exists audit_logs_table_record_idx
on public.audit_logs(table_name, record_id);

create index if not exists audit_logs_event_type_idx
on public.audit_logs(event_type);

create index if not exists audit_logs_request_key_idx
on public.audit_logs(request_key)
where request_key is not null;

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_owner_manager_select" on public.audit_logs;
create policy "audit_logs_owner_manager_select"
on public.audit_logs for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('owner', 'manager')
      and (
        public.audit_logs.workspace_id is null
        or public.audit_logs.workspace_id = p.workspace_id
      )
  )
);

create or replace function public.create_audit_log(
  p_workspace_id text default null,
  p_table_name text default '',
  p_record_id text default null,
  p_action text default 'UPDATE',
  p_event_type text default null,
  p_reason text default null,
  p_old_data jsonb default null,
  p_new_data jsonb default null,
  p_metadata jsonb default '{}'::jsonb,
  p_request_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_workspace_id text;
  clean_action text;
  clean_record_id uuid;
  inserted_id uuid;
begin
  clean_workspace_id := coalesce(
    nullif(p_workspace_id, ''),
    (
      select nullif(profile.workspace_id, '')
      from public.profiles profile
      where profile.id = auth.uid()
      limit 1
    ),
    'main'
  );

  clean_action := upper(coalesce(nullif(p_action, ''), 'UPDATE'));
  if clean_action not in ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE', 'CANCEL') then
    clean_action := 'UPDATE';
  end if;

  if coalesce(p_record_id, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    clean_record_id := p_record_id::uuid;
  else
    clean_record_id := null;
  end if;

  insert into public.audit_logs (
    workspace_id,
    table_name,
    record_id,
    action,
    event_type,
    reason,
    old_data,
    new_data,
    metadata,
    request_key,
    source,
    changed_by
  )
  values (
    clean_workspace_id,
    coalesce(nullif(p_table_name, ''), 'unknown'),
    clean_record_id,
    clean_action,
    nullif(p_event_type, ''),
    nullif(p_reason, ''),
    p_old_data,
    p_new_data,
    coalesce(p_metadata, '{}'::jsonb),
    nullif(p_request_key, ''),
    'app',
    auth.uid()
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

grant execute on function public.create_audit_log(text, text, text, text, text, text, jsonb, jsonb, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
