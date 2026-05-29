-- CEPLOG merkezi transaction RPC katmani
-- Guvenli migration: veri silmez, tablo drop etmez.
-- Bu dosya mevcut create_*_with_effects RPC'lerini degistirmez; yeni ceplog_* isimleriyle
-- business_transactions + ledger_entries + audit_logs baglantisi kurar.

create extension if not exists pgcrypto;

alter table if exists public.sales
  add column if not exists business_transaction_id uuid null,
  add column if not exists idempotency_key text null;

alter table if exists public.stock_items
  add column if not exists business_transaction_id uuid null,
  add column if not exists idempotency_key text null;

alter table if exists public.cash_movements
  add column if not exists business_transaction_id uuid null,
  add column if not exists idempotency_key text null,
  add column if not exists related_table text null,
  add column if not exists related_id text null,
  add column if not exists reference_id text null,
  add column if not exists related_stock_id text null,
  add column if not exists status text null;

alter table if exists public.bank_movements
  add column if not exists business_transaction_id uuid null,
  add column if not exists idempotency_key text null,
  add column if not exists related_table text null,
  add column if not exists related_id text null,
  add column if not exists reference_id text null,
  add column if not exists related_sale_id uuid null,
  add column if not exists related_stock_id text null,
  add column if not exists direction text null,
  add column if not exists status text null;

alter table if exists public.expenses
  add column if not exists business_transaction_id uuid null,
  add column if not exists idempotency_key text null;

alter table if exists public.audit_logs
  add column if not exists business_transaction_id uuid null,
  add column if not exists created_by uuid null;

alter table if exists public.cash_movements
  drop constraint if exists cash_movements_movement_type_check;

alter table if exists public.cash_movements
  add constraint cash_movements_movement_type_check
  check (movement_type in (
    'Devir Nakit',
    'Dünden Devir Nakit',
    'Cari Ödeme',
    'Manuel Nakit Girişi',
    'Nakit Girişi',
    'Kasaya Nakit Girişi',
    'Nakit Girişi İptali',
    'Stok Ödemesi',
    'Stok Ödemesi İptali',
    'Alım Ödemesi',
    'Alım Ödemesi İptali',
    'Cihaz Alım Ödemesi',
    'Telefon Alım Ödemesi',
    'Stok Alım Ödemesi',
    'Aksesuar Alım Ödemesi',
    'Ürün Alım Ödemesi',
    'Tedarikçi Ödemesi',
    'Tedarikçi Ödemesi İptali',
    'Cihaz Alış İptali',
    'Telefon Alış İptali',
    'Stok Alış İptali',
    'Gider',
    'Nakit Çıkışı',
    'Gider İptali',
    'Nakit Çıkışı İptali',
    'Satış Nakit',
    'Satış Tahsilatı',
    'Satış İadesi',
    'Satış İptali',
    'Bankadan Nakit Gelen',
    'Gelen Alacak',
    'Alacak Tahsilatı',
    'Alacak Ödemesi',
    'Cari Tahsilat',
    'Bankaya Yatırılan Nakit',
    'Teknik Servis Geliri',
    'Teknik Servis Kaparo',
    'Teknik Servis Tahsilat',
    'Teknik Servis Tahsilatı',
    'Teknik Servis İade',
    'Teknik Servis İadesi',
    'Düzeltme'
  ));

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
  reversed_transaction_id uuid null references public.business_transactions(id)
);

create unique index if not exists business_transactions_workspace_idempotency_idx
  on public.business_transactions(workspace_id, idempotency_key);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  business_transaction_id uuid not null references public.business_transactions(id),
  account_type text not null,
  direction text not null check (direction in ('DEBIT', 'CREDIT')),
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'TRY',
  entity_type text null,
  entity_id text null,
  description text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  business_transaction_id uuid null references public.business_transactions(id),
  sale_id text not null,
  product_type text not null,
  product_id text not null,
  imei text null,
  quantity numeric(14,2) not null check (quantity > 0),
  unit_cost_at_sale numeric(14,2) not null default 0,
  unit_price_at_sale numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  line_profit numeric(14,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  business_transaction_id uuid null references public.business_transactions(id),
  product_type text not null,
  product_id text not null,
  imei text null,
  quantity_delta numeric(14,2) not null check (quantity_delta <> 0),
  unit_cost numeric(14,2) null,
  reason text not null,
  reference_type text null,
  reference_id text null,
  note text null,
  created_by text null,
  created_at timestamptz not null default now()
);

create table if not exists public.cari_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  business_transaction_id uuid null references public.business_transactions(id),
  contact_id text not null,
  contact_type text not null default 'CUSTOMER',
  direction text not null check (direction in ('DEBIT', 'CREDIT')),
  amount numeric(14,2) not null check (amount >= 0),
  reason text not null,
  reference_type text null,
  reference_id text null,
  note text null,
  created_by text null,
  created_at timestamptz not null default now()
);

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
  created_at timestamptz not null default now()
);

create or replace function public.ceplog_money_from_text(p_value text)
returns numeric
language plpgsql
immutable
as $$
declare
  v_clean text;
begin
  v_clean := regexp_replace(coalesce(p_value, ''), '[^0-9\.-]', '', 'g');
  if v_clean = '' or v_clean = '-' then
    return 0;
  end if;
  return coalesce(v_clean::numeric, 0);
exception
  when others then
    return 0;
end;
$$;

create or replace function public.ceplog_uuid_or_null(p_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  if coalesce(p_value, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return p_value::uuid;
  end if;
  return null;
end;
$$;

create or replace function public.ceplog_assert_ledger_balanced(p_transaction_id uuid)
returns void
language plpgsql
as $$
declare
  v_delta numeric;
begin
  select coalesce(sum(case when direction = 'DEBIT' then amount else -amount end), 0)
    into v_delta
  from public.ledger_entries
  where business_transaction_id = p_transaction_id;

  if round(v_delta, 2) <> 0 then
    raise exception 'Ledger dengesi bozuk. Transaction: %, fark: %', p_transaction_id, v_delta;
  end if;
end;
$$;

create or replace function public.ceplog_write_audit_safe(
  p_workspace_id text,
  p_table_name text,
  p_record_id text,
  p_action text,
  p_event_type text,
  p_old_data jsonb,
  p_new_data jsonb,
  p_reason text,
  p_business_transaction_id uuid,
  p_request_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass('public.audit_logs') is null then
    return;
  end if;

  begin
    execute '
      insert into public.audit_logs (
        workspace_id, table_name, record_id, action, event_type,
        old_data, new_data, source, reason, metadata, request_key,
        business_transaction_id, changed_by, created_by
      )
      values ($1, $2, $3, $4, $5, $6, $7, ''business_rpc'', $8, $9, $10, $11, auth.uid(), auth.uid())
    '
    using
      p_workspace_id,
      p_table_name,
      public.ceplog_uuid_or_null(p_record_id),
      upper(coalesce(p_action, 'UPDATE')),
      p_event_type,
      p_old_data,
      p_new_data,
      p_reason,
      jsonb_build_object('business_transaction_id', p_business_transaction_id),
      p_request_key,
      p_business_transaction_id;
  exception
    when undefined_column or check_violation then
      execute '
        insert into public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
        values ($1, $2, $3, $4, $5, auth.uid())
      '
      using
        p_table_name,
        public.ceplog_uuid_or_null(p_record_id),
        upper(coalesce(p_action, 'UPDATE')),
        p_old_data,
        p_new_data;
  end;
end;
$$;

create or replace function public.ceplog_apply_sale_transaction(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace text := coalesce(nullif(payload->>'workspace_id', ''), nullif(payload->>'workspaceId', ''));
  v_key text := coalesce(nullif(payload->>'idempotency_key', ''), nullif(payload->>'idempotencyKey', ''));
  v_existing public.business_transactions%rowtype;
  v_tx uuid;
  v_sale public.sales%rowtype;
  v_item jsonb := coalesce((payload->'items')->0, '{}'::jsonb);
  v_stock_id uuid := public.ceplog_uuid_or_null(coalesce(nullif(v_item->>'product_id', ''), nullif(payload->>'stock_item_id', '')));
  v_total numeric := public.ceplog_money_from_text(coalesce(payload #>> '{payments,total_amount}', payload->>'total_amount', v_item->>'line_total'));
  v_cash numeric := public.ceplog_money_from_text(coalesce(payload #>> '{payments,cash_amount}', payload #>> '{payments,cashAmount}', '0'));
  v_card numeric := public.ceplog_money_from_text(coalesce(payload #>> '{payments,card_amount}', payload #>> '{payments,cardAmount}', '0'));
  v_cari numeric := public.ceplog_money_from_text(coalesce(payload #>> '{payments,cari_amount}', payload #>> '{payments,cariAmount}', '0'));
  v_cost numeric := public.ceplog_money_from_text(coalesce(v_item->>'unit_cost_at_sale', v_item->>'unitCostAtSale', '0'));
  v_profit numeric := public.ceplog_money_from_text(coalesce(v_item->>'line_profit', v_item->>'lineProfit', '0'));
  v_product_name text := coalesce(nullif(v_item->>'product_name', ''), nullif(payload->>'product_name', ''), 'Satış');
begin
  if v_workspace is null then raise exception 'workspace_id zorunludur'; end if;
  if v_key is null then raise exception 'idempotency_key zorunludur'; end if;
  if v_total <= 0 then raise exception 'Satış tutarı 0’dan büyük olmalıdır'; end if;
  if v_cash + v_card + v_cari <> v_total then raise exception 'Satış ödeme dağılımı satış toplamına eşit olmalıdır'; end if;

  select * into v_existing from public.business_transactions where workspace_id = v_workspace and idempotency_key = v_key;
  if found then
    return jsonb_build_object('transaction_id', v_existing.id, 'reference_id', v_existing.reference_id, 'status', v_existing.status, 'duplicate', true);
  end if;

  insert into public.business_transactions (workspace_id, transaction_type, idempotency_key, note, metadata, created_by)
  values (v_workspace, 'SALE_MIXED_PAYMENT', v_key, payload->>'note', payload, payload->>'actor_id')
  returning id into v_tx;

  v_sale := public.create_sale_with_effects(
    v_workspace,
    coalesce(nullif(payload->>'sale_group', ''), nullif(v_item->>'product_type', ''), 'Satış'),
    coalesce(nullif(payload->>'sale_type', ''), 'Satış'),
    v_stock_id,
    v_product_name,
    coalesce(payload->>'customer_name', ''),
    coalesce(payload->>'customer_phone', ''),
    coalesce(payload->>'cari_person', payload->>'customer_name', ''),
    v_total,
    v_cash,
    v_card,
    v_cari,
    v_cost,
    v_profit,
    coalesce(payload->>'bank_name', '')
  );

  update public.sales
     set business_transaction_id = v_tx, idempotency_key = v_key
   where id = v_sale.id;

  insert into public.sale_items (
    workspace_id, business_transaction_id, sale_id, product_type, product_id, imei,
    quantity, unit_cost_at_sale, unit_price_at_sale, discount_amount, line_total, line_profit, metadata
  )
  values (
    v_workspace, v_tx, v_sale.id::text,
    coalesce(nullif(v_item->>'product_type', ''), 'sale'),
    coalesce(v_stock_id::text, v_sale.id::text),
    nullif(v_item->>'imei', ''),
    greatest(public.ceplog_money_from_text(coalesce(v_item->>'quantity', '1')), 1),
    v_cost,
    v_total,
    public.ceplog_money_from_text(coalesce(v_item->>'discount_amount', v_item->>'discountAmount', '0')),
    v_total,
    v_profit,
    v_item
  );

  if v_stock_id is not null then
    insert into public.stock_movements (
      workspace_id, business_transaction_id, product_type, product_id, imei,
      quantity_delta, unit_cost, reason, reference_type, reference_id, note, created_by
    )
    values (
      v_workspace, v_tx, coalesce(nullif(v_item->>'product_type', ''), 'sale'),
      v_stock_id::text, nullif(v_item->>'imei', ''), -1, v_cost,
      'SALE_OUT', 'sales', v_sale.id::text, v_product_name, payload->>'actor_id'
    );
  end if;

  update public.cash_movements
     set business_transaction_id = v_tx, idempotency_key = v_key
   where workspace_id = v_workspace and related_table = 'sales' and related_id = v_sale.id::text;

  update public.bank_movements
     set business_transaction_id = v_tx, idempotency_key = v_key
   where workspace_id = v_workspace
     and (related_sale_id = v_sale.id or (related_table = 'sales' and related_id = v_sale.id::text));

  if v_cash > 0 then
    insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values (v_workspace, v_tx, 'CASH', 'DEBIT', v_cash, 'sales', v_sale.id::text, 'Nakit satış');
  end if;
  if v_card > 0 then
    insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values (v_workspace, v_tx, 'BANK', 'DEBIT', v_card, 'sales', v_sale.id::text, 'Kart/Banka satış');
  end if;
  if v_cari > 0 then
    insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values (v_workspace, v_tx, 'CUSTOMER_RECEIVABLE', 'DEBIT', v_cari, 'sales', v_sale.id::text, 'Cari satış');
  end if;
  insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
  values (v_workspace, v_tx, 'SALES_REVENUE', 'CREDIT', v_total, 'sales', v_sale.id::text, 'Satış geliri');
  if v_cost > 0 then
    insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values
      (v_workspace, v_tx, 'COST_OF_GOODS_SOLD', 'DEBIT', v_cost, 'sales', v_sale.id::text, 'Satılan mal maliyeti'),
      (v_workspace, v_tx, 'INVENTORY_ASSET', 'CREDIT', v_cost, 'sales', v_sale.id::text, 'Stok çıkışı');
  end if;

  perform public.ceplog_assert_ledger_balanced(v_tx);

  update public.business_transactions
     set reference_type = 'sales', reference_id = v_sale.id::text
   where id = v_tx;

  perform public.ceplog_write_audit_safe(v_workspace, 'sales', v_sale.id::text, 'INSERT', 'sale_created', null, to_jsonb(v_sale), payload->>'reason', v_tx, v_key);

  return jsonb_build_object(
    'transaction_id', v_tx,
    'reference_id', v_sale.id,
    'status', 'POSTED',
    'summary', jsonb_build_object('totalAmount', v_total, 'cashAmount', v_cash, 'cardAmount', v_card, 'cariAmount', v_cari, 'profit', v_profit)
  );
end;
$$;

create or replace function public.ceplog_record_stock_purchase_transaction(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace text := coalesce(nullif(payload->>'workspace_id', ''), nullif(payload->>'workspaceId', ''));
  v_key text := coalesce(nullif(payload->>'idempotency_key', ''), nullif(payload->>'idempotencyKey', ''));
  v_existing public.business_transactions%rowtype;
  v_tx uuid;
  v_stock public.stock_items%rowtype;
  v_qty numeric := greatest(public.ceplog_money_from_text(payload->>'quantity'), 1);
  v_buy numeric := public.ceplog_money_from_text(payload->>'buy_price');
  v_sell numeric := public.ceplog_money_from_text(payload->>'sell_price');
  v_paid numeric := public.ceplog_money_from_text(payload->>'supplier_paid');
  v_total numeric;
  v_remaining numeric;
begin
  if v_workspace is null then raise exception 'workspace_id zorunludur'; end if;
  if v_key is null then raise exception 'idempotency_key zorunludur'; end if;
  v_total := v_buy * v_qty;
  if v_total <= 0 then raise exception 'Alış toplamı 0’dan büyük olmalıdır'; end if;
  if v_paid > v_total then raise exception 'Ödeme tutarı alış tutarını aşamaz'; end if;
  v_remaining := greatest(v_total - v_paid, 0);

  select * into v_existing from public.business_transactions where workspace_id = v_workspace and idempotency_key = v_key;
  if found then
    return jsonb_build_object('transaction_id', v_existing.id, 'reference_id', v_existing.reference_id, 'status', v_existing.status, 'duplicate', true);
  end if;

  insert into public.business_transactions (workspace_id, transaction_type, idempotency_key, note, metadata, created_by)
  values (
    v_workspace,
    case when v_paid > 0 and v_remaining > 0 then 'STOCK_PURCHASE_CREDIT' when v_paid > 0 then 'STOCK_PURCHASE_CASH' else 'STOCK_PURCHASE_CREDIT' end,
    v_key,
    payload->>'note',
    payload,
    payload->>'actor_id'
  )
  returning id into v_tx;

  v_stock := public.create_stock_with_effects(
    v_workspace,
    coalesce(payload->>'module', ''),
    coalesce(payload->>'device_type', ''),
    coalesce(payload->>'category', ''),
    coalesce(payload->>'sub_type', ''),
    coalesce(payload->>'brand', ''),
    coalesce(payload->>'model', ''),
    coalesce(payload->>'memory', ''),
    coalesce(payload->>'product_name', 'Ürün'),
    coalesce(payload->>'barcode', ''),
    coalesce(payload->>'imei', ''),
    v_buy,
    v_sell,
    v_qty,
    coalesce(payload->>'supplier_name', ''),
    v_paid,
    coalesce(payload->>'seller_person', ''),
    coalesce(payload->>'seller_phone', ''),
    coalesce(payload->>'acquisition_type', ''),
    public.ceplog_money_from_text(payload->>'seller_cari_remaining'),
    coalesce(payload->>'note', '')
  );

  update public.stock_items
     set business_transaction_id = v_tx, idempotency_key = v_key
   where id = v_stock.id;

  update public.cash_movements
     set business_transaction_id = v_tx, idempotency_key = v_key
   where workspace_id = v_workspace
     and related_table = 'stock_items'
     and related_id = v_stock.id::text;

  insert into public.stock_movements (
    workspace_id, business_transaction_id, product_type, product_id, imei,
    quantity_delta, unit_cost, reason, reference_type, reference_id, note, created_by
  )
  values (
    v_workspace, v_tx, coalesce(payload->>'module', 'stock'), v_stock.id::text,
    nullif(coalesce(payload->>'imei', payload->>'barcode'), ''), v_qty, v_buy,
    'PURCHASE_IN', 'stock_items', v_stock.id::text, coalesce(payload->>'product_name', 'Ürün'), payload->>'actor_id'
  );

  insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
  values (v_workspace, v_tx, 'INVENTORY_ASSET', 'DEBIT', v_total, 'stock_items', v_stock.id::text, 'Stok alışı');
  if v_paid > 0 then
    insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values (v_workspace, v_tx, 'CASH', 'CREDIT', v_paid, 'stock_items', v_stock.id::text, 'Stok alım ödemesi');
  end if;
  if v_remaining > 0 then
    insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values (v_workspace, v_tx, 'SUPPLIER_PAYABLE', 'CREDIT', v_remaining, 'stock_items', v_stock.id::text, 'Tedarikçi/satıcı borcu');
  end if;

  perform public.ceplog_assert_ledger_balanced(v_tx);

  update public.business_transactions
     set reference_type = 'stock_items', reference_id = v_stock.id::text
   where id = v_tx;

  perform public.ceplog_write_audit_safe(v_workspace, 'stock_items', v_stock.id::text, 'INSERT', 'stock_purchase_created', null, to_jsonb(v_stock), payload->>'reason', v_tx, v_key);

  return jsonb_build_object('transaction_id', v_tx, 'reference_id', v_stock.id, 'status', 'POSTED', 'summary', jsonb_build_object('totalAmount', v_total, 'paidAmount', v_paid, 'remainingAmount', v_remaining));
end;
$$;

create or replace function public.ceplog_record_expense_transaction(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace text := coalesce(nullif(payload->>'workspace_id', ''), nullif(payload->>'workspaceId', ''));
  v_key text := coalesce(nullif(payload->>'idempotency_key', ''), nullif(payload->>'idempotencyKey', ''));
  v_existing public.business_transactions%rowtype;
  v_tx uuid;
  v_expense public.expenses%rowtype;
  v_amount numeric := public.ceplog_money_from_text(payload->>'amount');
  v_method text := upper(coalesce(payload->>'payment_method', payload->>'paymentMethod', 'CASH'));
begin
  if v_workspace is null then raise exception 'workspace_id zorunludur'; end if;
  if v_key is null then raise exception 'idempotency_key zorunludur'; end if;
  if v_amount <= 0 then raise exception 'Gider tutarı 0’dan büyük olmalıdır'; end if;

  select * into v_existing from public.business_transactions where workspace_id = v_workspace and idempotency_key = v_key;
  if found then
    return jsonb_build_object('transaction_id', v_existing.id, 'reference_id', v_existing.reference_id, 'status', v_existing.status, 'duplicate', true);
  end if;

  insert into public.business_transactions (workspace_id, transaction_type, idempotency_key, note, metadata, created_by)
  values (v_workspace, case when v_method = 'BANK' then 'EXPENSE_BANK' when v_method = 'CREDIT' then 'EXPENSE_CREDIT' else 'EXPENSE_CASH' end, v_key, payload->>'note', payload, payload->>'actor_id')
  returning id into v_tx;

  insert into public.expenses (workspace_id, category, amount, note, status, created_by, updated_by, business_transaction_id, idempotency_key)
  values (v_workspace, coalesce(payload->>'category', 'Gider'), v_amount, coalesce(payload->>'note', ''), 'active', auth.uid(), auth.uid(), v_tx, v_key)
  returning * into v_expense;

  if v_method = 'BANK' then
    insert into public.bank_movements (workspace_id, movement_type, direction, bank_name, amount, note, related_table, related_id, status, created_by, business_transaction_id, idempotency_key)
    values (v_workspace, 'Gider', 'out', coalesce(payload->>'bank_name', ''), v_amount, coalesce(payload->>'note', 'Gider'), 'expenses', v_expense.id::text, 'active', auth.uid(), v_tx, v_key);
  elsif v_method = 'CREDIT' then
    insert into public.cari_movements (workspace_id, business_transaction_id, contact_id, contact_type, direction, amount, reason, reference_type, reference_id, note, created_by)
    values (v_workspace, v_tx, coalesce(payload->>'supplier_id', 'expense-credit'), 'SUPPLIER', 'DEBIT', v_amount, 'EXPENSE_CREDIT', 'expenses', v_expense.id::text, coalesce(payload->>'note', ''), payload->>'actor_id');
  else
    insert into public.cash_movements (workspace_id, movement_type, direction, amount, note, related_table, related_id, status, created_by, business_transaction_id, idempotency_key)
    values (v_workspace, 'Gider', 'out', v_amount, coalesce(payload->>'note', 'Gider'), 'expenses', v_expense.id::text, 'active', auth.uid(), v_tx, v_key);
  end if;

  insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
  values (v_workspace, v_tx, 'EXPENSE', 'DEBIT', v_amount, 'expenses', v_expense.id::text, coalesce(payload->>'category', 'Gider'));
  insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
  values (v_workspace, v_tx, case when v_method = 'BANK' then 'BANK' when v_method = 'CREDIT' then 'SUPPLIER_PAYABLE' else 'CASH' end, 'CREDIT', v_amount, 'expenses', v_expense.id::text, 'Gider ödeme');

  perform public.ceplog_assert_ledger_balanced(v_tx);

  update public.business_transactions
     set reference_type = 'expenses', reference_id = v_expense.id::text
   where id = v_tx;

  perform public.ceplog_write_audit_safe(v_workspace, 'expenses', v_expense.id::text, 'INSERT', 'expense_created', null, to_jsonb(v_expense), payload->>'reason', v_tx, v_key);

  return jsonb_build_object('transaction_id', v_tx, 'reference_id', v_expense.id, 'status', 'POSTED', 'summary', jsonb_build_object('amount', v_amount, 'paymentMethod', v_method));
end;
$$;

create or replace function public.ceplog_record_collection_transaction(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace text := coalesce(nullif(payload->>'workspace_id', ''), nullif(payload->>'workspaceId', ''));
  v_key text := coalesce(nullif(payload->>'idempotency_key', ''), nullif(payload->>'idempotencyKey', ''));
  v_existing public.business_transactions%rowtype;
  v_tx uuid;
  v_amount numeric := public.ceplog_money_from_text(payload->>'amount');
  v_sale_id uuid := public.ceplog_uuid_or_null(payload->>'sale_id');
  v_movement_id uuid;
begin
  if v_workspace is null then raise exception 'workspace_id zorunludur'; end if;
  if v_key is null then raise exception 'idempotency_key zorunludur'; end if;
  if v_sale_id is null then raise exception 'Tahsilat için sale_id zorunludur'; end if;
  if v_amount <= 0 then raise exception 'Tahsilat tutarı 0’dan büyük olmalıdır'; end if;

  select * into v_existing from public.business_transactions where workspace_id = v_workspace and idempotency_key = v_key;
  if found then
    return jsonb_build_object('transaction_id', v_existing.id, 'reference_id', v_existing.reference_id, 'status', v_existing.status, 'duplicate', true);
  end if;

  insert into public.business_transactions (workspace_id, transaction_type, idempotency_key, note, metadata, created_by)
  values (v_workspace, 'COLLECTION_CASH', v_key, payload->>'note', payload, payload->>'actor_id')
  returning id into v_tx;

  v_movement_id := public.record_receivable_payment(v_sale_id, v_workspace, v_amount, coalesce(payload->>'note', 'Alacak tahsilatı'));

  update public.cash_movements
     set business_transaction_id = v_tx, idempotency_key = v_key
   where id = v_movement_id;

  insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
  values
    (v_workspace, v_tx, 'CASH', 'DEBIT', v_amount, 'sales', v_sale_id::text, 'Cari tahsilat'),
    (v_workspace, v_tx, 'CUSTOMER_RECEIVABLE', 'CREDIT', v_amount, 'sales', v_sale_id::text, 'Cari alacak kapama');

  perform public.ceplog_assert_ledger_balanced(v_tx);

  update public.business_transactions
     set reference_type = 'cash_movements', reference_id = v_movement_id::text
   where id = v_tx;

  perform public.ceplog_write_audit_safe(v_workspace, 'cash_movements', v_movement_id::text, 'INSERT', 'collection_created', null, jsonb_build_object('movement_id', v_movement_id), payload->>'reason', v_tx, v_key);

  return jsonb_build_object('transaction_id', v_tx, 'reference_id', v_movement_id, 'status', 'POSTED', 'summary', jsonb_build_object('amount', v_amount));
end;
$$;

create or replace function public.ceplog_cancel_sale_transaction(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace text := coalesce(nullif(payload->>'workspace_id', ''), nullif(payload->>'workspaceId', ''));
  v_key text := coalesce(nullif(payload->>'idempotency_key', ''), nullif(payload->>'idempotencyKey', ''));
  v_reason text := nullif(coalesce(payload->>'reason', ''), '');
  v_sale_id uuid := public.ceplog_uuid_or_null(coalesce(payload->>'sale_id', payload->>'saleId'));
  v_existing public.business_transactions%rowtype;
  v_tx uuid;
  v_sale public.sales%rowtype;
  v_result public.sales%rowtype;
  v_total numeric;
  v_cash numeric;
  v_card numeric;
  v_cari numeric;
  v_cost numeric;
begin
  if v_workspace is null then raise exception 'workspace_id zorunludur'; end if;
  if v_key is null then raise exception 'idempotency_key zorunludur'; end if;
  if v_sale_id is null then raise exception 'sale_id zorunludur'; end if;
  if v_reason is null then raise exception 'İptal sebebi zorunludur'; end if;

  select * into v_existing from public.business_transactions where workspace_id = v_workspace and idempotency_key = v_key;
  if found then
    return jsonb_build_object('transaction_id', v_existing.id, 'reference_id', v_existing.reference_id, 'status', v_existing.status, 'duplicate', true);
  end if;

  select * into v_sale from public.sales where id = v_sale_id and workspace_id = v_workspace for update;
  if not found then raise exception 'İptal edilecek satış bulunamadı'; end if;

  v_total := coalesce(v_sale.total_amount, 0);
  v_cash := coalesce(v_sale.cash_amount, 0);
  v_card := coalesce(v_sale.card_amount, 0);
  v_cari := coalesce(v_sale.remaining_amount, 0);
  v_cost := coalesce(v_sale.buy_cost, 0);

  insert into public.business_transactions (workspace_id, transaction_type, idempotency_key, reference_type, reference_id, reason, metadata, created_by)
  values (v_workspace, 'SALE_CANCEL', v_key, 'sales', v_sale_id::text, v_reason, payload, payload->>'actor_id')
  returning id into v_tx;

  v_result := public.cancel_sale_with_effects(v_sale_id, v_workspace, v_reason);

  update public.sales
     set business_transaction_id = coalesce(business_transaction_id, v_tx)
   where id = v_sale_id;

  if v_cash > 0 then
    insert into public.ledger_entries values (gen_random_uuid(), v_workspace, v_tx, 'CASH', 'CREDIT', v_cash, 'TRY', 'sales', v_sale_id::text, 'Satış iptal nakit çıkış', '{}'::jsonb, now());
  end if;
  if v_card > 0 then
    insert into public.ledger_entries values (gen_random_uuid(), v_workspace, v_tx, 'BANK', 'CREDIT', v_card, 'TRY', 'sales', v_sale_id::text, 'Satış iptal banka ters kayıt', '{}'::jsonb, now());
  end if;
  if v_cari > 0 then
    insert into public.ledger_entries values (gen_random_uuid(), v_workspace, v_tx, 'CUSTOMER_RECEIVABLE', 'CREDIT', v_cari, 'TRY', 'sales', v_sale_id::text, 'Satış iptal cari kapama', '{}'::jsonb, now());
  end if;
  insert into public.ledger_entries values (gen_random_uuid(), v_workspace, v_tx, 'SALES_RETURN', 'DEBIT', v_total, 'TRY', 'sales', v_sale_id::text, 'Satış iptali', '{}'::jsonb, now());
  if v_cost > 0 then
    insert into public.ledger_entries values
      (gen_random_uuid(), v_workspace, v_tx, 'INVENTORY_ASSET', 'DEBIT', v_cost, 'TRY', 'sales', v_sale_id::text, 'İptalde stok geri dönüş', '{}'::jsonb, now()),
      (gen_random_uuid(), v_workspace, v_tx, 'COST_OF_GOODS_SOLD', 'CREDIT', v_cost, 'TRY', 'sales', v_sale_id::text, 'İptalde maliyet ters kaydı', '{}'::jsonb, now());
  end if;

  perform public.ceplog_assert_ledger_balanced(v_tx);
  perform public.ceplog_write_audit_safe(v_workspace, 'sales', v_sale_id::text, 'CANCEL', 'sale_cancelled', to_jsonb(v_sale), to_jsonb(v_result), v_reason, v_tx, v_key);

  return jsonb_build_object('transaction_id', v_tx, 'reference_id', v_sale_id, 'status', 'POSTED', 'summary', jsonb_build_object('totalAmount', v_total));
end;
$$;

create or replace function public.ceplog_return_sale_transaction(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace text := coalesce(nullif(payload->>'workspace_id', ''), nullif(payload->>'workspaceId', ''));
  v_key text := coalesce(nullif(payload->>'idempotency_key', ''), nullif(payload->>'idempotencyKey', ''));
  v_reason text := nullif(coalesce(payload->>'reason', ''), '');
  v_sale_id uuid := public.ceplog_uuid_or_null(coalesce(payload->>'sale_id', payload->>'saleId'));
  v_existing public.business_transactions%rowtype;
  v_tx uuid;
  v_sale public.sales%rowtype;
  v_result jsonb;
  v_return_id uuid;
  v_total numeric;
  v_cash numeric;
  v_card numeric;
  v_cari numeric;
  v_cost numeric;
begin
  if v_workspace is null then raise exception 'workspace_id zorunludur'; end if;
  if v_key is null then raise exception 'idempotency_key zorunludur'; end if;
  if v_sale_id is null then raise exception 'sale_id zorunludur'; end if;
  if v_reason is null then raise exception 'İade sebebi zorunludur'; end if;

  select * into v_existing from public.business_transactions where workspace_id = v_workspace and idempotency_key = v_key;
  if found then
    return jsonb_build_object('transaction_id', v_existing.id, 'reference_id', v_existing.reference_id, 'status', v_existing.status, 'duplicate', true);
  end if;

  select * into v_sale from public.sales where id = v_sale_id and workspace_id = v_workspace for update;
  if not found then raise exception 'İade edilecek satış bulunamadı'; end if;

  v_total := coalesce(v_sale.total_amount, 0);
  v_cash := coalesce(v_sale.cash_amount, 0);
  v_card := coalesce(v_sale.card_amount, 0);
  v_cari := coalesce(v_sale.remaining_amount, 0);
  v_cost := coalesce(v_sale.buy_cost, 0);

  insert into public.business_transactions (workspace_id, transaction_type, idempotency_key, reference_type, reference_id, reason, metadata, created_by)
  values (v_workspace, 'SALE_RETURN_CASH', v_key, 'sales', v_sale_id::text, v_reason, payload, payload->>'actor_id')
  returning id into v_tx;

  perform public.refund_sale_with_effects(v_sale_id, v_workspace, v_reason);

  insert into public.returns (workspace_id, business_transaction_id, sale_id, refund_method, refund_amount, reason, status, created_by)
  values (v_workspace, v_tx, v_sale_id::text, coalesce(payload->>'refund_method', 'MIXED'), v_cash + v_card, v_reason, 'POSTED', payload->>'actor_id')
  returning id into v_return_id;

  if v_cash > 0 then
    insert into public.ledger_entries values (gen_random_uuid(), v_workspace, v_tx, 'CASH', 'CREDIT', v_cash, 'TRY', 'sales', v_sale_id::text, 'Satış iade nakit çıkış', '{}'::jsonb, now());
  end if;
  if v_card > 0 then
    insert into public.ledger_entries values (gen_random_uuid(), v_workspace, v_tx, 'BANK', 'CREDIT', v_card, 'TRY', 'sales', v_sale_id::text, 'Satış iade banka ters kayıt', '{}'::jsonb, now());
  end if;
  if v_cari > 0 then
    insert into public.ledger_entries values (gen_random_uuid(), v_workspace, v_tx, 'CUSTOMER_RECEIVABLE', 'CREDIT', v_cari, 'TRY', 'sales', v_sale_id::text, 'Satış iade cari kapama', '{}'::jsonb, now());
  end if;
  insert into public.ledger_entries values (gen_random_uuid(), v_workspace, v_tx, 'SALES_RETURN', 'DEBIT', v_total, 'TRY', 'sales', v_sale_id::text, 'Satış iadesi', '{}'::jsonb, now());
  if v_cost > 0 then
    insert into public.ledger_entries values
      (gen_random_uuid(), v_workspace, v_tx, 'INVENTORY_ASSET', 'DEBIT', v_cost, 'TRY', 'sales', v_sale_id::text, 'İadede stok geri dönüş', '{}'::jsonb, now()),
      (gen_random_uuid(), v_workspace, v_tx, 'COST_OF_GOODS_SOLD', 'CREDIT', v_cost, 'TRY', 'sales', v_sale_id::text, 'İadede maliyet ters kaydı', '{}'::jsonb, now());
  end if;

  perform public.ceplog_assert_ledger_balanced(v_tx);
  v_result := jsonb_build_object('return_id', v_return_id, 'sale_id', v_sale_id);
  perform public.ceplog_write_audit_safe(v_workspace, 'returns', v_return_id::text, 'INSERT', 'sale_returned', null, v_result, v_reason, v_tx, v_key);

  return jsonb_build_object('transaction_id', v_tx, 'reference_id', v_return_id, 'status', 'POSTED', 'summary', jsonb_build_object('saleId', v_sale_id, 'refundAmount', v_cash + v_card));
end;
$$;

create or replace function public.ceplog_cancel_stock_purchase_transaction(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace text := coalesce(nullif(payload->>'workspace_id', ''), nullif(payload->>'workspaceId', ''));
  v_key text := coalesce(nullif(payload->>'idempotency_key', ''), nullif(payload->>'idempotencyKey', ''));
  v_reason text := nullif(coalesce(payload->>'reason', ''), '');
  v_stock_id uuid := public.ceplog_uuid_or_null(coalesce(payload->>'stock_id', payload->>'stockId'));
  v_existing public.business_transactions%rowtype;
  v_tx uuid;
  v_stock public.stock_items%rowtype;
  v_result public.stock_items%rowtype;
  v_qty numeric;
  v_total numeric;
  v_paid numeric;
  v_remaining numeric;
begin
  if v_workspace is null then raise exception 'workspace_id zorunludur'; end if;
  if v_key is null then raise exception 'idempotency_key zorunludur'; end if;
  if v_stock_id is null then raise exception 'stock_id zorunludur'; end if;
  if v_reason is null then raise exception 'Alım iptal sebebi zorunludur'; end if;

  select * into v_existing from public.business_transactions where workspace_id = v_workspace and idempotency_key = v_key;
  if found then
    return jsonb_build_object('transaction_id', v_existing.id, 'reference_id', v_existing.reference_id, 'status', v_existing.status, 'duplicate', true);
  end if;

  select * into v_stock from public.stock_items where id = v_stock_id and workspace_id = v_workspace for update;
  if not found then raise exception 'İptal edilecek stok alımı bulunamadı'; end if;

  v_qty := greatest(coalesce(v_stock.quantity, 1), 1);
  v_total := coalesce(v_stock.buy_price, 0) * v_qty;
  v_paid := coalesce(v_stock.supplier_paid, 0);
  v_remaining := greatest(v_total - v_paid, 0);

  insert into public.business_transactions (workspace_id, transaction_type, idempotency_key, reference_type, reference_id, reason, metadata, created_by)
  values (v_workspace, 'STOCK_PURCHASE_CANCEL', v_key, 'stock_items', v_stock_id::text, v_reason, payload, payload->>'actor_id')
  returning id into v_tx;

  v_result := public.cancel_stock_purchase_with_effects(v_stock_id, v_workspace, v_reason);

  update public.stock_items
     set business_transaction_id = coalesce(business_transaction_id, v_tx)
   where id = v_stock_id;

  insert into public.stock_movements (
    workspace_id, business_transaction_id, product_type, product_id, imei,
    quantity_delta, unit_cost, reason, reference_type, reference_id, note, created_by
  )
  values (
    v_workspace, v_tx, coalesce(v_stock.module, 'stock'), v_stock_id::text,
    nullif(coalesce(v_stock.imei, v_stock.barcode), ''), -v_qty, coalesce(v_stock.buy_price, 0),
    'CANCEL_IN', 'stock_items', v_stock_id::text, v_reason, payload->>'actor_id'
  );

  if v_paid > 0 then
    insert into public.ledger_entries values (gen_random_uuid(), v_workspace, v_tx, 'CASH', 'DEBIT', v_paid, 'TRY', 'stock_items', v_stock_id::text, 'Alış iptal kasa ters kayıt', '{}'::jsonb, now());
  end if;
  if v_remaining > 0 then
    insert into public.ledger_entries values (gen_random_uuid(), v_workspace, v_tx, 'SUPPLIER_PAYABLE', 'DEBIT', v_remaining, 'TRY', 'stock_items', v_stock_id::text, 'Alış iptal satıcı/tedarikçi borç kapama', '{}'::jsonb, now());
  end if;
  insert into public.ledger_entries values (gen_random_uuid(), v_workspace, v_tx, 'INVENTORY_ASSET', 'CREDIT', v_total, 'TRY', 'stock_items', v_stock_id::text, 'Alış iptal stok çıkışı', '{}'::jsonb, now());

  perform public.ceplog_assert_ledger_balanced(v_tx);
  perform public.ceplog_write_audit_safe(v_workspace, 'stock_items', v_stock_id::text, 'CANCEL', 'stock_purchase_cancelled', to_jsonb(v_stock), to_jsonb(v_result), v_reason, v_tx, v_key);

  return jsonb_build_object('transaction_id', v_tx, 'reference_id', v_stock_id, 'status', 'POSTED', 'summary', jsonb_build_object('totalAmount', v_total, 'paidAmount', v_paid, 'remainingAmount', v_remaining));
end;
$$;

create or replace function public.ceplog_exchange_sale_transaction(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Değişim transaction motoru Phase 2 kapsamındadır. Bu aşamada gerçek işlem yapılmadı.';
end;
$$;

create or replace function public.ceplog_record_manual_stock_adjustment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Manuel stok düzeltme transaction motoru Phase 2 kapsamındadır. Bu aşamada gerçek işlem yapılmadı.';
end;
$$;

create or replace function public.ceplog_record_cash_movement_transaction(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace text := nullif(payload->>'workspace_id', '');
  v_actor text := nullif(payload->>'actor_id', '');
  v_key text := coalesce(nullif(payload->>'idempotency_key', ''), nullif(payload->>'idempotencyKey', ''));
  v_existing public.business_transactions%rowtype;
  v_tx uuid;
  v_movement public.cash_movements%rowtype;
  v_amount numeric := public.ceplog_money_from_text(payload->>'amount');
  v_direction text := lower(coalesce(payload->>'direction', ''));
  v_type text := nullif(payload->>'movement_type', '');
  v_related_table text := nullif(payload->>'related_table', '');
  v_related_id text := nullif(payload->>'related_id', '');
  v_reference_id text := nullif(payload->>'reference_id', '');
begin
  if v_workspace is null then raise exception 'workspace_id zorunludur'; end if;
  if v_key is null then raise exception 'idempotency_key zorunludur'; end if;
  if v_type is null then raise exception 'movement_type zorunludur'; end if;
  if v_direction not in ('in', 'out') then raise exception 'Kasa hareket yönü in/out olmalıdır'; end if;
  if v_amount <= 0 then raise exception 'Kasa hareket tutarı 0’dan büyük olmalıdır'; end if;

  select * into v_existing
  from public.business_transactions
  where workspace_id = v_workspace and idempotency_key = v_key;

  if found then
    return jsonb_build_object(
      'transaction_id', v_existing.id,
      'reference_id', v_existing.reference_id,
      'status', v_existing.status,
      'duplicate', true
    );
  end if;

  insert into public.business_transactions (
    workspace_id, transaction_type, idempotency_key, reference_type, reference_id, note, metadata, created_by
  )
  values (
    v_workspace,
    case when v_direction = 'in' then 'CASH_IN' else 'CASH_OUT' end,
    v_key,
    coalesce(v_related_table, 'cash_movements'),
    coalesce(v_related_id, v_reference_id),
    coalesce(payload->>'note', ''),
    payload,
    v_actor
  )
  returning id into v_tx;

  insert into public.cash_movements (
    workspace_id,
    movement_type,
    direction,
    amount,
    note,
    related_table,
    related_id,
    reference_id,
    status,
    created_by,
    business_transaction_id,
    idempotency_key
  )
  values (
    v_workspace,
    v_type,
    v_direction,
    v_amount,
    coalesce(payload->>'note', ''),
    v_related_table,
    v_related_id,
    v_reference_id,
    'active',
    public.ceplog_uuid_or_null(v_actor),
    v_tx,
    v_key
  )
  returning * into v_movement;

  if v_direction = 'in' then
    insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values (v_workspace, v_tx, 'CASH', 'DEBIT', v_amount, 'cash_movements', v_movement.id::text, v_type);

    insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values (v_workspace, v_tx, 'EQUITY_ADJUSTMENT', 'CREDIT', v_amount, 'cash_movements', v_movement.id::text, v_type);
  else
    insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values (v_workspace, v_tx, 'EQUITY_ADJUSTMENT', 'DEBIT', v_amount, 'cash_movements', v_movement.id::text, v_type);

    insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values (v_workspace, v_tx, 'CASH', 'CREDIT', v_amount, 'cash_movements', v_movement.id::text, v_type);
  end if;

  perform public.ceplog_assert_ledger_balanced(v_tx);

  update public.business_transactions
     set reference_type = 'cash_movements',
         reference_id = v_movement.id::text
   where id = v_tx;

  perform public.ceplog_write_audit_safe(
    v_workspace,
    'cash_movements',
    v_movement.id::text,
    'INSERT',
    'cash_movement_transaction',
    null,
    to_jsonb(v_movement),
    coalesce(payload->>'note', ''),
    v_tx,
    v_key
  );

  return jsonb_build_object(
    'transaction_id', v_tx,
    'reference_id', v_movement.id,
    'status', 'POSTED',
    'summary', jsonb_build_object(
      'movementType', v_type,
      'direction', v_direction,
      'amount', v_amount
    )
  );
end;
$$;

grant execute on function public.ceplog_apply_sale_transaction(jsonb) to authenticated;
grant execute on function public.ceplog_record_stock_purchase_transaction(jsonb) to authenticated;
grant execute on function public.ceplog_record_expense_transaction(jsonb) to authenticated;
grant execute on function public.ceplog_record_collection_transaction(jsonb) to authenticated;
grant execute on function public.ceplog_cancel_sale_transaction(jsonb) to authenticated;
grant execute on function public.ceplog_return_sale_transaction(jsonb) to authenticated;
grant execute on function public.ceplog_cancel_stock_purchase_transaction(jsonb) to authenticated;
grant execute on function public.ceplog_exchange_sale_transaction(jsonb) to authenticated;
grant execute on function public.ceplog_record_manual_stock_adjustment(jsonb) to authenticated;
grant execute on function public.ceplog_record_cash_movement_transaction(jsonb) to authenticated;

notify pgrst, 'reload schema';
