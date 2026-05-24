-- GSMSHOP V23 SUPABASE BACKEND SCHEMA
-- Bu dosyayı Supabase SQL Editor içinde tek parça çalıştır.

create extension if not exists pgcrypto;

-- 1) Kullanıcı profilleri
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'staff' check (role in ('owner', 'manager', 'cashier', 'stock', 'technical', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_owner" on public.profiles;
create policy "profiles_select_own_or_owner"
on public.profiles for select
using (
  auth.uid() = id
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','manager'))
);

drop policy if exists "profiles_update_owner_manager" on public.profiles;
create policy "profiles_update_owner_manager"
on public.profiles for update
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','manager')));

-- 2) Stok
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('Cihaz', 'Aksesuar', 'Diğer')),
  device_type text,
  category text,
  sub_type text,
  brand text,
  model text,
  memory text,
  product_name text not null,
  barcode text,
  imei text,
  buy_price numeric(14,2) not null default 0,
  sell_price numeric(14,2) not null default 0,
  quantity integer not null default 1,
  supplier_name text,
  seller_person text,
  seller_phone text,
  note text,
  status text not null default 'active' check (status in ('active','passive','deleted')),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stock_items_barcode_idx on public.stock_items(barcode);
create index if not exists stock_items_imei_idx on public.stock_items(imei);
create index if not exists stock_items_module_idx on public.stock_items(module);

alter table public.stock_items enable row level security;

drop policy if exists "stock_items_authenticated_all" on public.stock_items;
create policy "stock_items_authenticated_all"
on public.stock_items for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

-- 3) Satışlar
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_group text not null,
  sale_type text not null,
  stock_item_id uuid references public.stock_items(id),
  product_name text not null,
  customer_name text,
  customer_phone text,
  cari_person text,
  total_amount numeric(14,2) not null default 0,
  cash_amount numeric(14,2) not null default 0,
  card_amount numeric(14,2) not null default 0,
  remaining_amount numeric(14,2) not null default 0,
  buy_cost numeric(14,2) not null default 0,
  profit_amount numeric(14,2) not null default 0,
  bank_name text,
  status text not null default 'active' check (status in ('active','cancelled','deleted')),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_created_at_idx on public.sales(created_at);
create index if not exists sales_group_idx on public.sales(sale_group);
alter table public.sales enable row level security;

drop policy if exists "sales_authenticated_all" on public.sales;
create policy "sales_authenticated_all"
on public.sales for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

-- 4) Giderler
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('Yemek','Kargo','Borç','İade','Ivır Zıvır')),
  amount numeric(14,2) not null default 0,
  note text,
  status text not null default 'active' check (status in ('active','cancelled','deleted')),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint debt_note_required check (category <> 'Borç' or length(coalesce(note,'')) > 0)
);

alter table public.expenses enable row level security;

drop policy if exists "expenses_authenticated_all" on public.expenses;
create policy "expenses_authenticated_all"
on public.expenses for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

-- 5) Banka / POS hareketleri
create table if not exists public.bank_movements (
  id uuid primary key default gen_random_uuid(),
  movement_type text not null check (movement_type in ('Bankaya Giden','Bankadan Çekilen','Komisyon','Düzeltme')),
  bank_name text not null,
  amount numeric(14,2) not null default 0,
  commission_rate numeric(5,4) not null default 0.035,
  commission_amount numeric(14,2) generated always as (
    case when movement_type = 'Bankaya Giden' then round(amount * commission_rate, 2) else 0 end
  ) stored,
  note text,
  related_sale_id uuid references public.sales(id),
  status text not null default 'active' check (status in ('active','cancelled','deleted')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists bank_movements_month_idx on public.bank_movements(created_at);
alter table public.bank_movements enable row level security;

drop policy if exists "bank_movements_authenticated_all" on public.bank_movements;
create policy "bank_movements_authenticated_all"
on public.bank_movements for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

-- 6) Kasa kapanış raporu
create table if not exists public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  closing_date date not null default current_date,
  total_sales numeric(14,2) not null default 0,
  total_cash numeric(14,2) not null default 0,
  total_card numeric(14,2) not null default 0,
  total_receivable numeric(14,2) not null default 0,
  total_expense numeric(14,2) not null default 0,
  net_cash numeric(14,2) not null default 0,
  total_profit numeric(14,2) not null default 0,
  note text,
  closed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(closing_date)
);

alter table public.cash_closings enable row level security;

drop policy if exists "cash_closings_authenticated_all" on public.cash_closings;
create policy "cash_closings_authenticated_all"
on public.cash_closings for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

-- 7) İşlem geçmişi / audit log
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('INSERT','UPDATE','DELETE','SOFT_DELETE','CANCEL')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create index if not exists audit_logs_table_record_idx on public.audit_logs(table_name, record_id);
create index if not exists audit_logs_changed_at_idx on public.audit_logs(changed_at);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_owner_manager_select" on public.audit_logs;
create policy "audit_logs_owner_manager_select"
on public.audit_logs for select
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','manager'))
);

-- 8) Günlük yedek tablosu
create table if not exists public.daily_backups (
  id uuid primary key default gen_random_uuid(),
  backup_date date not null default current_date,
  payload jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique(backup_date)
);

alter table public.daily_backups enable row level security;

drop policy if exists "daily_backups_owner_manager_all" on public.daily_backups;
create policy "daily_backups_owner_manager_all"
on public.daily_backups for all
using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','manager'))
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('owner','manager'))
);

-- 9) updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stock_items_set_updated_at on public.stock_items;
create trigger stock_items_set_updated_at
before update on public.stock_items
for each row execute function public.set_updated_at();

drop trigger if exists sales_set_updated_at on public.sales;
create trigger sales_set_updated_at
before update on public.sales
for each row execute function public.set_updated_at();

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

-- 10) Genel audit trigger
create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
as $$
declare
  rid uuid;
begin
  if tg_op = 'INSERT' then
    rid = new.id;
    insert into public.audit_logs(table_name, record_id, action, old_data, new_data, changed_by)
    values (tg_table_name, rid, 'INSERT', null, to_jsonb(new), auth.uid());
    return new;
  elsif tg_op = 'UPDATE' then
    rid = new.id;
    insert into public.audit_logs(table_name, record_id, action, old_data, new_data, changed_by)
    values (
      tg_table_name,
      rid,
      case
        when coalesce(old.status,'') <> 'deleted' and coalesce(new.status,'') = 'deleted' then 'SOFT_DELETE'
        when coalesce(old.status,'') <> 'cancelled' and coalesce(new.status,'') = 'cancelled' then 'CANCEL'
        else 'UPDATE'
      end,
      to_jsonb(old),
      to_jsonb(new),
      auth.uid()
    );
    return new;
  elsif tg_op = 'DELETE' then
    rid = old.id;
    insert into public.audit_logs(table_name, record_id, action, old_data, new_data, changed_by)
    values (tg_table_name, rid, 'DELETE', to_jsonb(old), null, auth.uid());
    return old;
  end if;

  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['stock_items','sales','expenses','bank_movements','cash_closings']
  loop
    execute format('drop trigger if exists %I_audit on public.%I', t, t);
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_trigger()', t, t);
  end loop;
end $$;

-- 11) Günlük yedek fonksiyonu
create or replace function public.create_daily_backup()
returns uuid
language plpgsql
security definer
as $$
declare
  payload jsonb;
  backup_id uuid;
begin
  payload = jsonb_build_object(
    'created_at', now(),
    'stock_items', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.stock_items s),
    'sales', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.sales s),
    'expenses', (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from public.expenses e),
    'bank_movements', (select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) from public.bank_movements b),
    'cash_closings', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.cash_closings c)
  );

  insert into public.daily_backups(backup_date, payload, created_by)
  values (current_date, payload, auth.uid())
  on conflict (backup_date)
  do update set payload = excluded.payload, created_at = now(), created_by = auth.uid()
  returning id into backup_id;

  return backup_id;
end;
$$;

-- 12) Kasa kapanış fonksiyonu
create or replace function public.close_cash_day(target_date date default current_date, closing_note text default null)
returns uuid
language plpgsql
security definer
as $$
declare
  closing_id uuid;
  v_total_sales numeric(14,2);
  v_total_cash numeric(14,2);
  v_total_card numeric(14,2);
  v_total_receivable numeric(14,2);
  v_total_expense numeric(14,2);
  v_total_profit numeric(14,2);
begin
  select
    coalesce(sum(total_amount),0),
    coalesce(sum(cash_amount),0),
    coalesce(sum(card_amount),0),
    coalesce(sum(remaining_amount),0),
    coalesce(sum(profit_amount),0)
  into
    v_total_sales,
    v_total_cash,
    v_total_card,
    v_total_receivable,
    v_total_profit
  from public.sales
  where status = 'active'
    and created_at::date = target_date;

  select coalesce(sum(amount),0)
  into v_total_expense
  from public.expenses
  where status = 'active'
    and created_at::date = target_date;

  insert into public.cash_closings(
    closing_date,
    total_sales,
    total_cash,
    total_card,
    total_receivable,
    total_expense,
    net_cash,
    total_profit,
    note,
    closed_by
  )
  values (
    target_date,
    v_total_sales,
    v_total_cash,
    v_total_card,
    v_total_receivable,
    v_total_expense,
    greatest(v_total_cash - v_total_expense, 0),
    v_total_profit,
    closing_note,
    auth.uid()
  )
  on conflict (closing_date)
  do update set
    total_sales = excluded.total_sales,
    total_cash = excluded.total_cash,
    total_card = excluded.total_card,
    total_receivable = excluded.total_receivable,
    total_expense = excluded.total_expense,
    net_cash = excluded.net_cash,
    total_profit = excluded.total_profit,
    note = excluded.note,
    closed_by = auth.uid(),
    created_at = now()
  returning id into closing_id;

  return closing_id;
end;
$$;

-- 13) İlk owner profilini elle oluşturmak için örnek:
-- insert into public.profiles(id, full_name, role)
-- values ('AUTH_USER_ID_BURAYA', 'Ahmet Şen', 'owner')
-- on conflict (id) do update set role='owner', full_name='Ahmet Şen';
