-- CEPLOG Central Financial RPC Phase 1
-- Veri silmez, tablo drop etmez.
-- Satis/alis olusturma ve alis iptali akisini tek Supabase transaction icine alir.

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.cash_movements') is not null then
    execute 'alter table public.cash_movements add column if not exists direction text';
    execute 'alter table public.cash_movements add column if not exists related_table text';
    execute 'alter table public.cash_movements add column if not exists related_id text';
    execute 'alter table public.cash_movements add column if not exists reference_id text';
    execute 'alter table public.cash_movements add column if not exists related_stock_id text';
    execute 'alter table public.cash_movements add column if not exists status text';
    execute 'alter table public.cash_movements alter column status set default ''active''';
  end if;

  if to_regclass('public.bank_movements') is not null then
    execute 'alter table public.bank_movements add column if not exists direction text';
    execute 'alter table public.bank_movements add column if not exists related_table text';
    execute 'alter table public.bank_movements add column if not exists related_id text';
    execute 'alter table public.bank_movements add column if not exists reference_id text';
    execute 'alter table public.bank_movements add column if not exists related_sale_id uuid';
    execute 'alter table public.bank_movements add column if not exists related_stock_id text';
    execute 'alter table public.bank_movements add column if not exists status text';
    execute 'alter table public.bank_movements alter column direction set default ''in''';
    execute 'alter table public.bank_movements alter column status set default ''active''';
  end if;
end $$;

do $$
declare
  item record;
  constraint_name text;
begin
  for item in
    select *
    from (values
      ('cash_movements', 'amount'),
      ('bank_movements', 'amount'),
      ('sales', 'total_amount'),
      ('sales', 'cash_amount'),
      ('sales', 'card_amount'),
      ('sales', 'remaining_amount'),
      ('sales', 'buy_cost'),
      ('sales', 'profit_amount'),
      ('stock_items', 'buy_price'),
      ('stock_items', 'sell_price'),
      ('stock_items', 'quantity'),
      ('stock_items', 'supplier_paid'),
      ('stock_items', 'seller_cari_remaining'),
      ('contacts', 'balance'),
      ('expenses', 'amount')
    ) as v(table_name, column_name)
  loop
    if to_regclass('public.' || item.table_name) is not null
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = item.table_name
           and column_name = item.column_name
       ) then
      constraint_name := item.table_name || '_' || item.column_name || '_nonnegative_check';

      if not exists (
        select 1
        from pg_constraint
        where conrelid = to_regclass('public.' || item.table_name)
          and conname = constraint_name
      ) then
        execute format(
          'alter table public.%I add constraint %I check (%I is null or %I >= 0) not valid',
          item.table_name,
          constraint_name,
          item.column_name,
          item.column_name
        );
      end if;

      execute format('alter table public.%I validate constraint %I', item.table_name, constraint_name);
    end if;
  end loop;
end $$;

do $$
declare
  constraint_name text;
begin
  if to_regclass('public.cash_movements') is null then
    return;
  end if;

  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.cash_movements'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%movement_type%'
  loop
    execute format('alter table public.cash_movements drop constraint if exists %I', constraint_name);
  end loop;

  alter table public.cash_movements
    add constraint cash_movements_movement_type_check
    check (
      movement_type in (
        'Satış Nakit',
        'Satış Tahsilatı',
        'Satış İadesi',
        'Satış İptali',
        'Stok Ödemesi',
        'Stok Ödemesi İptali',
        'Alım Ödemesi',
        'Alım Ödemesi İptali',
        'Cihaz Alım Ödemesi',
        'Cihaz Alış İptali',
        'Telefon Alım Ödemesi',
        'Telefon Alış İptali',
        'Stok Alım Ödemesi',
        'Stok Alış İptali',
        'Aksesuar Alım Ödemesi',
        'Ürün Alım Ödemesi',
        'Tedarikçi Ödemesi',
        'Tedarikçi Ödemesi İptali',
        'Gider',
        'Gider İptali',
        'Nakit Çıkışı',
        'Nakit Çıkışı İptali',
        'Bankadan Nakit Gelen',
        'Bankadan Gelen Nakit',
        'Manuel Nakit Girişi',
        'Nakit Girişi',
        'Kasaya Nakit Girişi',
        'Nakit Girişi İptali',
        'Dünden Devir Nakit',
        'Devir Nakit',
        'Cari Ödeme',
        'Cari Tahsilat',
        'Düzeltme',
        'Gelen Alacak',
        'Alacak Tahsilatı',
        'Alacak Ödemesi',
        'Bankaya Yatırılan Nakit',
        'İade Nakit',
        'Teknik Servis Geliri',
        'Teknik Servis Kaparo',
        'Teknik Servis Tahsilat',
        'Teknik Servis Tahsilatı',
        'Teknik Servis İade',
        'Teknik Servis İadesi'
      )
    ) not valid;
end $$;

do $$
declare
  constraint_name text;
begin
  if to_regclass('public.bank_movements') is null then
    return;
  end if;

  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.bank_movements'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%movement_type%'
  loop
    execute format('alter table public.bank_movements drop constraint if exists %I', constraint_name);
  end loop;

  alter table public.bank_movements
    add constraint bank_movements_movement_type_check
    check (
      movement_type in (
        'Bankaya Giden',
        'Bankadan Çekilen',
        'Banka Girişi',
        'Banka Çıkışı',
        'Satış İadesi',
        'Satış İptali',
        'Stok Ödemesi',
        'Stok Ödemesi İptali',
        'Alım Ödemesi',
        'Alım Ödemesi İptali',
        'Cihaz Alım Ödemesi',
        'Cihaz Alış İptali',
        'Telefon Alım Ödemesi',
        'Telefon Alış İptali',
        'Stok Alım Ödemesi',
        'Stok Alış İptali',
        'Aksesuar Alım Ödemesi',
        'Ürün Alım Ödemesi',
        'Tedarikçi Ödemesi',
        'Tedarikçi Ödemesi İptali',
        'Teknik Servis Geliri',
        'Teknik Servis Kaparo',
        'Teknik Servis Tahsilat',
        'Teknik Servis Tahsilatı',
        'Teknik Servis İade',
        'Teknik Servis İadesi',
        'Düzeltme'
      )
    ) not valid;
end $$;

do $$
declare
  fn record;
begin
  for fn in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_sale_with_effects'
  loop
    execute format('drop function if exists public.%I(%s)', fn.proname, pg_get_function_identity_arguments(fn.oid));
  end loop;
end $$;

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
  v_sale public.sales%rowtype;
  v_stock public.stock_items%rowtype;
  v_total numeric := coalesce(p_total_amount, 0);
  v_cash numeric := coalesce(p_cash_amount, 0);
  v_card numeric := coalesce(p_card_amount, 0);
  v_remaining numeric;
  v_buy_cost numeric := coalesce(p_buy_cost, 0);
  v_profit numeric := coalesce(p_profit_amount, 0);
  v_customer_key text := nullif(trim(coalesce(p_cari_person, p_customer_name, '')), '');
begin
  if v_total < 0 or v_cash < 0 or v_card < 0 or coalesce(p_remaining_amount, 0) < 0 or v_buy_cost < 0 or v_profit < 0 then
    raise exception 'Tutarlar negatif olamaz';
  end if;

  if v_cash + v_card > v_total then
    raise exception 'Nakit + kart toplamı satış fiyatını aşamaz';
  end if;

  if v_card > 0 and nullif(trim(coalesce(p_bank_name, '')), '') is null then
    raise exception 'Kartlı satışta banka adı zorunludur';
  end if;

  v_remaining := greatest(v_total - v_cash - v_card, 0);

  if p_stock_item_id is not null then
    select *
      into v_stock
    from public.stock_items
    where id = p_stock_item_id
      and workspace_id = p_workspace_id
      and coalesce(status, 'active') not in ('deleted', 'cancelled')
    for update;

    if not found then
      raise exception 'Satılacak stok kaydı bulunamadı veya workspace erişimi yok';
    end if;

    if coalesce(v_stock.quantity, 0) <= 0 then
      raise exception 'Stok yok';
    end if;
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
    p_workspace_id,
    nullif(trim(coalesce(p_sale_group, '')), ''),
    nullif(trim(coalesce(p_sale_type, '')), ''),
    p_stock_item_id,
    nullif(trim(coalesce(p_product_name, '')), ''),
    nullif(trim(coalesce(p_customer_name, '')), ''),
    nullif(trim(coalesce(p_customer_phone, '')), ''),
    nullif(trim(coalesce(p_cari_person, '')), ''),
    v_total,
    v_cash,
    v_card,
    v_remaining,
    v_buy_cost,
    v_profit,
    nullif(trim(coalesce(p_bank_name, '')), ''),
    'active',
    auth.uid(),
    auth.uid()
  )
  returning * into v_sale;

  if p_stock_item_id is not null then
    update public.stock_items
       set quantity = greatest(coalesce(quantity, 0) - 1, 0),
           updated_by = auth.uid(),
           updated_at = now()
     where id = p_stock_item_id
       and workspace_id = p_workspace_id;
  end if;

  if v_cash > 0 then
    insert into public.cash_movements (
      id,
      workspace_id,
      movement_type,
      direction,
      amount,
      note,
      related_table,
      related_id,
      status,
      created_by,
      updated_by
    )
    values (
      gen_random_uuid(),
      p_workspace_id,
      'Satış Nakit',
      'in',
      v_cash,
      coalesce(p_product_name, 'Satış') || ' nakit tahsilat',
      'sales',
      v_sale.id::text,
      'active',
      auth.uid(),
      auth.uid()
    );
  end if;

  if v_card > 0 then
    insert into public.bank_movements (
      id,
      workspace_id,
      movement_type,
      direction,
      bank_name,
      amount,
      note,
      related_sale_id,
      related_table,
      related_id,
      status,
      created_by,
      updated_by
    )
    values (
      gen_random_uuid(),
      p_workspace_id,
      'Bankaya Giden',
      'in',
      nullif(trim(coalesce(p_bank_name, '')), ''),
      v_card,
      'POSTAN Gelen - ' || nullif(trim(coalesce(p_bank_name, '')), '') || ' - ' || coalesce(p_product_name, 'Satış'),
      v_sale.id,
      'sales',
      v_sale.id::text,
      'active',
      auth.uid(),
      auth.uid()
    );
  end if;

  if v_remaining > 0 and v_customer_key is not null then
    perform public.rebuild_customer_receivable(p_workspace_id, v_customer_key);
  end if;

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
  v_customer_key text;
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

  v_customer_key := nullif(trim(coalesce(v_sale.cari_person, v_sale.customer_name, '')), '');

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
     and (
       related_id = p_sale_id::text
       or reference_id = p_sale_id::text
       or (related_table = 'sales' and related_id = p_sale_id::text)
     )
     and coalesce(status, 'active') <> 'deleted';

  update public.bank_movements
     set status = 'cancelled',
         updated_by = auth.uid(),
         updated_at = now()
   where workspace_id = p_workspace_id
     and (
       related_sale_id = p_sale_id
       or related_id = p_sale_id::text
       or reference_id = p_sale_id::text
       or (related_table = 'sales' and related_id = p_sale_id::text)
     )
     and coalesce(status, 'active') <> 'deleted';

  if v_sale.stock_item_id is not null then
    update public.stock_items
       set quantity = coalesce(quantity, 0) + 1,
           updated_by = auth.uid(),
           updated_at = now()
     where id = v_sale.stock_item_id
       and workspace_id = p_workspace_id;
  end if;

  if v_customer_key is not null then
    perform public.rebuild_customer_receivable(p_workspace_id, v_customer_key);
  end if;

  if to_regclass('public.audit_logs') is not null then
    begin
      insert into public.audit_logs (
        id, workspace_id, table_name, record_id, action, note, created_by
      )
      values (
        gen_random_uuid(), p_workspace_id, 'sales', p_sale_id,
        'cancel', coalesce(p_reason, 'Satış iptal edildi'), auth.uid()
      );
    exception
      when others then
        null;
    end;
  end if;

  return v_cancelled;
end;
$$;

do $$
declare
  fn record;
begin
  for fn in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'refund_sale_with_effects'
  loop
    execute format('drop function if exists public.%I(%s)', fn.proname, pg_get_function_identity_arguments(fn.oid));
  end loop;
end $$;

create or replace function public.refund_sale_with_effects(
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
  v_refunded public.sales%rowtype;
  v_cash numeric := 0;
  v_card numeric := 0;
  v_remaining numeric := 0;
  v_bank_name text;
  v_customer_key text;
begin
  select *
    into v_sale
  from public.sales
  where id = p_sale_id
    and workspace_id = p_workspace_id
    and lower(coalesce(status, 'active')) not in ('deleted', 'cancelled', 'canceled', 'iptal', 'iade', 'refunded', 'refund')
  for update;

  if not found then
    raise exception 'Satış kaydı bulunamadı, daha önce iptal/iade edildi veya workspace erişimi yok';
  end if;

  if exists (
    select 1
    from public.cash_movements
    where workspace_id = p_workspace_id
      and movement_type = 'Satış İadesi'
      and coalesce(status, 'active') <> 'deleted'
      and (
        related_id = p_sale_id::text
        or reference_id = p_sale_id::text
        or (related_table = 'sales' and related_id = p_sale_id::text)
      )
  ) or exists (
    select 1
    from public.bank_movements
    where workspace_id = p_workspace_id
      and movement_type = 'Satış İadesi'
      and coalesce(status, 'active') <> 'deleted'
      and (
        related_sale_id = p_sale_id
        or related_id = p_sale_id::text
        or reference_id = p_sale_id::text
        or (related_table = 'sales' and related_id = p_sale_id::text)
      )
  ) then
    raise exception 'Bu satış için iade hareketi daha önce oluşturulmuş';
  end if;

  v_cash := greatest(coalesce(v_sale.cash_amount, 0), 0);
  v_card := greatest(coalesce(v_sale.card_amount, 0), 0);
  v_remaining := greatest(coalesce(v_sale.remaining_amount, 0), 0);
  v_bank_name := nullif(trim(coalesce(v_sale.bank_name, '')), '');
  v_customer_key := nullif(trim(coalesce(v_sale.cari_person, v_sale.customer_name, '')), '');

  if v_cash + v_card + v_remaining <= 0 then
    raise exception 'Bu satışta iade edilecek ödeme veya cari tutar bulunamadı';
  end if;

  update public.sales
     set status = 'iade',
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_sale_id
     and workspace_id = p_workspace_id
   returning * into v_refunded;

  if v_cash > 0 then
    insert into public.cash_movements (
      id, workspace_id, movement_type, direction, amount, note,
      related_table, related_id, reference_id, status, created_by, updated_by
    )
    values (
      gen_random_uuid(), p_workspace_id, 'Satış İadesi', 'out', v_cash,
      'Satış iadesi: ' || coalesce(v_sale.product_name, 'Satış') || coalesce(' | ' || nullif(p_reason, ''), ''),
      'sales', p_sale_id::text, p_sale_id::text, 'active', auth.uid(), auth.uid()
    );
  end if;

  if v_card > 0 then
    insert into public.bank_movements (
      id, workspace_id, movement_type, direction, bank_name, amount, note,
      related_sale_id, related_table, related_id, reference_id, status, created_by, updated_by
    )
    values (
      gen_random_uuid(), p_workspace_id, 'Satış İadesi', 'out',
      coalesce(v_bank_name, 'Banka'),
      v_card,
      'Satış iadesi: ' || coalesce(v_sale.product_name, 'Satış') || coalesce(' | ' || nullif(p_reason, ''), ''),
      p_sale_id, 'sales', p_sale_id::text, p_sale_id::text, 'active', auth.uid(), auth.uid()
    );
  end if;

  if v_sale.stock_item_id is not null then
    update public.stock_items
       set quantity = coalesce(quantity, 0) + 1,
           status = 'active',
           updated_by = auth.uid(),
           updated_at = now()
     where id = v_sale.stock_item_id
       and workspace_id = p_workspace_id;
  end if;

  if v_customer_key is not null then
    perform public.rebuild_customer_receivable(p_workspace_id, v_customer_key);
  end if;

  if to_regclass('public.audit_logs') is not null then
    begin
      insert into public.audit_logs (
        id, workspace_id, table_name, record_id, action, note, created_by
      )
      values (
        gen_random_uuid(), p_workspace_id, 'sales', p_sale_id,
        'refund', coalesce(p_reason, 'Satış iade edildi'), auth.uid()
      );
    exception
      when others then
        null;
    end;
  end if;

  return v_refunded;
end;
$$;

do $$
declare
  fn record;
begin
  for fn in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'update_sale_with_effects'
  loop
    execute format('drop function if exists public.%I(%s)', fn.proname, pg_get_function_identity_arguments(fn.oid));
  end loop;
end $$;

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
  p_profit_amount numeric,
  p_cari_person text default null
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
  v_total numeric := coalesce(p_total_amount, 0);
  v_cash numeric := coalesce(p_cash_amount, 0);
  v_card numeric := coalesce(p_card_amount, 0);
  v_remaining numeric;
  v_old_customer_key text;
  v_new_customer_key text;
begin
  if v_total < 0 or v_cash < 0 or v_card < 0 or coalesce(p_remaining_amount, 0) < 0 or coalesce(p_buy_cost, 0) < 0 or coalesce(p_profit_amount, 0) < 0 then
    raise exception 'Tutarlar negatif olamaz';
  end if;

  if v_cash + v_card > v_total then
    raise exception 'Nakit + kart toplamı satış fiyatını aşamaz';
  end if;

  if v_card > 0 and nullif(trim(coalesce(p_bank_name, '')), '') is null then
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

  v_remaining := greatest(v_total - v_cash - v_card, 0);
  v_old_customer_key := nullif(trim(coalesce(v_old_sale.cari_person, v_old_sale.customer_name, '')), '');
  v_new_customer_key := nullif(trim(coalesce(p_cari_person, p_customer_name, '')), '');

  update public.sales
     set total_amount = v_total,
         cash_amount = v_cash,
         card_amount = v_card,
         remaining_amount = v_remaining,
         bank_name = nullif(trim(coalesce(p_bank_name, '')), ''),
         customer_name = nullif(trim(coalesce(p_customer_name, '')), ''),
         customer_phone = nullif(trim(coalesce(p_customer_phone, '')), ''),
         cari_person = nullif(trim(coalesce(p_cari_person, '')), ''),
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
    and movement_type = 'Satış Nakit'
    and coalesce(status, 'active') <> 'deleted'
    and (
      related_id = p_sale_id::text
      or reference_id = p_sale_id::text
      or (related_table = 'sales' and related_id = p_sale_id::text)
    )
  order by created_at asc nulls last
  limit 1
  for update;

  if v_cash > 0 then
    if v_cash_id is null then
      insert into public.cash_movements (
        id, workspace_id, movement_type, direction, amount, note,
        related_table, related_id, status, created_by, updated_by
      )
      values (
        gen_random_uuid(), p_workspace_id, 'Satış Nakit', 'in', v_cash,
        coalesce(p_product_name, 'Satış') || ' nakit satış',
        'sales', p_sale_id::text, 'active', auth.uid(), auth.uid()
      );
    else
      update public.cash_movements
         set direction = 'in',
             amount = v_cash,
             note = coalesce(p_product_name, 'Satış') || ' nakit satış',
             related_table = 'sales',
             related_id = p_sale_id::text,
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
    and coalesce(status, 'active') <> 'deleted'
    and (
      related_sale_id = p_sale_id
      or related_id = p_sale_id::text
      or reference_id = p_sale_id::text
      or (related_table = 'sales' and related_id = p_sale_id::text)
    )
  order by created_at asc nulls last
  limit 1
  for update;

  if v_card > 0 then
    if v_bank_id is null then
      insert into public.bank_movements (
        id, workspace_id, movement_type, direction, bank_name, amount, note,
        related_sale_id, related_table, related_id, status, created_by, updated_by
      )
      values (
        gen_random_uuid(), p_workspace_id, 'Bankaya Giden', 'in',
        nullif(trim(coalesce(p_bank_name, '')), ''),
        v_card,
        coalesce(p_product_name, 'Satış') || ' kart/POS satış',
        p_sale_id, 'sales', p_sale_id::text, 'active', auth.uid(), auth.uid()
      );
    else
      update public.bank_movements
         set movement_type = 'Bankaya Giden',
             direction = 'in',
             bank_name = nullif(trim(coalesce(p_bank_name, '')), ''),
             amount = v_card,
             note = coalesce(p_product_name, 'Satış') || ' kart/POS satış',
             related_sale_id = p_sale_id,
             related_table = 'sales',
             related_id = p_sale_id::text,
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

  if v_old_customer_key is not null then
    perform public.rebuild_customer_receivable(p_workspace_id, v_old_customer_key);
  end if;
  if v_new_customer_key is not null and v_new_customer_key is distinct from v_old_customer_key then
    perform public.rebuild_customer_receivable(p_workspace_id, v_new_customer_key);
  end if;

  return v_sale;
end;
$$;

do $$
declare
  fn record;
begin
  for fn in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_stock_with_effects'
  loop
    execute format('drop function if exists public.%I(%s)', fn.proname, pg_get_function_identity_arguments(fn.oid));
  end loop;
end $$;

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
  p_quantity numeric,
  p_supplier_name text,
  p_supplier_paid numeric,
  p_seller_person text,
  p_seller_phone text,
  p_acquisition_type text,
  p_seller_cari_remaining numeric,
  p_note text
)
returns public.stock_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock public.stock_items%rowtype;
  v_quantity numeric := greatest(coalesce(p_quantity, 1), 1);
  v_buy_price numeric := coalesce(p_buy_price, 0);
  v_sell_price numeric := coalesce(p_sell_price, 0);
  v_paid numeric := coalesce(p_supplier_paid, 0);
  v_buy_total numeric;
  v_remaining numeric;
  v_seller_name text := nullif(trim(coalesce(p_seller_person, '')), '');
  v_supplier_name text := nullif(trim(coalesce(p_supplier_name, '')), '');
  v_is_seller_purchase boolean;
  v_payee text;
begin
  if v_buy_price < 0 or v_sell_price < 0 or v_paid < 0 or coalesce(p_seller_cari_remaining, 0) < 0 or coalesce(p_quantity, 1) <= 0 then
    raise exception 'Stok tutarları negatif veya sıfır olamaz';
  end if;

  v_buy_total := v_buy_price * v_quantity;

  if v_paid > v_buy_total then
    raise exception 'Ödeme tutarı alış tutarını aşamaz';
  end if;

  v_remaining := greatest(v_buy_total - v_paid, 0);
  v_is_seller_purchase := coalesce(p_acquisition_type, '') = 'Müşteri' or v_seller_name is not null;

  if coalesce(p_seller_cari_remaining, 0) > v_remaining then
    raise exception 'Satıcı cari kalan alış tutarını aşamaz';
  end if;

  if v_is_seller_purchase and coalesce(p_seller_cari_remaining, 0) > 0 then
    v_remaining := coalesce(p_seller_cari_remaining, 0);
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
    supplier_paid,
    seller_person,
    seller_phone,
    acquisition_type,
    seller_cari_remaining,
    note,
    status,
    created_by,
    updated_by
  )
  values (
    gen_random_uuid(),
    p_workspace_id,
    nullif(trim(coalesce(p_module, '')), ''),
    nullif(trim(coalesce(p_device_type, '')), ''),
    nullif(trim(coalesce(p_category, '')), ''),
    nullif(trim(coalesce(p_sub_type, '')), ''),
    nullif(trim(coalesce(p_brand, '')), ''),
    nullif(trim(coalesce(p_model, '')), ''),
    nullif(trim(coalesce(p_memory, '')), ''),
    nullif(trim(coalesce(p_product_name, '')), ''),
    nullif(trim(coalesce(p_barcode, '')), ''),
    nullif(trim(coalesce(p_imei, '')), ''),
    v_buy_price,
    v_sell_price,
    v_quantity,
    v_supplier_name,
    v_paid,
    v_seller_name,
    nullif(trim(coalesce(p_seller_phone, '')), ''),
    nullif(trim(coalesce(p_acquisition_type, '')), ''),
    case when v_is_seller_purchase then v_remaining else 0 end,
    nullif(trim(coalesce(p_note, '')), ''),
    'active',
    auth.uid(),
    auth.uid()
  )
  returning * into v_stock;

  v_payee := coalesce(v_supplier_name, v_seller_name, 'Tedarikçi/Satıcı');

  if v_paid > 0 then
    insert into public.cash_movements (
      id,
      workspace_id,
      movement_type,
      direction,
      amount,
      note,
      related_table,
      related_id,
      related_stock_id,
      status,
      created_by,
      updated_by
    )
    values (
      gen_random_uuid(),
      p_workspace_id,
      'Stok Ödemesi',
      'out',
      v_paid,
      coalesce(v_stock.product_name, 'Stok') || ' alım ödemesi - ' || v_payee,
      'stock_items',
      v_stock.id::text,
      v_stock.id::text,
      'active',
      auth.uid(),
      auth.uid()
    );
  end if;

  if v_supplier_name is not null then
    perform public.rebuild_supplier_payable(p_workspace_id, v_supplier_name);
  end if;

  if v_seller_name is not null then
    perform public.rebuild_seller_payable(p_workspace_id, v_seller_name);
  end if;

  return v_stock;
end;
$$;

do $$
declare
  fn record;
begin
  for fn in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'update_stock_with_effects'
  loop
    execute format('drop function if exists public.%I(%s)', fn.proname, pg_get_function_identity_arguments(fn.oid));
  end loop;
end $$;

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
  p_seller_phone text,
  p_bank_paid numeric default 0,
  p_bank_name text default null,
  p_product_name text default null
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
  v_bank_id uuid;
  v_quantity numeric := greatest(coalesce(p_quantity, 1), 1);
  v_buy_price numeric := coalesce(p_buy_price, 0);
  v_sell_price numeric := coalesce(p_sell_price, 0);
  v_cash_paid numeric := coalesce(p_supplier_paid, 0);
  v_bank_paid numeric := coalesce(p_bank_paid, 0);
  v_paid_total numeric;
  v_buy_total numeric;
  v_remaining numeric;
  v_seller_name text := nullif(trim(coalesce(p_seller_person, '')), '');
  v_supplier_name text := nullif(trim(coalesce(p_supplier_name, '')), '');
  v_is_seller_purchase boolean;
  v_payee text;
begin
  if v_buy_price < 0 or v_sell_price < 0 or v_cash_paid < 0 or v_bank_paid < 0 or coalesce(p_quantity, 1) <= 0 then
    raise exception 'Stok tutarları negatif veya sıfır olamaz';
  end if;

  if v_bank_paid > 0 and nullif(trim(coalesce(p_bank_name, '')), '') is null then
    raise exception 'Banka ödemesi varsa banka seçilmelidir';
  end if;

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

  v_paid_total := v_cash_paid + v_bank_paid;
  v_buy_total := v_buy_price * v_quantity;

  if v_paid_total > v_buy_total then
    raise exception 'Ödeme tutarı alış tutarını aşamaz';
  end if;

  v_remaining := greatest(v_buy_total - v_paid_total, 0);
  v_is_seller_purchase := coalesce(v_old_stock.acquisition_type, '') = 'Müşteri' or v_seller_name is not null;

  update public.stock_items
     set buy_price = v_buy_price,
         sell_price = v_sell_price,
         quantity = v_quantity,
         supplier_name = v_supplier_name,
         supplier_paid = v_paid_total,
         category = nullif(trim(coalesce(p_category, '')), ''),
         product_name = coalesce(nullif(trim(coalesce(p_product_name, '')), ''), product_name),
         seller_person = v_seller_name,
         seller_phone = nullif(trim(coalesce(p_seller_phone, '')), ''),
         seller_cari_remaining = case when v_is_seller_purchase then v_remaining else 0 end,
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_stock_id
     and workspace_id = p_workspace_id
   returning * into v_stock;

  v_payee := coalesce(v_supplier_name, v_seller_name, 'Tedarikçi/Satıcı');

  select id
    into v_cash_id
  from public.cash_movements
  where workspace_id = p_workspace_id
    and movement_type in (
      'Stok Ödemesi',
      'Alım Ödemesi',
      'Cihaz Alım Ödemesi',
      'Telefon Alım Ödemesi',
      'Stok Alım Ödemesi',
      'Aksesuar Alım Ödemesi',
      'Ürün Alım Ödemesi',
      'Tedarikçi Ödemesi'
    )
    and coalesce(status, 'active') <> 'deleted'
    and (
      related_id = p_stock_id::text
      or related_stock_id = p_stock_id::text
      or (related_table = 'stock_items' and related_id = p_stock_id::text)
    )
  order by created_at asc nulls last
  limit 1
  for update;

  if v_cash_paid > 0 then
    if v_cash_id is null then
      insert into public.cash_movements (
        id, workspace_id, movement_type, direction, amount, note,
        related_table, related_id, related_stock_id, status, created_by, updated_by
      )
      values (
        gen_random_uuid(), p_workspace_id, 'Stok Ödemesi', 'out', v_cash_paid,
        coalesce(v_stock.product_name, 'Stok') || ' alım ödemesi - ' || v_payee,
        'stock_items', p_stock_id::text, p_stock_id::text, 'active', auth.uid(), auth.uid()
      );
    else
      update public.cash_movements
         set movement_type = 'Stok Ödemesi',
             direction = 'out',
             amount = v_cash_paid,
             note = coalesce(v_stock.product_name, 'Stok') || ' alım ödemesi - ' || v_payee,
             related_table = 'stock_items',
             related_id = p_stock_id::text,
             related_stock_id = p_stock_id::text,
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
    and movement_type in (
      'Stok Ödemesi',
      'Alım Ödemesi',
      'Cihaz Alım Ödemesi',
      'Telefon Alım Ödemesi',
      'Stok Alım Ödemesi',
      'Aksesuar Alım Ödemesi',
      'Ürün Alım Ödemesi',
      'Tedarikçi Ödemesi'
    )
    and coalesce(status, 'active') <> 'deleted'
    and (
      related_id = p_stock_id::text
      or related_stock_id = p_stock_id::text
      or (related_table = 'stock_items' and related_id = p_stock_id::text)
    )
  order by created_at asc nulls last
  limit 1
  for update;

  if v_bank_paid > 0 then
    if v_bank_id is null then
      insert into public.bank_movements (
        id, workspace_id, movement_type, direction, bank_name, amount, note,
        related_table, related_id, related_stock_id, status, created_by, updated_by
      )
      values (
        gen_random_uuid(), p_workspace_id, 'Stok Ödemesi', 'out',
        nullif(trim(coalesce(p_bank_name, '')), ''),
        v_bank_paid,
        coalesce(v_stock.product_name, 'Stok') || ' banka alım ödemesi - ' || v_payee,
        'stock_items', p_stock_id::text, p_stock_id::text, 'active', auth.uid(), auth.uid()
      );
    else
      update public.bank_movements
         set movement_type = 'Stok Ödemesi',
             direction = 'out',
             bank_name = nullif(trim(coalesce(p_bank_name, '')), ''),
             amount = v_bank_paid,
             note = coalesce(v_stock.product_name, 'Stok') || ' banka alım ödemesi - ' || v_payee,
             related_table = 'stock_items',
             related_id = p_stock_id::text,
             related_stock_id = p_stock_id::text,
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

  if nullif(trim(coalesce(v_old_stock.supplier_name, '')), '') is not null then
    perform public.rebuild_supplier_payable(p_workspace_id, v_old_stock.supplier_name);
  end if;
  if v_supplier_name is not null and v_supplier_name is distinct from nullif(trim(coalesce(v_old_stock.supplier_name, '')), '') then
    perform public.rebuild_supplier_payable(p_workspace_id, v_supplier_name);
  end if;
  if nullif(trim(coalesce(v_old_stock.seller_person, '')), '') is not null then
    perform public.rebuild_seller_payable(p_workspace_id, v_old_stock.seller_person);
  end if;
  if v_seller_name is not null and v_seller_name is distinct from nullif(trim(coalesce(v_old_stock.seller_person, '')), '') then
    perform public.rebuild_seller_payable(p_workspace_id, v_seller_name);
  end if;

  return v_stock;
end;
$$;

do $$
declare
  fn record;
begin
  for fn in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'cancel_stock_purchase_with_effects'
  loop
    execute format('drop function if exists public.%I(%s)', fn.proname, pg_get_function_identity_arguments(fn.oid));
  end loop;
end $$;

create or replace function public.cancel_stock_purchase_with_effects(
  p_stock_id uuid,
  p_workspace_id text,
  p_reason text default null
)
returns public.stock_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock public.stock_items%rowtype;
  v_deleted public.stock_items%rowtype;
  v_cash record;
  v_bank record;
  v_reverse_type text;
  v_reverse_direction text;
  v_active_sale_count integer := 0;
begin
  select *
    into v_stock
  from public.stock_items
  where id = p_stock_id
    and workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'Stok kaydı bulunamadı veya workspace erişimi yok';
  end if;

  select count(*)
    into v_active_sale_count
  from public.sales
  where workspace_id = p_workspace_id
    and stock_item_id = p_stock_id
    and coalesce(status, 'active') not in ('deleted', 'cancelled');

  if v_active_sale_count > 0 then
    raise exception 'Bu cihaz satış kaydına bağlı olduğu için stoktan doğrudan silinemez';
  end if;

  v_reverse_type := case
    when coalesce(v_stock.module, '') = 'Cihaz' then 'Cihaz Alış İptali'
    else 'Stok Alış İptali'
  end;

  for v_cash in
    select *
    from public.cash_movements
    where workspace_id = p_workspace_id
      and coalesce(status, 'active') not in ('deleted', 'cancelled')
      and movement_type in (
        'Stok Ödemesi',
        'Alım Ödemesi',
        'Cihaz Alım Ödemesi',
        'Telefon Alım Ödemesi',
        'Stok Alım Ödemesi',
        'Aksesuar Alım Ödemesi',
        'Ürün Alım Ödemesi',
        'Tedarikçi Ödemesi'
      )
      and (
        related_id = p_stock_id::text
        or related_stock_id = p_stock_id::text
        or (related_table = 'stock_items' and related_id = p_stock_id::text)
      )
    for update
  loop
    if exists (
      select 1
      from public.cash_movements
      where workspace_id = p_workspace_id
        and reference_id = v_cash.id::text
        and movement_type in (
          'Stok Ödemesi İptali',
          'Alım Ödemesi İptali',
          'Cihaz Alış İptali',
          'Telefon Alış İptali',
          'Stok Alış İptali',
          'Tedarikçi Ödemesi İptali'
        )
        and coalesce(status, 'active') not in ('deleted', 'cancelled')
    ) then
      continue;
    end if;

    v_reverse_direction := case when coalesce(v_cash.direction, 'out') = 'out' then 'in' else 'out' end;

    insert into public.cash_movements (
      id,
      workspace_id,
      movement_type,
      direction,
      amount,
      note,
      related_table,
      related_id,
      related_stock_id,
      reference_id,
      status,
      created_by,
      updated_by
    )
    values (
      gen_random_uuid(),
      p_workspace_id,
      v_reverse_type,
      v_reverse_direction,
      abs(coalesce(v_cash.amount, 0)),
      'Stok alış iptali - ' || coalesce(v_stock.product_name, 'Stok'),
      'stock_items',
      p_stock_id::text,
      p_stock_id::text,
      v_cash.id::text,
      'active',
      auth.uid(),
      auth.uid()
    );
  end loop;

  for v_bank in
    select *
    from public.bank_movements
    where workspace_id = p_workspace_id
      and coalesce(status, 'active') not in ('deleted', 'cancelled')
      and movement_type in (
        'Stok Ödemesi',
        'Alım Ödemesi',
        'Cihaz Alım Ödemesi',
        'Telefon Alım Ödemesi',
        'Stok Alım Ödemesi',
        'Aksesuar Alım Ödemesi',
        'Ürün Alım Ödemesi',
        'Tedarikçi Ödemesi'
      )
      and (
        related_id = p_stock_id::text
        or related_stock_id = p_stock_id::text
        or (related_table = 'stock_items' and related_id = p_stock_id::text)
      )
    for update
  loop
    if exists (
      select 1
      from public.bank_movements
      where workspace_id = p_workspace_id
        and reference_id = v_bank.id::text
        and movement_type in (
          'Stok Ödemesi İptali',
          'Alım Ödemesi İptali',
          'Cihaz Alış İptali',
          'Telefon Alış İptali',
          'Stok Alış İptali',
          'Tedarikçi Ödemesi İptali'
        )
        and coalesce(status, 'active') not in ('deleted', 'cancelled')
    ) then
      continue;
    end if;

    v_reverse_direction := case when coalesce(v_bank.direction, 'out') = 'out' then 'in' else 'out' end;

    insert into public.bank_movements (
      id,
      workspace_id,
      movement_type,
      direction,
      bank_name,
      amount,
      note,
      related_table,
      related_id,
      related_stock_id,
      reference_id,
      status,
      created_by,
      updated_by
    )
    values (
      gen_random_uuid(),
      p_workspace_id,
      v_reverse_type,
      v_reverse_direction,
      coalesce(v_bank.bank_name, ''),
      abs(coalesce(v_bank.amount, 0)),
      'Stok alış iptali - ' || coalesce(v_stock.product_name, 'Stok'),
      'stock_items',
      p_stock_id::text,
      p_stock_id::text,
      v_bank.id::text,
      'active',
      auth.uid(),
      auth.uid()
    );
  end loop;

  update public.stock_items
     set status = 'deleted',
         updated_by = auth.uid(),
         updated_at = now()
   where id = p_stock_id
     and workspace_id = p_workspace_id
   returning * into v_deleted;

  if nullif(trim(coalesce(v_stock.supplier_name, '')), '') is not null then
    perform public.rebuild_supplier_payable(p_workspace_id, v_stock.supplier_name);
  end if;

  if nullif(trim(coalesce(v_stock.seller_person, '')), '') is not null then
    perform public.rebuild_seller_payable(p_workspace_id, v_stock.seller_person);
  end if;

  if to_regclass('public.audit_logs') is not null then
    begin
      insert into public.audit_logs (
        id, workspace_id, table_name, record_id, action, note, created_by
      )
      values (
        gen_random_uuid(), p_workspace_id, 'stock_items', p_stock_id,
        'purchase_cancel', coalesce(p_reason, 'Stok alış iptali'), auth.uid()
      );
    exception
      when others then
        null;
    end;
  end if;

  return v_deleted;
end;
$$;

comment on function public.create_sale_with_effects(text, text, text, uuid, text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, text) is
  'Satış kaydı, stok düşüşü, kasa/banka hareketi ve cari alacağı tek transaction içinde oluşturur.';

comment on function public.cancel_sale_with_effects(uuid, text, text) is
  'Satış iptali, bağlı kasa/banka hareketleri, stok iadesi ve cari alacağı tek transaction içinde günceller.';

comment on function public.refund_sale_with_effects(uuid, text, text) is
  'Satış iadesi için nakit/banka iade hareketleri, stok iadesi ve cari alacağı tek transaction içinde günceller.';

comment on function public.update_sale_with_effects(uuid, text, numeric, numeric, numeric, numeric, text, text, text, text, numeric, numeric, text) is
  'Satış düzeltmesi, nakit/banka hareketleri ve cari alacağı tek transaction içinde günceller.';

comment on function public.create_stock_with_effects(text, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, text, numeric, text, text, text, numeric, text) is
  'Stok/alış kaydı, stok ödeme hareketi ve tedarikçi/satıcı cari etkisini tek transaction içinde oluşturur.';

comment on function public.update_stock_with_effects(uuid, text, numeric, numeric, numeric, text, numeric, text, text, text, numeric, text, text) is
  'Alım/stok düzeltmesi, nakit/banka ödeme hareketleri ve tedarikçi/satıcı cari etkisini tek transaction içinde günceller.';

comment on function public.cancel_stock_purchase_with_effects(uuid, text, text) is
  'Stok alış iptali için güvenilir bağlantılı kasa/banka ters hareketleri ve stok kaldırmayı tek transaction içinde yapar.';

notify pgrst, 'reload schema';
