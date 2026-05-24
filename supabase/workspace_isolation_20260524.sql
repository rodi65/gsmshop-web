-- CEPLOG workspace izolasyonu
-- Bu dosyayi Supabase SQL Editor'da manuel calistirin.
-- Mevcut veriyi silmez, tablo drop etmez, null workspace kayitlarini main alanina baglar.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'staff',
  workspace_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text not null default 'staff';
alter table public.profiles add column if not exists workspace_id text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

update public.profiles
set workspace_id = 'main', role = coalesce(role, 'owner'), updated_at = now()
where lower(email) = 'ahmetsenltd@gmail.com'
  and workspace_id is null;

create index if not exists idx_profiles_workspace_id on public.profiles(workspace_id);

do $$
declare
  current_table text;
  tables text[] := array[
    'stock_items',
    'sales',
    'expenses',
    'cash_movements',
    'bank_movements',
    'contacts',
    'suppliers',
    'cash_closings',
    'audit_logs',
    'accessory_shortcuts'
  ];
begin
  foreach current_table in array tables loop
    if to_regclass(format('public.%I', current_table)) is not null then
      execute format('alter table public.%I add column if not exists workspace_id text', current_table);
      execute format('update public.%I set workspace_id = %L where workspace_id is null', current_table, 'main');
      execute format('create index if not exists %I on public.%I(workspace_id)', 'idx_' || current_table || '_workspace_id', current_table);
    end if;
  end loop;
end $$;

create or replace function public.clone_workspace(source_workspace text, target_workspace text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_table text;
  table_list text[] := array[
    'stock_items',
    'contacts',
    'sales',
    'expenses',
    'bank_movements',
    'cash_movements',
    'suppliers',
    'cash_closings',
    'audit_logs',
    'accessory_shortcuts'
  ];
  insert_columns text;
  select_columns text;
  id_type text;
  has_status boolean;
  status_filter text;
begin
  if nullif(source_workspace, '') is null then
    raise exception 'source_workspace bos olamaz';
  end if;

  if nullif(target_workspace, '') is null then
    raise exception 'target_workspace bos olamaz';
  end if;

  if source_workspace = target_workspace then
    raise exception 'source_workspace ve target_workspace ayni olamaz';
  end if;

  create temporary table if not exists workspace_clone_id_map (
    table_name text not null,
    old_id text not null,
    new_id text not null
  ) on commit drop;

  truncate table workspace_clone_id_map;

  foreach current_table in array table_list loop
    if to_regclass(format('public.%I', current_table)) is null then
      continue;
    end if;

    if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = current_table
        and column_name = 'workspace_id'
    ) then
      continue;
    end if;

    select data_type
    into id_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = current_table
      and column_name = 'id';

    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = current_table
        and column_name = 'status'
    )
    into has_status;

    status_filter := case
      when has_status then ' and coalesce(status, ''active'') <> ''deleted'''
      else ''
    end;

    if id_type = 'uuid' then
      execute format(
        'insert into workspace_clone_id_map(table_name, old_id, new_id)
         select %L, id::text, gen_random_uuid()::text
         from public.%I
         where workspace_id = $1%s',
        current_table,
        current_table,
        status_filter
      )
      using source_workspace;

      select
        string_agg(format('%I', column_name), ', ' order by ordinal_position),
        string_agg(
          case
            when column_name = 'id' then 'm.new_id::uuid'
            when column_name = 'workspace_id' then '$2'
            else format('s.%I', column_name)
          end,
          ', ' order by ordinal_position
        )
      into insert_columns, select_columns
      from information_schema.columns
      where table_schema = 'public'
        and table_name = current_table
        and is_generated = 'NEVER'
        and identity_generation is null;

      execute format(
        'insert into public.%I (%s)
         select %s
         from public.%I s
         join workspace_clone_id_map m
           on m.table_name = %L
          and m.old_id = s.id::text
         where s.workspace_id = $1%s',
        current_table,
        insert_columns,
        select_columns,
        current_table,
        current_table,
        status_filter
      )
      using source_workspace, target_workspace;
    else
      select
        string_agg(format('%I', column_name), ', ' order by ordinal_position),
        string_agg(
          case
            when column_name = 'workspace_id' then '$2'
            else format('%I', column_name)
          end,
          ', ' order by ordinal_position
        )
      into insert_columns, select_columns
      from information_schema.columns
      where table_schema = 'public'
        and table_name = current_table
        and column_name not in ('id')
        and is_generated = 'NEVER'
        and identity_generation is null;

      execute format(
        'insert into public.%I (%s)
         select %s
         from public.%I
         where workspace_id = $1%s',
        current_table,
        insert_columns,
        select_columns,
        current_table,
        status_filter
      )
      using source_workspace, target_workspace;
    end if;
  end loop;

  if to_regclass('public.cash_movements') is not null then
    update public.cash_movements cm
    set related_id = m.new_id
    from workspace_clone_id_map m
    where cm.workspace_id = target_workspace
      and cm.related_table = m.table_name
      and cm.related_id = m.old_id;
  end if;

  if to_regclass('public.sales') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'sales' and column_name = 'stock_item_id'
     ) then
    update public.sales s
    set stock_item_id = m.new_id::uuid
    from workspace_clone_id_map m
    where s.workspace_id = target_workspace
      and m.table_name = 'stock_items'
      and s.stock_item_id::text = m.old_id;
  end if;

  if to_regclass('public.bank_movements') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'bank_movements' and column_name = 'related_sale_id'
     ) then
    update public.bank_movements b
    set related_sale_id = m.new_id::uuid
    from workspace_clone_id_map m
    where b.workspace_id = target_workspace
      and m.table_name = 'sales'
      and b.related_sale_id::text = m.old_id;
  end if;
end;
$$;

-- Ana hesap icin:
-- update public.profiles set workspace_id = 'main' where email = 'ahmetsenltd@gmail.com';

-- Test kullanicilari acildiktan sonra:
-- update public.profiles set workspace_id = 'test_1' where email = 'test1@ceplog.com';
-- update public.profiles set workspace_id = 'test_2' where email = 'test2@ceplog.com';
-- update public.profiles set workspace_id = 'test_3' where email = 'test3@ceplog.com';

-- Ahmet ana verilerini test alanlarina kopyalamak icin:
-- select public.clone_workspace('main', 'test_1');
-- select public.clone_workspace('main', 'test_2');
-- select public.clone_workspace('main', 'test_3');
