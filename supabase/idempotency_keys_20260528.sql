-- CEPLOG critical operation idempotency guard.
-- Run this in Supabase SQL Editor before relying on the frontend guard.

create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  operation_key text not null,
  operation_type text not null,
  target_table text,
  target_id text,
  request_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  status text not null default 'started',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint idempotency_keys_status_check check (status in ('started', 'completed', 'failed'))
);

create unique index if not exists idempotency_keys_workspace_operation_key_uidx
  on public.idempotency_keys(workspace_id, operation_key);

create index if not exists idempotency_keys_target_idx
  on public.idempotency_keys(workspace_id, target_table, target_id);

alter table public.idempotency_keys enable row level security;

drop policy if exists idempotency_keys_select_own_workspace on public.idempotency_keys;
create policy idempotency_keys_select_own_workspace on public.idempotency_keys
  for select
  using (
    workspace_id = coalesce(
      nullif((select workspace_id from public.profiles where id = auth.uid()), ''),
      auth.uid()::text
    )
    or exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and email = 'ahmetsenltd@gmail.com'
    )
  );

create or replace function public.try_begin_idempotency_key(
  p_workspace_id text,
  p_operation_key text,
  p_operation_type text,
  p_target_table text default null,
  p_target_id text default null,
  p_request_payload jsonb default '{}'::jsonb
)
returns table (
  allowed boolean,
  existing_status text,
  existing_result jsonb,
  key_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_workspace_id text;
  existing_row public.idempotency_keys%rowtype;
begin
  clean_workspace_id := nullif(trim(coalesce(p_workspace_id, '')), '');

  if clean_workspace_id is null then
    select coalesce(nullif(workspace_id, ''), auth.uid()::text)
      into clean_workspace_id
    from public.profiles
    where id = auth.uid();
  end if;

  clean_workspace_id := coalesce(clean_workspace_id, auth.uid()::text, 'main');

  if nullif(trim(coalesce(p_operation_key, '')), '') is null then
    raise exception 'operation_key is required';
  end if;

  select *
    into existing_row
  from public.idempotency_keys
  where workspace_id = clean_workspace_id
    and operation_key = p_operation_key
  limit 1;

  if found then
    if existing_row.status = 'failed' then
      update public.idempotency_keys
      set
        status = 'started',
        operation_type = coalesce(nullif(p_operation_type, ''), existing_row.operation_type),
        target_table = coalesce(p_target_table, existing_row.target_table),
        target_id = coalesce(p_target_id, existing_row.target_id),
        request_payload = coalesce(p_request_payload, '{}'::jsonb),
        result_payload = '{}'::jsonb,
        created_by = auth.uid(),
        created_at = now(),
        completed_at = null
      where id = existing_row.id
      returning * into existing_row;

      return query select true, existing_row.status, existing_row.result_payload, existing_row.id;
      return;
    end if;

    return query select false, existing_row.status, existing_row.result_payload, existing_row.id;
    return;
  end if;

  insert into public.idempotency_keys (
    workspace_id,
    operation_key,
    operation_type,
    target_table,
    target_id,
    request_payload,
    status,
    created_by
  )
  values (
    clean_workspace_id,
    p_operation_key,
    coalesce(nullif(p_operation_type, ''), 'unknown'),
    p_target_table,
    p_target_id,
    coalesce(p_request_payload, '{}'::jsonb),
    'started',
    auth.uid()
  )
  returning * into existing_row;

  return query select true, existing_row.status, existing_row.result_payload, existing_row.id;
end;
$$;

create or replace function public.complete_idempotency_key(
  p_workspace_id text,
  p_operation_key text,
  p_status text default 'completed',
  p_result_payload jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_workspace_id text;
  clean_status text;
begin
  clean_workspace_id := nullif(trim(coalesce(p_workspace_id, '')), '');

  if clean_workspace_id is null then
    select coalesce(nullif(workspace_id, ''), auth.uid()::text)
      into clean_workspace_id
    from public.profiles
    where id = auth.uid();
  end if;

  clean_workspace_id := coalesce(clean_workspace_id, auth.uid()::text, 'main');
  clean_status := coalesce(nullif(p_status, ''), 'completed');

  if clean_status not in ('completed', 'failed') then
    raise exception 'invalid idempotency status: %', clean_status;
  end if;

  update public.idempotency_keys
  set
    status = clean_status,
    result_payload = coalesce(p_result_payload, '{}'::jsonb),
    completed_at = now()
  where workspace_id = clean_workspace_id
    and operation_key = p_operation_key;

  return found;
end;
$$;

grant execute on function public.try_begin_idempotency_key(text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.complete_idempotency_key(text, text, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
