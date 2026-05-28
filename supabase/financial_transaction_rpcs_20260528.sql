-- CEPLOG atomic financial transaction RPCs
-- This file adds central create/cancel RPCs without deleting existing data.

create extension if not exists pgcrypto;

alter table public.stock_items
  add column if not exists acquisition_type text,
  add column if not exists supplier_paid numeric(14,2) not null default 0,
  add column if not exists seller_cari_remaining numeric(14,2) not null default 0;

alter table if exists public.cash_movements
  add column if not exists related_table text,
  add column if not exists related_id text,
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz not null default now();

alter table public.bank_movements
  add column if not exists workspace_id text,
  add column if not exists direction text,
  add column if not exists related_table text,
  add column if not exists related_id text,
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz not null default now();

update public.bank_movements
set direction = case when movement_type = 'Bankadan Çekilen' then 'out' else 'in' end
where direction is null;

alter table public.bank_movements alter column direction set default 'in';
alter table public.bank_movements alter column status set default 'active';

create index if not exists bank_movements_related_idx
on public.bank_movements(related_table, related_id);

create or replace function public.create_sale_with_effects(
  p_workspace_id text,
  p_sale_group text,
  p_sale_type text,
  p_stock_item_id uuid,
  p_product_name text,
  p_customer_name text,
  p_customer_phone text,
  p_cari_person text,
  p_total_amount numeric,
  p_cash_amount numeric,
  p_card_amount numeric,
  p_remaining_amount numeric,
  p_buy_cost numeric,
  p_profit_amount numeric,
  p_bank_name text
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id text := nullif(trim(coalesce(p_workspace_id, '')), '');
  v_stock public.stock_items%rowtype;
  v_sale public.sales%rowtype;
  v_total numeric := coalesce(p_total_amount, 0);
  v_cash numeric := coalesce(p_cash_amount, 0);
  v_card numeric := coalesce(p_card_amount, 0);
  v_remaining numeric;
  v_bank_name text := nullif(trim(coalesce(p_bank_name, '')), '');
  v_receivable_name text := nullif(trim(coalesce(p_cari_person, p_customer_name, '')), '');
begin
  if v_workspace_id is null then
    raise exception 'Workspace bilgisi bulunamadı';
  end if;

  if v_total < 0 or v_cash < 0 or v_card < 0 or coalesce(p_buy_cost, 0) < 0 or coalesce(p_profit_amount, 0) < 0 then
    raise exception 'Negatif tutar girilemez';
  end if;

  if v_cash + v_card > v_total then
    raise exception 'Nakit + kart toplamı satış fiyatını aşamaz';
  end if;

  if v_card > 0 and v_bank_name is null then
    raise exception 'Kart/banka tutarı için banka seçmek zorunludur';
  end if;

  v_remaining := greatest(v_total - v_cash - v_card, 0);

  if p_stock_item_id is not null then
    select *
      into v_stock
    from public.stock_items
    where id = p_stock_item_id
      and workspace_id = v_workspace_id
      and coalesce(status, 'active') <> 'deleted'
    for update;

    if not found then
      raise exception 'Satılacak stok kaydı bulunamadı';
    end if;

    if coalesce(v_stock.quantity, 0) <= 0 then
      raise exception 'Stok yok';
    end if;

    update public.stock_items
       set quantity = coalesce(quantity, 0) - 1,
           updated_by = auth.uid(),
           updated_at = now()
     where id = p_stock_item_id
       and workspace_id = v_workspace_id;
  end if;

  insert into public.sales (
    id,
    workspace_id,
    sale_group,
    sale_type,
    stock_item_id,
    product_name,
    customer_name,
    customer_phone,
    cari_person,
    total_amount,
    cash_amount,
    card_amount,
    remaining_amount,
    buy_cost,
    profit_amount,
    bank_name,
    status,
    created_by,
    updated_by
  )
  values (
    gen_random_uuid(),
    v_workspace_id,
    coalesce(nullif(trim(p_sale_group), ''), 'Satış'),
    coalesce(nullif(trim(p_sale_type), ''), 'Satış'),
    p_stock_item_id,
    coalesce(nullif(trim(p_product_name), ''), 'Satış'),
    nullif(trim(coalesce(p_customer_name, '')), ''),
    nullif(trim(coalesce(p_customer_phone, '')), ''),
    v_receivable_name,
    v_total,
    v_cash,
    v_card,
    v_remaining,
    coalesce(p_buy_cost, 0),
    coalesce(p_profit_amount, 0),
    v_bank_name,
    'active',
    auth.uid(),
    auth.uid()
  )
  returning * into v_sale;

  if v_cash > 0 then
    insert into public.cash_movements (
      id, workspace_id, movement_type, direction, amount, note,
      related_table, related_id, status, created_by, updated_by
    )
    values (
      gen_random_uuid(), v_workspace_id, 'Satış Nakit', 'in', v_cash,
      coalesce(v_sale.product_name, 'Satış') || ' nakit tahsilat',
      'sales', v_sale.id::text, 'active', auth.uid(), auth.uid()
    );
  end if;

  if v_card > 0 then
    insert into public.bank_movements (
      id, workspace_id, movement_type, direction, bank_name, amount, note,
      related_sale_id, related_table, related_id, status, created_by, updated_by
    )
    values (
      gen_random_uuid(), v_workspace_id, 'Bankaya Giden', 'in', v_bank_name, v_card,
      coalesce(v_sale.product_name, 'Satış') || ' kart/banka tahsilat',
      v_sale.id, 'sales', v_sale.id::text, 'active', auth.uid(), auth.uid()
    );
  end if;

  if v_remaining > 0 then
    perform public.rebuild_customer_receivable(v_workspace_id, v_receivable_name);
    if nullif(trim(coalesce(v_sale.customer_name, '')), '') is not null
       and lower(trim(coalesce(v_sale.customer_name, ''))) <> lower(trim(coalesce(v_receivable_name, ''))) then
      perform public.rebuild_customer_receivable(v_workspace_id, v_sale.customer_name);
    end if;
  end if;

  begin
    perform public.create_audit_log(
      v_workspace_id,
      'sales',
      v_sale.id::text,
      'INSERT',
      'sale_create',
      'Satış transaction RPC ile oluşturuldu',
      null,
      to_jsonb(v_sale),
      jsonb_build_object('stock_item_id', p_stock_item_id),
      null
    );
  exception
    when undefined_function then
      null;
  end;

  return v_sale;
end;
$$;

create or replace function public.create_stock_with_effects(
  p_workspace_id text,
  p_module text,
  p_device_type text,
  p_category text,
  p_sub_type text,
  p_brand text,
  p_model text,
  p_memory text,
  p_product_name text,
  p_barcode text,
  p_imei text,
  p_buy_price numeric,
  p_sell_price numeric,
  p_quantity integer,
  p_supplier_name text,
  p_seller_person text,
  p_seller_phone text,
  p_acquisition_type text,
  p_supplier_paid numeric,
  p_seller_cari_remaining numeric,
  p_note text
)
returns public.stock_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id text := nullif(trim(coalesce(p_workspace_id, '')), '');
  v_quantity integer := greatest(coalesce(p_quantity, 1), 0);
  v_buy_price numeric := coalesce(p_buy_price, 0);
  v_sell_price numeric := coalesce(p_sell_price, 0);
  v_paid numeric := coalesce(p_supplier_paid, 0);
  v_buy_total numeric;
  v_remaining numeric;
  v_seller_raw text := nullif(trim(coalesce(p_seller_person, '')), '');
  v_seller_contact text;
  v_is_seller_purchase boolean := false;
  v_stock_seller_remaining numeric := coalesce(p_seller_cari_remaining, 0);
  v_stock public.stock_items%rowtype;
  v_payment_name text;
begin
  if v_workspace_id is null then
    raise exception 'Workspace bilgisi bulunamadı';
  end if;

  if v_buy_price < 0 or v_sell_price < 0 or v_quantity < 0 or v_paid < 0 or v_stock_seller_remaining < 0 then
    raise exception 'Negatif tutar veya adet girilemez';
  end if;

  v_buy_total := v_buy_price * greatest(v_quantity, 1);
  if v_paid > v_buy_total then
    raise exception 'Ödeme tutarı alış tutarını aşamaz';
  end if;

  if v_seller_raw is null and upper(trim(coalesce(p_supplier_name, ''))) like 'SATICI %' then
    v_seller_raw := trim(coalesce(p_supplier_name, ''));
  end if;

  if v_seller_raw is null and coalesce(p_acquisition_type, '') = 'Müşteri' then
    v_seller_raw := nullif(trim(coalesce(p_supplier_name, '')), '');
  end if;

  if v_seller_raw is not null then
    if upper(v_seller_raw) like 'SATICI %' then
      v_seller_contact := upper(v_seller_raw);
    else
      v_seller_contact := 'SATICI ' || upper(v_seller_raw);
    end if;
  end if;

  v_remaining := greatest(v_buy_total - v_paid, 0);
  v_is_seller_purchase :=
    coalesce(p_acquisition_type, '') = 'Müşteri'
    or (
      coalesce(p_module, '') = 'Cihaz'
      and coalesce(p_device_type, '') = 'Telefon'
      and coalesce(p_category, '') = 'İkinci El'
      and v_seller_contact is not null
    )
    or (v_stock_seller_remaining > 0 and v_seller_contact is not null);

  if v_is_seller_purchase and v_remaining > 0 and v_stock_seller_remaining = 0 then
    v_stock_seller_remaining := v_remaining;
  end if;

  insert into public.stock_items (
    id,
    workspace_id,
    module,
    device_type,
    category,
    sub_type,
    brand,
    model,
    memory,
    product_name,
    barcode,
    imei,
    buy_price,
    sell_price,
    quantity,
    supplier_name,
    seller_person,
    seller_phone,
    acquisition_type,
    supplier_paid,
    seller_cari_remaining,
    note,
    status,
    created_by,
    updated_by
  )
  values (
    gen_random_uuid(),
    v_workspace_id,
    coalesce(nullif(trim(p_module), ''), 'Diğer'),
    nullif(trim(coalesce(p_device_type, '')), ''),
    nullif(trim(coalesce(p_category, '')), ''),
    nullif(trim(coalesce(p_sub_type, '')), ''),
    nullif(trim(coalesce(p_brand, '')), ''),
    nullif(trim(coalesce(p_model, '')), ''),
    nullif(trim(coalesce(p_memory, '')), ''),
    coalesce(nullif(trim(p_product_name), ''), 'Ürün'),
    nullif(trim(coalesce(p_barcode, '')), ''),
    nullif(trim(coalesce(p_imei, '')), ''),
    v_buy_price,
    v_sell_price,
    v_quantity,
    nullif(trim(coalesce(p_supplier_name, '')), ''),
    nullif(trim(coalesce(p_seller_person, '')), ''),
    nullif(trim(coalesce(p_seller_phone, '')), ''),
    nullif(trim(coalesce(p_acquisition_type, '')), ''),
    v_paid,
    case when v_is_seller_purchase then v_stock_seller_remaining else 0 end,
    nullif(trim(coalesce(p_note, '')), ''),
    'active',
    auth.uid(),
    auth.uid()
  )
  returning * into v_stock;

  v_payment_name := coalesce(v_seller_contact, nullif(trim(coalesce(p_supplier_name, '')), ''), 'Tedarikçi/Satıcı');

  if v_paid > 0 then
    insert into public.cash_movements (
      id, workspace_id, movement_type, direction, amount, note,
      related_table, related_id, status, created_by, updated_by
    )
    values (
      gen_random_uuid(), v_workspace_id, 'Stok Ödemesi', 'out', v_paid,
      coalesce(v_stock.product_name, 'Stok') || ' alım ödemesi - ' || v_payment_name,
      'stock_items', v_stock.id::text, 'active', auth.uid(), auth.uid()
    );
  end if;

  if v_remaining > 0 and v_is_seller_purchase then
    perform public.rebuild_seller_payable(v_workspace_id, v_seller_contact);
  elsif v_remaining > 0 and nullif(trim(coalesce(p_supplier_name, '')), '') is not null then
    perform public.rebuild_supplier_payable(v_workspace_id, p_supplier_name);
  end if;

  begin
    perform public.create_audit_log(
      v_workspace_id,
      'stock_items',
      v_stock.id::text,
      'INSERT',
      'stock_create',
      'Stok transaction RPC ile oluşturuldu',
      null,
      to_jsonb(v_stock),
      jsonb_build_object('supplier_paid', v_paid, 'remaining', v_remaining),
      null
    );
  exception
    when undefined_function then
      null;
  end;

  return v_stock;
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
  v_workspace_id text := nullif(trim(coalesce(p_workspace_id, '')), '');
  v_sale public.sales%rowtype;
  v_cancelled public.sales%rowtype;
begin
  if v_workspace_id is null then
    raise exception 'Workspace bilgisi bulunamadı';
  end if;

  select *
    into v_sale
  from public.sales
  where id = p_sale_id
    and workspace_id = v_workspace_id
    and coalesce(status, 'active') not in ('deleted', 'cancelled')
  for update;

  if not found then
    raise exception 'Satış kaydı bulunamadı veya zaten iptal edilmiş';
  end if;

  update public.sales
     set status = 'cancelled',
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_sale_id
     and workspace_id = v_workspace_id
   returning * into v_cancelled;

  update public.cash_movements
     set status = 'cancelled',
         updated_by = auth.uid(),
         updated_at = now()
   where workspace_id = v_workspace_id
     and related_table = 'sales'
     and related_id = p_sale_id::text
     and coalesce(status, 'active') <> 'deleted';

  update public.bank_movements
     set status = 'cancelled',
         updated_by = auth.uid(),
         updated_at = now()
   where workspace_id = v_workspace_id
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
       and workspace_id = v_workspace_id;
  end if;

  perform public.rebuild_customer_receivable(v_workspace_id, v_sale.customer_name);
  if nullif(trim(coalesce(v_sale.cari_person, '')), '') is not null
     and lower(trim(coalesce(v_sale.cari_person, ''))) <> lower(trim(coalesce(v_sale.customer_name, ''))) then
    perform public.rebuild_customer_receivable(v_workspace_id, v_sale.cari_person);
  end if;

  begin
    perform public.create_audit_log(
      v_workspace_id,
      'sales',
      p_sale_id::text,
      'CANCEL',
      'sale_cancel',
      coalesce(nullif(p_reason, ''), 'Satış iptal edildi'),
      to_jsonb(v_sale),
      to_jsonb(v_cancelled),
      jsonb_build_object('stock_item_id', v_sale.stock_item_id),
      null
    );
  exception
    when undefined_function then
      null;
  end;

  return v_cancelled;
end;
$$;

grant execute on function public.create_sale_with_effects(
  text, text, text, uuid, text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, text
) to authenticated;

grant execute on function public.create_stock_with_effects(
  text, text, text, text, text, text, text, text, text, text, text, numeric, numeric, integer, text, text, text, text, numeric, numeric, text
) to authenticated;

grant execute on function public.cancel_sale_with_effects(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
