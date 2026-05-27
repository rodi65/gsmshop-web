-- CEPLOG Financial Integrity RPC sistemi
-- Bu dosyayi Supabase SQL Editor'da manuel calistirin.
-- Mevcut verileri silmez, tablo drop etmez.

create extension if not exists pgcrypto;

do $$
declare
  constraint_name text;
begin
  select conname
    into constraint_name
  from pg_constraint
  where conrelid = 'public.cash_movements'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%movement_type%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.cash_movements drop constraint if exists %I', constraint_name);
  end if;

  alter table public.cash_movements
    add constraint cash_movements_movement_type_check
    check (
      movement_type in (
        'Satış Nakit',
        'Stok Ödemesi',
        'Gider',
        'Bankadan Nakit Gelen',
        'Manuel Nakit Girişi',
        'Nakit Girişi',
        'Cari Ödeme',
        'Devir Nakit',
        'Düzeltme',
        'Gelen Alacak',
        'Alacak Ödemesi',
        'Bankaya Yatırılan Nakit',
        'İade Nakit'
      )
    );
exception
  when undefined_table then
    null;
end $$;

create or replace function public.rebuild_customer_receivable(
  p_workspace_id text,
  p_customer_name text
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_name text := nullif(trim(coalesce(p_customer_name, '')), '');
  v_total numeric := 0;
  v_contact_id uuid;
begin
  if v_customer_name is null then
    return 0;
  end if;

  select coalesce(sum(coalesce(remaining_amount, 0)), 0)
    into v_total
  from public.sales
  where workspace_id = p_workspace_id
    and coalesce(status, 'active') not in ('deleted', 'cancelled')
    and lower(trim(coalesce(customer_name, cari_person, ''))) = lower(v_customer_name);

  select id
    into v_contact_id
  from public.contacts
  where workspace_id = p_workspace_id
    and kind = 'customer'
    and balance_type = 'receivable'
    and lower(trim(name)) = lower(v_customer_name)
    and coalesce(status, 'active') <> 'deleted'
  order by created_at asc nulls last
  limit 1
  for update;

  if v_contact_id is null then
    if v_total > 0 then
      insert into public.contacts (
        id,
        workspace_id,
        kind,
        name,
        balance,
        balance_type,
        note,
        created_by,
        updated_by
      )
      values (
        gen_random_uuid(),
        p_workspace_id,
        'customer',
        v_customer_name,
        v_total,
        'receivable',
        'Satışlardan kalan alacak',
        auth.uid(),
        auth.uid()
      );
    end if;
  else
    update public.contacts
       set balance = greatest(v_total, 0),
           balance_type = 'receivable',
           updated_by = auth.uid(),
           updated_at = now()
     where id = v_contact_id
       and workspace_id = p_workspace_id;
  end if;

  return greatest(v_total, 0);
end;
$$;

create or replace function public.rebuild_supplier_payable(
  p_workspace_id text,
  p_supplier_name text
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_name text := nullif(trim(coalesce(p_supplier_name, '')), '');
  v_total numeric := 0;
  v_contact_id uuid;
begin
  if v_supplier_name is null then
    return 0;
  end if;

  select coalesce(sum(greatest((coalesce(buy_price, 0) * greatest(coalesce(quantity, 1), 1)) - coalesce(supplier_paid, 0), 0)), 0)
    into v_total
  from public.stock_items
  where workspace_id = p_workspace_id
    and coalesce(status, 'active') <> 'deleted'
    and lower(trim(coalesce(supplier_name, ''))) = lower(v_supplier_name)
    and coalesce(acquisition_type, '') <> 'Müşteri';

  select id
    into v_contact_id
  from public.contacts
  where workspace_id = p_workspace_id
    and kind = 'supplier'
    and balance_type = 'payable'
    and lower(trim(name)) = lower(v_supplier_name)
    and coalesce(status, 'active') <> 'deleted'
  order by created_at asc nulls last
  limit 1
  for update;

  if v_contact_id is null then
    if v_total > 0 then
      insert into public.contacts (
        id,
        workspace_id,
        kind,
        name,
        balance,
        balance_type,
        note,
        created_by,
        updated_by
      )
      values (
        gen_random_uuid(),
        p_workspace_id,
        'supplier',
        v_supplier_name,
        v_total,
        'payable',
        'Stok alımlarından kalan borç',
        auth.uid(),
        auth.uid()
      );
    end if;
  else
    update public.contacts
       set balance = greatest(v_total, 0),
           balance_type = 'payable',
           updated_by = auth.uid(),
           updated_at = now()
     where id = v_contact_id
       and workspace_id = p_workspace_id;
  end if;

  return greatest(v_total, 0);
end;
$$;

create or replace function public.rebuild_seller_payable(
  p_workspace_id text,
  p_seller_name text
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean_name text := nullif(trim(coalesce(p_seller_name, '')), '');
  v_contact_name text;
  v_total numeric := 0;
  v_phone text;
  v_contact_id uuid;
begin
  if v_clean_name is null then
    return 0;
  end if;

  if upper(v_clean_name) like 'SATICI %' then
    v_contact_name := upper(v_clean_name);
    v_clean_name := trim(substring(v_clean_name from 8));
  else
    v_contact_name := 'SATICI ' || upper(v_clean_name);
  end if;

  select coalesce(sum(greatest(coalesce(buy_price, 0) - coalesce(supplier_paid, 0), 0)), 0),
         max(nullif(trim(coalesce(seller_phone, '')), ''))
    into v_total, v_phone
  from public.stock_items
  where workspace_id = p_workspace_id
    and coalesce(status, 'active') <> 'deleted'
    and (
      lower(trim(coalesce(seller_person, ''))) = lower(v_clean_name)
      or lower(trim(coalesce(supplier_name, ''))) = lower(v_contact_name)
      or lower(trim(coalesce(supplier_name, ''))) = lower(v_clean_name)
    );

  select id
    into v_contact_id
  from public.contacts
  where workspace_id = p_workspace_id
    and kind = 'seller'
    and balance_type = 'payable'
    and lower(trim(name)) = lower(v_contact_name)
    and coalesce(status, 'active') <> 'deleted'
  order by created_at asc nulls last
  limit 1
  for update;

  if v_contact_id is null then
    if v_total > 0 then
      insert into public.contacts (
        id,
        workspace_id,
        kind,
        name,
        phone,
        balance,
        balance_type,
        note,
        created_by,
        updated_by
      )
      values (
        gen_random_uuid(),
        p_workspace_id,
        'seller',
        v_contact_name,
        v_phone,
        v_total,
        'payable',
        'İkinci el cihaz alımlarından kalan borç',
        auth.uid(),
        auth.uid()
      );
    end if;
  else
    update public.contacts
       set balance = greatest(v_total, 0),
           balance_type = 'payable',
           phone = coalesce(v_phone, phone),
           updated_by = auth.uid(),
           updated_at = now()
     where id = v_contact_id
       and workspace_id = p_workspace_id;
  end if;

  return greatest(v_total, 0);
end;
$$;

create or replace function public.update_sale_with_effects(
  p_sale_id uuid,
  p_workspace_id text,
  p_total_amount numeric,
  p_cash_amount numeric,
  p_card_amount numeric,
  p_remaining_amount numeric,
  p_bank_name text,
  p_customer_name text,
  p_customer_phone text,
  p_product_name text,
  p_buy_cost numeric,
  p_profit_amount numeric
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_sale public.sales%rowtype;
  v_sale public.sales%rowtype;
  v_cash_id uuid;
  v_bank_id uuid;
begin
  if coalesce(p_card_amount, 0) > 0 and nullif(trim(coalesce(p_bank_name, '')), '') is null then
    raise exception 'Kartlı satışta banka adı zorunludur';
  end if;

  select *
    into v_old_sale
  from public.sales
  where id = p_sale_id
    and workspace_id = p_workspace_id
    and coalesce(status, 'active') not in ('deleted', 'cancelled')
  for update;

  if not found then
    raise exception 'Satış kaydı bulunamadı veya workspace erişimi yok';
  end if;

  update public.sales
     set total_amount = coalesce(p_total_amount, 0),
         cash_amount = coalesce(p_cash_amount, 0),
         card_amount = coalesce(p_card_amount, 0),
         remaining_amount = coalesce(p_remaining_amount, 0),
         bank_name = nullif(trim(coalesce(p_bank_name, '')), ''),
         customer_name = nullif(trim(coalesce(p_customer_name, '')), ''),
         customer_phone = nullif(trim(coalesce(p_customer_phone, '')), ''),
         product_name = nullif(trim(coalesce(p_product_name, '')), ''),
         buy_cost = coalesce(p_buy_cost, 0),
         profit_amount = coalesce(p_profit_amount, 0),
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_sale_id
     and workspace_id = p_workspace_id
   returning * into v_sale;

  select id
    into v_cash_id
  from public.cash_movements
  where workspace_id = p_workspace_id
    and related_table = 'sales'
    and related_id = p_sale_id::text
    and movement_type = 'Satış Nakit'
    and coalesce(status, 'active') <> 'deleted'
  order by created_at asc nulls last
  limit 1
  for update;

  if coalesce(p_cash_amount, 0) > 0 then
    if v_cash_id is null then
      insert into public.cash_movements (
        id, workspace_id, movement_type, direction, amount, note,
        related_table, related_id, status, created_by, updated_by
      )
      values (
        gen_random_uuid(), p_workspace_id, 'Satış Nakit', 'in', coalesce(p_cash_amount, 0),
        coalesce(p_product_name, 'Satış') || ' nakit satış',
        'sales', p_sale_id::text, 'active', auth.uid(), auth.uid()
      );
    else
      update public.cash_movements
         set direction = 'in',
             amount = coalesce(p_cash_amount, 0),
             note = coalesce(p_product_name, 'Satış') || ' nakit satış',
             status = 'active',
             updated_by = auth.uid(),
             updated_at = now()
       where id = v_cash_id
         and workspace_id = p_workspace_id;
    end if;
  elsif v_cash_id is not null then
    update public.cash_movements
       set status = 'cancelled',
           updated_by = auth.uid(),
           updated_at = now()
     where id = v_cash_id
       and workspace_id = p_workspace_id;
  end if;

  select id
    into v_bank_id
  from public.bank_movements
  where workspace_id = p_workspace_id
    and related_sale_id = p_sale_id
    and coalesce(status, 'active') <> 'deleted'
  order by created_at asc nulls last
  limit 1
  for update;

  if coalesce(p_card_amount, 0) > 0 then
    if v_bank_id is null then
      insert into public.bank_movements (
        id, workspace_id, movement_type, bank_name, amount, note,
        related_sale_id, status, created_by, updated_by
      )
      values (
        gen_random_uuid(), p_workspace_id, 'Bankaya Giden',
        nullif(trim(coalesce(p_bank_name, '')), ''),
        coalesce(p_card_amount, 0),
        coalesce(p_product_name, 'Satış') || ' kart/POS satış',
        p_sale_id, 'active', auth.uid(), auth.uid()
      );
    else
      update public.bank_movements
         set movement_type = 'Bankaya Giden',
             bank_name = nullif(trim(coalesce(p_bank_name, '')), ''),
             amount = coalesce(p_card_amount, 0),
             note = coalesce(p_product_name, 'Satış') || ' kart/POS satış',
             status = 'active',
             updated_by = auth.uid(),
             updated_at = now()
       where id = v_bank_id
         and workspace_id = p_workspace_id;
    end if;
  elsif v_bank_id is not null then
    update public.bank_movements
       set status = 'cancelled',
           updated_by = auth.uid(),
           updated_at = now()
     where id = v_bank_id
       and workspace_id = p_workspace_id;
  end if;

  perform public.rebuild_customer_receivable(p_workspace_id, v_old_sale.customer_name);
  perform public.rebuild_customer_receivable(p_workspace_id, p_customer_name);

  return v_sale;
end;
$$;

create or replace function public.cancel_sale_with_effects(
  p_sale_id uuid,
  p_workspace_id text,
  p_reason text default null
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_cancelled public.sales%rowtype;
begin
  select *
    into v_sale
  from public.sales
  where id = p_sale_id
    and workspace_id = p_workspace_id
    and coalesce(status, 'active') not in ('deleted', 'cancelled')
  for update;

  if not found then
    raise exception 'Satış kaydı bulunamadı veya workspace erişimi yok';
  end if;

  update public.sales
     set status = 'cancelled',
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_sale_id
     and workspace_id = p_workspace_id
   returning * into v_cancelled;

  update public.cash_movements
     set status = 'cancelled',
         updated_by = auth.uid(),
         updated_at = now()
   where workspace_id = p_workspace_id
     and related_table = 'sales'
     and related_id = p_sale_id::text
     and coalesce(status, 'active') <> 'deleted';

  update public.bank_movements
     set status = 'cancelled',
         updated_by = auth.uid(),
         updated_at = now()
   where workspace_id = p_workspace_id
     and (
       related_sale_id = p_sale_id
       or (
         related_table = 'sales'
         and related_id = p_sale_id::text
       )
     )
     and coalesce(status, 'active') <> 'deleted';

  if v_sale.stock_item_id is not null then
    update public.stock_items
       set quantity = coalesce(quantity, 0) + 1,
           status = 'active',
           updated_by = auth.uid(),
           updated_at = now()
     where id = v_sale.stock_item_id
       and workspace_id = p_workspace_id;
  end if;

  perform public.rebuild_customer_receivable(p_workspace_id, v_sale.customer_name);
  if nullif(trim(coalesce(v_sale.cari_person, '')), '') is not null
     and lower(trim(coalesce(v_sale.cari_person, ''))) <> lower(trim(coalesce(v_sale.customer_name, ''))) then
    perform public.rebuild_customer_receivable(p_workspace_id, v_sale.cari_person);
  end if;

  if to_regclass('public.audit_logs') is not null then
    begin
      insert into public.audit_logs (
        id, workspace_id, table_name, record_id, action, note, created_by
      )
      values (
        gen_random_uuid(), p_workspace_id, 'sales', p_sale_id::text,
        'cancel', coalesce(p_reason, 'Satış iptal edildi'), auth.uid()
      );
    exception
      when undefined_column then
        null;
    end;
  end if;

  return v_cancelled;
end;
$$;

create or replace function public.update_stock_with_effects(
  p_stock_id uuid,
  p_workspace_id text,
  p_buy_price numeric,
  p_sell_price numeric,
  p_quantity numeric,
  p_supplier_name text,
  p_supplier_paid numeric,
  p_category text,
  p_seller_person text,
  p_seller_phone text
)
returns public.stock_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_stock public.stock_items%rowtype;
  v_stock public.stock_items%rowtype;
  v_cash_id uuid;
  v_payee text;
begin
  select *
    into v_old_stock
  from public.stock_items
  where id = p_stock_id
    and workspace_id = p_workspace_id
    and coalesce(status, 'active') <> 'deleted'
  for update;

  if not found then
    raise exception 'Stok kaydı bulunamadı veya workspace erişimi yok';
  end if;

  update public.stock_items
     set buy_price = coalesce(p_buy_price, 0),
         sell_price = coalesce(p_sell_price, 0),
         quantity = coalesce(p_quantity, 0),
         supplier_name = nullif(trim(coalesce(p_supplier_name, '')), ''),
         supplier_paid = coalesce(p_supplier_paid, 0),
         category = nullif(trim(coalesce(p_category, '')), ''),
         seller_person = nullif(trim(coalesce(p_seller_person, '')), ''),
         seller_phone = nullif(trim(coalesce(p_seller_phone, '')), ''),
         seller_cari_remaining = greatest(coalesce(p_buy_price, 0) - coalesce(p_supplier_paid, 0), 0),
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_stock_id
     and workspace_id = p_workspace_id
   returning * into v_stock;

  v_payee := coalesce(nullif(trim(p_supplier_name), ''), nullif(trim(p_seller_person), ''), 'Tedarikçi/Satıcı');

  select id
    into v_cash_id
  from public.cash_movements
  where workspace_id = p_workspace_id
    and related_table = 'stock_items'
    and related_id = p_stock_id::text
    and movement_type = 'Stok Ödemesi'
    and coalesce(status, 'active') <> 'deleted'
  order by created_at asc nulls last
  limit 1
  for update;

  if coalesce(p_supplier_paid, 0) > 0 then
    if v_cash_id is null then
      insert into public.cash_movements (
        id, workspace_id, movement_type, direction, amount, note,
        related_table, related_id, status, created_by, updated_by
      )
      values (
        gen_random_uuid(), p_workspace_id, 'Stok Ödemesi', 'out', coalesce(p_supplier_paid, 0),
        coalesce(v_stock.product_name, 'Stok') || ' alım ödemesi - ' || v_payee,
        'stock_items', p_stock_id::text, 'active', auth.uid(), auth.uid()
      );
    else
      update public.cash_movements
         set direction = 'out',
             amount = coalesce(p_supplier_paid, 0),
             note = coalesce(v_stock.product_name, 'Stok') || ' alım ödemesi - ' || v_payee,
             status = 'active',
             updated_by = auth.uid(),
             updated_at = now()
       where id = v_cash_id
         and workspace_id = p_workspace_id;
    end if;
  elsif v_cash_id is not null then
    update public.cash_movements
       set status = 'cancelled',
           updated_by = auth.uid(),
           updated_at = now()
     where id = v_cash_id
       and workspace_id = p_workspace_id;
  end if;

  perform public.rebuild_supplier_payable(p_workspace_id, v_old_stock.supplier_name);
  perform public.rebuild_supplier_payable(p_workspace_id, p_supplier_name);
  perform public.rebuild_seller_payable(p_workspace_id, v_old_stock.seller_person);
  perform public.rebuild_seller_payable(p_workspace_id, p_seller_person);

  return v_stock;
end;
$$;

create or replace function public.record_contact_payment(
  p_contact_id uuid,
  p_workspace_id text,
  p_amount numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact public.contacts%rowtype;
  v_movement_id uuid := gen_random_uuid();
begin
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Ödeme tutarı sıfırdan büyük olmalıdır';
  end if;

  select *
    into v_contact
  from public.contacts
  where id = p_contact_id
    and workspace_id = p_workspace_id
    and coalesce(status, 'active') <> 'deleted'
  for update;

  if not found then
    raise exception 'Cari kayıt bulunamadı veya workspace erişimi yok';
  end if;

  if coalesce(p_amount, 0) > coalesce(v_contact.balance, 0) then
    raise exception 'Ödeme cari borçtan fazla olamaz';
  end if;

  insert into public.cash_movements (
    id, workspace_id, movement_type, direction, amount, note,
    related_table, related_id, status, created_by, updated_by
  )
  values (
    v_movement_id, p_workspace_id, 'Cari Ödeme', 'out', coalesce(p_amount, 0),
    coalesce(nullif(trim(p_note), ''), 'Cari ödeme - ' || coalesce(v_contact.name, 'Cari')),
    'contacts', p_contact_id::text, 'active', auth.uid(), auth.uid()
  );

  update public.contacts
     set balance = greatest(coalesce(balance, 0) - coalesce(p_amount, 0), 0),
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_contact_id
     and workspace_id = p_workspace_id;

  return v_movement_id;
end;
$$;

create or replace function public.record_receivable_payment(
  p_sale_id uuid,
  p_workspace_id text,
  p_amount numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_movement_id uuid := gen_random_uuid();
begin
  if coalesce(p_amount, 0) <= 0 then
    raise exception 'Tahsilat tutarı sıfırdan büyük olmalıdır';
  end if;

  select *
    into v_sale
  from public.sales
  where id = p_sale_id
    and workspace_id = p_workspace_id
    and coalesce(status, 'active') not in ('deleted', 'cancelled')
  for update;

  if not found then
    raise exception 'Satış kaydı bulunamadı veya workspace erişimi yok';
  end if;

  if coalesce(p_amount, 0) > coalesce(v_sale.remaining_amount, 0) then
    raise exception 'Tahsilat kalan alacaktan fazla olamaz';
  end if;

  insert into public.cash_movements (
    id, workspace_id, movement_type, direction, amount, note,
    related_table, related_id, status, created_by, updated_by
  )
  values (
    v_movement_id, p_workspace_id, 'Alacak Ödemesi', 'in', coalesce(p_amount, 0),
    coalesce(nullif(trim(p_note), ''), 'Alacak ödemesi - ' || coalesce(v_sale.customer_name, 'Müşteri')),
    'sales', p_sale_id::text, 'active', auth.uid(), auth.uid()
  );

  update public.sales
     set remaining_amount = greatest(coalesce(remaining_amount, 0) - coalesce(p_amount, 0), 0),
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_sale_id
     and workspace_id = p_workspace_id;

  perform public.rebuild_customer_receivable(p_workspace_id, v_sale.customer_name);

  return v_movement_id;
end;
$$;

comment on function public.update_sale_with_effects is
  'Satış düzenleme, nakit/POS hareketi ve müşteri alacağını tek transaction içinde günceller.';

comment on function public.cancel_sale_with_effects is
  'Satış iptali, bağlı kasa/banka hareketleri, stok iadesi ve cari alacağı tek transaction içinde günceller.';

comment on function public.update_stock_with_effects is
  'Stok düzenleme, stok ödeme hareketi ve tedarikçi/satıcı borcunu tek transaction içinde günceller.';

comment on function public.record_contact_payment is
  'Cari ödeme kaydını ve kasa çıkışını tek transaction içinde oluşturur.';

comment on function public.record_receivable_payment is
  'Müşteri alacak tahsilatını ve kasa girişini tek transaction içinde oluşturur.';
