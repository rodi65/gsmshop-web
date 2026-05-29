-- CEPLOG V28 CARI + KASA + STOK KALICILIK DUZELTMESI
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
alter table public.contacts enable row level security;
drop policy if exists "contacts_authenticated_all" on public.contacts;
create policy "contacts_authenticated_all"
on public.contacts for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  movement_type text not null check (movement_type in ('Satış Nakit','Stok Ödemesi','Gider','Bankadan Nakit Gelen','Düzeltme')),
  direction text not null check (direction in ('in','out')),
  amount numeric(14,2) not null default 0,
  note text,
  related_table text,
  related_id uuid,
  status text not null default 'active' check (status in ('active','cancelled','deleted')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists cash_movements_created_at_idx on public.cash_movements(created_at);
alter table public.cash_movements enable row level security;
drop policy if exists "cash_movements_authenticated_all" on public.cash_movements;
create policy "cash_movements_authenticated_all"
on public.cash_movements for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

alter table public.stock_items add column if not exists acquisition_type text;
alter table public.stock_items add column if not exists supplier_paid numeric(14,2) not null default 0;
alter table public.stock_items add column if not exists seller_cari_remaining numeric(14,2) not null default 0;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'audit_trigger') then
    drop trigger if exists contacts_audit on public.contacts;
    create trigger contacts_audit after insert or update or delete on public.contacts
    for each row execute function public.audit_trigger();

    drop trigger if exists cash_movements_audit on public.cash_movements;
    create trigger cash_movements_audit after insert or update or delete on public.cash_movements
    for each row execute function public.audit_trigger();
  end if;
end $$;
