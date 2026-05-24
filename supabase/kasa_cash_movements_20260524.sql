-- GSMSHOP kasa nakit hareketleri duzeltmesi
-- Bu migration idempotenttir; mevcut tablo/constraint varsa guvenli sekilde gunceller.

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('customer','supplier','seller')),
  name text not null,
  phone text,
  balance numeric(14,2) not null default 0,
  balance_type text not null default 'receivable' check (balance_type in ('receivable','payable')),
  note text,
  status text not null default 'active' check (status in ('active','passive','deleted')),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_kind_name_idx on public.contacts(kind, name);

alter table public.contacts add column if not exists status text;
alter table public.contacts alter column status set default 'active';
update public.contacts set status = 'active' where status is null;
alter table public.contacts drop constraint if exists contacts_status_check;
alter table public.contacts
add constraint contacts_status_check
check (status in ('active','passive','deleted'));

alter table public.contacts enable row level security;

drop policy if exists "contacts_authenticated_all" on public.contacts;
create policy "contacts_authenticated_all"
on public.contacts for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  movement_type text not null,
  direction text not null check (direction in ('in','out')),
  amount numeric(14,2) not null default 0,
  note text,
  related_table text,
  related_id text,
  status text not null default 'active' check (status in ('active','cancelled','deleted')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.cash_movements add column if not exists related_table text;
alter table public.cash_movements add column if not exists related_id text;
alter table public.cash_movements alter column related_id type text using related_id::text;

alter table public.cash_movements
drop constraint if exists cash_movements_movement_type_check;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.cash_movements'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%movement_type%'
  loop
    execute format('alter table public.cash_movements drop constraint if exists %I', constraint_name);
  end loop;
end $$;

alter table public.cash_movements
add constraint cash_movements_movement_type_check
check (movement_type in (
  'Devir Nakit',
  'Cari Ödeme',
  'Manuel Nakit Girişi',
  'Stok Ödemesi',
  'Gider',
  'Satış Nakit',
  'Bankadan Nakit Gelen',
  'Gelen Alacak',
  'Alacak Ödemesi',
  'Bankaya Yatırılan Nakit',
  'Düzeltme'
));

create index if not exists cash_movements_created_at_idx on public.cash_movements(created_at);
create index if not exists cash_movements_related_idx on public.cash_movements(related_table, related_id);

alter table public.cash_movements add column if not exists status text;
alter table public.cash_movements alter column status set default 'active';
update public.cash_movements set status = 'active' where status is null;
alter table public.cash_movements drop constraint if exists cash_movements_status_check;
alter table public.cash_movements
add constraint cash_movements_status_check
check (status in ('active','cancelled','deleted'));

alter table public.cash_movements enable row level security;

drop policy if exists "cash_movements_authenticated_all" on public.cash_movements;
create policy "cash_movements_authenticated_all"
on public.cash_movements for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');
