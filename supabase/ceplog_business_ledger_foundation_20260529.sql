-- CEPLOG merkezi is kurallari + ledger temel migration taslagi
-- Guvenli taslak: veri silmez, tablo drop etmez, production'da otomatik calistirilmaz.

create extension if not exists pgcrypto;

create table if not exists public.business_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  transaction_type text not null,
  status text not null default 'POSTED',
  reference_type text null,
  reference_id text null,
  idempotency_key text not null,
  reason text null,
  note text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by text null,
  created_at timestamptz not null default now(),
  posted_at timestamptz null default now(),
  reversed_transaction_id uuid null references public.business_transactions(id),
  constraint business_transactions_status_check
    check (status in ('DRAFT', 'POSTED', 'CANCELLED', 'REVERSED', 'ERROR'))
);

create unique index if not exists business_transactions_workspace_idempotency_idx
  on public.business_transactions(workspace_id, idempotency_key);

create index if not exists business_transactions_workspace_idx
  on public.business_transactions(workspace_id);
create index if not exists business_transactions_type_idx
  on public.business_transactions(transaction_type);
create index if not exists business_transactions_reference_idx
  on public.business_transactions(reference_type, reference_id);
create index if not exists business_transactions_created_at_idx
  on public.business_transactions(created_at);
create index if not exists business_transactions_reversed_idx
  on public.business_transactions(reversed_transaction_id);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  business_transaction_id uuid not null references public.business_transactions(id),
  account_type text not null,
  direction text not null,
  amount numeric(14,2) not null,
  currency text not null default 'TRY',
  entity_type text null,
  entity_id text null,
  description text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ledger_entries_direction_check check (direction in ('DEBIT', 'CREDIT')),
  constraint ledger_entries_amount_check check (amount >= 0)
);

create index if not exists ledger_entries_workspace_idx
  on public.ledger_entries(workspace_id);
create index if not exists ledger_entries_transaction_idx
  on public.ledger_entries(business_transaction_id);
create index if not exists ledger_entries_account_idx
  on public.ledger_entries(account_type);
create index if not exists ledger_entries_entity_idx
  on public.ledger_entries(entity_type, entity_id);
create index if not exists ledger_entries_created_at_idx
  on public.ledger_entries(created_at);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  business_transaction_id uuid null references public.business_transactions(id),
  sale_id text not null,
  product_type text not null,
  product_id text not null,
  imei text null,
  quantity numeric(14,2) not null,
  unit_cost_at_sale numeric(14,2) not null default 0,
  unit_price_at_sale numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  line_profit numeric(14,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint sale_items_quantity_check check (quantity > 0)
);

create index if not exists sale_items_workspace_idx
  on public.sale_items(workspace_id);
create index if not exists sale_items_sale_idx
  on public.sale_items(sale_id);
create index if not exists sale_items_product_idx
  on public.sale_items(product_type, product_id);
create index if not exists sale_items_transaction_idx
  on public.sale_items(business_transaction_id);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  business_transaction_id uuid null references public.business_transactions(id),
  product_type text not null,
  product_id text not null,
  imei text null,
  quantity_delta numeric(14,2) not null,
  unit_cost numeric(14,2) null,
  reason text not null,
  reference_type text null,
  reference_id text null,
  note text null,
  created_by text null,
  created_at timestamptz not null default now(),
  constraint stock_movements_quantity_delta_check check (quantity_delta <> 0)
);

create index if not exists stock_movements_workspace_idx
  on public.stock_movements(workspace_id);
create index if not exists stock_movements_product_idx
  on public.stock_movements(product_type, product_id);
create index if not exists stock_movements_imei_idx
  on public.stock_movements(imei);
create index if not exists stock_movements_reason_idx
  on public.stock_movements(reason);
create index if not exists stock_movements_transaction_idx
  on public.stock_movements(business_transaction_id);
create index if not exists stock_movements_created_at_idx
  on public.stock_movements(created_at);

create table if not exists public.cari_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  business_transaction_id uuid null references public.business_transactions(id),
  contact_id text not null,
  contact_type text not null default 'CUSTOMER',
  direction text not null,
  amount numeric(14,2) not null,
  reason text not null,
  reference_type text null,
  reference_id text null,
  note text null,
  created_by text null,
  created_at timestamptz not null default now(),
  constraint cari_movements_direction_check check (direction in ('DEBIT', 'CREDIT')),
  constraint cari_movements_amount_check check (amount >= 0)
);

create index if not exists cari_movements_workspace_idx
  on public.cari_movements(workspace_id);
create index if not exists cari_movements_contact_idx
  on public.cari_movements(contact_id);
create index if not exists cari_movements_transaction_idx
  on public.cari_movements(business_transaction_id);
create index if not exists cari_movements_reference_idx
  on public.cari_movements(reference_type, reference_id);

create table if not exists public.pos_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  business_transaction_id uuid null references public.business_transactions(id),
  direction text not null,
  amount numeric(14,2) not null,
  bank_account_id text null,
  status text not null default 'PENDING',
  reason text not null,
  reference_type text null,
  reference_id text null,
  note text null,
  created_by text null,
  created_at timestamptz not null default now(),
  constraint pos_movements_direction_check check (direction in ('IN', 'OUT')),
  constraint pos_movements_status_check check (status in ('PENDING', 'SETTLED', 'CANCELLED')),
  constraint pos_movements_amount_check check (amount >= 0)
);

create index if not exists pos_movements_workspace_idx
  on public.pos_movements(workspace_id);
create index if not exists pos_movements_transaction_idx
  on public.pos_movements(business_transaction_id);
create index if not exists pos_movements_status_idx
  on public.pos_movements(status);

create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  business_transaction_id uuid null references public.business_transactions(id),
  sale_id text not null,
  refund_method text not null,
  refund_amount numeric(14,2) not null default 0,
  reason text not null,
  status text not null default 'POSTED',
  created_by text null,
  created_at timestamptz not null default now(),
  constraint returns_refund_amount_check check (refund_amount >= 0)
);

create index if not exists returns_workspace_idx
  on public.returns(workspace_id);
create index if not exists returns_sale_idx
  on public.returns(sale_id);
create index if not exists returns_transaction_idx
  on public.returns(business_transaction_id);

create table if not exists public.return_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  return_id uuid not null references public.returns(id),
  sale_item_id text not null,
  product_type text not null,
  product_id text not null,
  quantity numeric(14,2) not null,
  condition text not null,
  amount numeric(14,2) not null,
  cost_amount numeric(14,2) null,
  created_at timestamptz not null default now(),
  constraint return_items_quantity_check check (quantity > 0),
  constraint return_items_condition_check check (condition in ('SELLABLE', 'DEFECTIVE', 'SCRAP'))
);

create index if not exists return_items_workspace_idx
  on public.return_items(workspace_id);
create index if not exists return_items_return_idx
  on public.return_items(return_id);
create index if not exists return_items_product_idx
  on public.return_items(product_type, product_id);

create table if not exists public.exchanges (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  return_transaction_id uuid null references public.business_transactions(id),
  new_sale_transaction_id uuid null references public.business_transactions(id),
  old_sale_id text not null,
  new_sale_id text null,
  price_difference numeric(14,2) not null default 0,
  payment_method_for_difference text null,
  reason text not null,
  created_by text null,
  created_at timestamptz not null default now()
);

create index if not exists exchanges_workspace_idx
  on public.exchanges(workspace_id);
create index if not exists exchanges_old_sale_idx
  on public.exchanges(old_sale_id);
create index if not exists exchanges_new_sale_idx
  on public.exchanges(new_sale_id);

alter table if exists public.sales
  add column if not exists business_transaction_id uuid null references public.business_transactions(id),
  add column if not exists idempotency_key text null;

alter table if exists public.stock_items
  add column if not exists business_transaction_id uuid null references public.business_transactions(id),
  add column if not exists idempotency_key text null;

alter table if exists public.cash_movements
  add column if not exists business_transaction_id uuid null references public.business_transactions(id),
  add column if not exists idempotency_key text null;

alter table if exists public.bank_movements
  add column if not exists business_transaction_id uuid null references public.business_transactions(id),
  add column if not exists idempotency_key text null;

alter table if exists public.expenses
  add column if not exists business_transaction_id uuid null references public.business_transactions(id),
  add column if not exists idempotency_key text null;

alter table if exists public.audit_logs
  add column if not exists business_transaction_id uuid null references public.business_transactions(id);

create index if not exists sales_business_transaction_idx
  on public.sales(business_transaction_id);
create index if not exists stock_items_business_transaction_idx
  on public.stock_items(business_transaction_id);
create index if not exists cash_movements_business_transaction_idx
  on public.cash_movements(business_transaction_id);
create index if not exists bank_movements_business_transaction_idx
  on public.bank_movements(business_transaction_id);
create index if not exists expenses_business_transaction_idx
  on public.expenses(business_transaction_id);

notify pgrst, 'reload schema';
