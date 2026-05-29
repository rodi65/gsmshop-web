-- CEPLOG teknik servis merkezi transaction altyapısı
-- Veri silmez, tablo drop etmez. Supabase SQL Editor'da manuel çalıştırılmalıdır.

create extension if not exists pgcrypto;

create table if not exists public.technical_services (
  id text primary key,
  workspace_id text not null,
  customer_name text not null,
  phone text,
  brand text,
  model text,
  device text not null,
  imei text,
  color text,
  accessory text,
  stock_item_id text,
  issue text not null,
  repair_action text,
  technician text not null,
  estimated_price numeric(14,2) not null default 0,
  deposit numeric(14,2) not null default 0,
  cash_deposit numeric(14,2) not null default 0,
  card_deposit numeric(14,2) not null default 0,
  bank_name text,
  due_date text,
  delivery_date_time text,
  status text not null default 'Beklemede',
  note text,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists technical_services_workspace_idx
  on public.technical_services(workspace_id);
create index if not exists technical_services_status_idx
  on public.technical_services(status);
create index if not exists technical_services_created_idx
  on public.technical_services(created_at);

alter table public.technical_services enable row level security;

drop policy if exists "technical_services_authenticated_all" on public.technical_services;
create policy "technical_services_authenticated_all"
on public.technical_services for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create or replace function public.ceplog_record_technical_service_transaction(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id text := nullif(payload->>'workspace_id', '');
  v_actor_text text := nullif(payload->>'actor_id', '');
  v_actor_id uuid := case when coalesce(v_actor_text, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_actor_text::uuid else null end;
  v_key text := nullif(payload->>'idempotency_key', '');
  v_service jsonb := coalesce(payload->'service', '{}'::jsonb);
  v_payments jsonb := coalesce(payload->'payments', '{}'::jsonb);
  v_service_id text := coalesce(nullif(v_service->>'id', ''), gen_random_uuid()::text);
  v_cash numeric(14,2) := abs(coalesce((v_payments->>'cash_amount')::numeric, 0));
  v_card numeric(14,2) := abs(coalesce((v_payments->>'card_amount')::numeric, 0));
  v_total_paid numeric(14,2) := v_cash + v_card;
  v_estimated numeric(14,2) := abs(coalesce((v_service->>'estimated_price')::numeric, 0));
  v_bank text := coalesce(nullif(v_payments->>'bank_name', ''), nullif(v_service->>'bank_name', ''));
  v_tx_id uuid;
  v_existing public.business_transactions%rowtype;
begin
  if v_workspace_id is null then raise exception 'workspace_id zorunludur'; end if;
  if v_key is null then raise exception 'idempotency_key zorunludur'; end if;
  if nullif(v_service->>'customerName', '') is null and nullif(v_service->>'customer_name', '') is null then raise exception 'Müşteri adı zorunludur'; end if;
  if nullif(v_service->>'device', '') is null then raise exception 'Cihaz bilgisi zorunludur'; end if;
  if nullif(v_service->>'issue', '') is null then raise exception 'Arıza açıklaması zorunludur'; end if;
  if nullif(v_service->>'technician', '') is null then raise exception 'Teknisyen / Teslim Alan zorunludur'; end if;
  if v_total_paid > 0 and v_estimated <= 0 then raise exception 'Kaparo/ödeme için toplam servis tutarı zorunludur'; end if;
  if v_total_paid > v_estimated then raise exception 'Kaparo toplam servis ücretinden fazla olamaz'; end if;
  if v_card > 0 and v_bank is null then raise exception 'Kart/banka kaparosu için banka zorunludur'; end if;

  select *
  into v_existing
  from public.business_transactions
  where workspace_id = v_workspace_id and idempotency_key = v_key
  limit 1;

  if v_existing.id is not null then
    return jsonb_build_object('transaction_id', v_existing.id, 'reference_id', v_existing.reference_id, 'status', 'DUPLICATE');
  end if;

  insert into public.business_transactions(workspace_id, transaction_type, status, reference_type, reference_id, idempotency_key, note, metadata, created_by)
  values (v_workspace_id, 'SERVICE_SALE', 'POSTED', 'technical_services', v_service_id, v_key, payload->>'note', payload, v_actor_text)
  returning id into v_tx_id;

  insert into public.technical_services(
    id, workspace_id, customer_name, phone, brand, model, device, imei, color, accessory, stock_item_id,
    issue, repair_action, technician, estimated_price, deposit, cash_deposit, card_deposit, bank_name,
    due_date, delivery_date_time, status, note, payload, created_by, updated_by
  )
  values (
    v_service_id,
    v_workspace_id,
    coalesce(v_service->>'customerName', v_service->>'customer_name'),
    coalesce(v_service->>'phone', ''),
    coalesce(v_service->>'brand', ''),
    coalesce(v_service->>'model', ''),
    coalesce(v_service->>'device', ''),
    coalesce(v_service->>'imei', ''),
    coalesce(v_service->>'color', ''),
    coalesce(v_service->>'accessory', ''),
    coalesce(v_service->>'stockItemId', v_service->>'stock_item_id', ''),
    coalesce(v_service->>'issue', ''),
    coalesce(v_service->>'repairAction', v_service->>'repair_action', ''),
    coalesce(v_service->>'technician', ''),
    v_estimated,
    v_total_paid,
    v_cash,
    v_card,
    v_bank,
    coalesce(v_service->>'dueDate', v_service->>'due_date', ''),
    coalesce(v_service->>'deliveryDateTime', v_service->>'delivery_date_time', ''),
    coalesce(v_service->>'status', 'Beklemede'),
    coalesce(v_service->>'note', payload->>'note', ''),
    v_service,
    v_actor_id,
    v_actor_id
  );

  if v_cash > 0 then
    insert into public.cash_movements(movement_type, direction, amount, note, related_table, related_id, related_service_id, service_record_id, reference_id, workspace_id, status, created_by)
    values ('Teknik Servis Kaparo', 'in', v_cash, payload->>'note', 'technical_services', v_service_id, v_service_id, v_service_id, v_service_id, v_workspace_id, 'active', v_actor_id);
  end if;

  if v_card > 0 then
    insert into public.bank_movements(movement_type, direction, bank_name, amount, note, related_table, related_id, related_service_id, service_record_id, reference_id, workspace_id, status, created_by)
    values ('Teknik Servis Kaparo', 'in', v_bank, v_card, payload->>'note', 'technical_services', v_service_id, v_service_id, v_service_id, v_service_id, v_workspace_id, 'active', v_actor_id);
  end if;

  if v_cash > 0 then
    insert into public.ledger_entries(workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values (v_workspace_id, v_tx_id, 'CASH', 'DEBIT', v_cash, 'technical_services', v_service_id, 'Teknik servis nakit kaparo');
  end if;
  if v_card > 0 then
    insert into public.ledger_entries(workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values (v_workspace_id, v_tx_id, 'BANK', 'DEBIT', v_card, 'technical_services', v_service_id, 'Teknik servis kart kaparo');
  end if;
  if v_total_paid > 0 then
    insert into public.ledger_entries(workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values (v_workspace_id, v_tx_id, 'SERVICE_REVENUE', 'CREDIT', v_total_paid, 'technical_services', v_service_id, 'Teknik servis kaparo');
  end if;

  return jsonb_build_object('transaction_id', v_tx_id, 'reference_id', v_service_id, 'service_id', v_service_id, 'status', 'POSTED');
end;
$$;

create or replace function public.ceplog_record_technical_service_finance_transaction(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id text := nullif(payload->>'workspace_id', '');
  v_actor_text text := nullif(payload->>'actor_id', '');
  v_actor_id uuid := case when coalesce(v_actor_text, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_actor_text::uuid else null end;
  v_key text := nullif(payload->>'idempotency_key', '');
  v_service_id text := nullif(payload->>'service_id', '');
  v_mode text := lower(coalesce(payload->>'mode', 'payment'));
  v_amount numeric(14,2) := abs(coalesce((payload->>'amount')::numeric, 0));
  v_method text := coalesce(payload->>'method', 'Nakit');
  v_bank text := nullif(payload->>'bank_name', '');
  v_movement_type text := case when v_mode = 'refund' then 'Teknik Servis İade' else 'Teknik Servis Tahsilat' end;
  v_direction text := case when v_mode = 'refund' then 'out' else 'in' end;
  v_tx_type text := case when v_mode = 'refund' then 'SERVICE_RETURN' else 'SERVICE_SALE' end;
  v_tx_id uuid;
  v_existing public.business_transactions%rowtype;
begin
  if v_workspace_id is null then raise exception 'workspace_id zorunludur'; end if;
  if v_key is null then raise exception 'idempotency_key zorunludur'; end if;
  if v_service_id is null then raise exception 'service_id zorunludur'; end if;
  if v_amount <= 0 then raise exception 'Tutar 0’dan büyük olmalıdır'; end if;
  if v_method = 'Kart/Banka' and v_bank is null then raise exception 'Banka seçmek zorunludur'; end if;
  if not exists (select 1 from public.technical_services where id = v_service_id and workspace_id = v_workspace_id) then
    raise exception 'Teknik servis kaydı bulunamadı';
  end if;

  select *
  into v_existing
  from public.business_transactions
  where workspace_id = v_workspace_id and idempotency_key = v_key
  limit 1;

  if v_existing.id is not null then
    return jsonb_build_object('transaction_id', v_existing.id, 'reference_id', v_existing.reference_id, 'status', 'DUPLICATE');
  end if;

  insert into public.business_transactions(workspace_id, transaction_type, status, reference_type, reference_id, idempotency_key, note, metadata, created_by)
  values (v_workspace_id, v_tx_type, 'POSTED', 'technical_services', v_service_id, v_key, payload->>'note', payload, v_actor_text)
  returning id into v_tx_id;

  if v_method = 'Kart/Banka' then
    insert into public.bank_movements(movement_type, direction, bank_name, amount, note, related_table, related_id, related_service_id, service_record_id, reference_id, workspace_id, status, created_by)
    values (v_movement_type, v_direction, v_bank, v_amount, payload->>'note', 'technical_services', v_service_id, v_service_id, v_service_id, v_service_id, v_workspace_id, 'active', v_actor_id);
  else
    insert into public.cash_movements(movement_type, direction, amount, note, related_table, related_id, related_service_id, service_record_id, reference_id, workspace_id, status, created_by)
    values (v_movement_type, v_direction, v_amount, payload->>'note', 'technical_services', v_service_id, v_service_id, v_service_id, v_service_id, v_workspace_id, 'active', v_actor_id);
  end if;

  update public.technical_services
  set updated_by = v_actor_id, updated_at = now()
  where id = v_service_id and workspace_id = v_workspace_id;

  if v_mode = 'refund' then
    insert into public.ledger_entries(workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values (v_workspace_id, v_tx_id, 'RETURN_REFUND', 'DEBIT', v_amount, 'technical_services', v_service_id, 'Teknik servis iade');
    insert into public.ledger_entries(workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values (v_workspace_id, v_tx_id, case when v_method = 'Kart/Banka' then 'BANK' else 'CASH' end, 'CREDIT', v_amount, 'technical_services', v_service_id, 'Teknik servis iade çıkış');
  else
    insert into public.ledger_entries(workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values (v_workspace_id, v_tx_id, case when v_method = 'Kart/Banka' then 'BANK' else 'CASH' end, 'DEBIT', v_amount, 'technical_services', v_service_id, 'Teknik servis tahsilat');
    insert into public.ledger_entries(workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values (v_workspace_id, v_tx_id, 'SERVICE_REVENUE', 'CREDIT', v_amount, 'technical_services', v_service_id, 'Teknik servis gelir');
  end if;

  return jsonb_build_object('transaction_id', v_tx_id, 'reference_id', v_service_id, 'service_id', v_service_id, 'status', 'POSTED');
end;
$$;

grant execute on function public.ceplog_record_technical_service_transaction(jsonb) to authenticated;
grant execute on function public.ceplog_record_technical_service_finance_transaction(jsonb) to authenticated;

notify pgrst, 'reload schema';
