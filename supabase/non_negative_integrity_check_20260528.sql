-- CEPLOG non-negative integrity check
-- Supabase SQL Editor'da calistirilir.
-- Amac: NOT VALID eklenen korumalari validate etmeden once eski veride negatif kayit var mi gormek.
-- Bu dosya kalici veri degistirmez, silmez; sadece oturumluk gecici rapor tablosu uretir.

create temporary table if not exists ceplog_negative_integrity_report (
  table_name text,
  record_id text,
  field_name text,
  bad_value numeric,
  label text,
  created_at timestamptz
) on commit drop;

truncate table ceplog_negative_integrity_report;

do $$
begin
  if to_regclass('public.stock_items') is not null then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'stock_items' and column_name = 'quantity') then
      insert into ceplog_negative_integrity_report
      select 'stock_items', id::text, 'quantity', quantity::numeric, product_name, created_at
      from public.stock_items
      where quantity < 0;
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'stock_items' and column_name = 'buy_price') then
      insert into ceplog_negative_integrity_report
      select 'stock_items', id::text, 'buy_price', buy_price, product_name, created_at
      from public.stock_items
      where buy_price < 0;
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'stock_items' and column_name = 'sell_price') then
      insert into ceplog_negative_integrity_report
      select 'stock_items', id::text, 'sell_price', sell_price, product_name, created_at
      from public.stock_items
      where sell_price < 0;
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'stock_items' and column_name = 'supplier_paid') then
      insert into ceplog_negative_integrity_report
      select 'stock_items', id::text, 'supplier_paid', supplier_paid, product_name, created_at
      from public.stock_items
      where supplier_paid < 0;
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'stock_items' and column_name = 'seller_cari_remaining') then
      insert into ceplog_negative_integrity_report
      select 'stock_items', id::text, 'seller_cari_remaining', seller_cari_remaining, product_name, created_at
      from public.stock_items
      where seller_cari_remaining < 0;
    end if;
  end if;

  if to_regclass('public.sales') is not null then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales' and column_name = 'total_amount') then
      insert into ceplog_negative_integrity_report
      select 'sales', id::text, 'total_amount', total_amount, product_name, created_at
      from public.sales
      where total_amount < 0;
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales' and column_name = 'cash_amount') then
      insert into ceplog_negative_integrity_report
      select 'sales', id::text, 'cash_amount', cash_amount, product_name, created_at
      from public.sales
      where cash_amount < 0;
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales' and column_name = 'card_amount') then
      insert into ceplog_negative_integrity_report
      select 'sales', id::text, 'card_amount', card_amount, product_name, created_at
      from public.sales
      where card_amount < 0;
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales' and column_name = 'remaining_amount') then
      insert into ceplog_negative_integrity_report
      select 'sales', id::text, 'remaining_amount', remaining_amount, product_name, created_at
      from public.sales
      where remaining_amount < 0;
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales' and column_name = 'buy_cost') then
      insert into ceplog_negative_integrity_report
      select 'sales', id::text, 'buy_cost', buy_cost, product_name, created_at
      from public.sales
      where buy_cost < 0;
    end if;
  end if;

  if to_regclass('public.expenses') is not null
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'expenses' and column_name = 'amount') then
    insert into ceplog_negative_integrity_report
    select 'expenses', id::text, 'amount', amount, category, created_at
    from public.expenses
    where amount < 0;
  end if;

  if to_regclass('public.cash_movements') is not null
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cash_movements' and column_name = 'amount') then
    insert into ceplog_negative_integrity_report
    select 'cash_movements', id::text, 'amount', amount, movement_type, created_at
    from public.cash_movements
    where amount < 0;
  end if;

  if to_regclass('public.bank_movements') is not null then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bank_movements' and column_name = 'amount') then
      insert into ceplog_negative_integrity_report
      select 'bank_movements', id::text, 'amount', amount, bank_name, created_at
      from public.bank_movements
      where amount < 0;
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bank_movements' and column_name = 'commission_rate') then
      insert into ceplog_negative_integrity_report
      select 'bank_movements', id::text, 'commission_rate', commission_rate::numeric, bank_name, created_at
      from public.bank_movements
      where commission_rate < 0;
    end if;
  end if;

  if to_regclass('public.contacts') is not null
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'contacts' and column_name = 'balance') then
    insert into ceplog_negative_integrity_report
    select 'contacts', id::text, 'balance', balance, name, created_at
    from public.contacts
    where balance < 0;
  end if;
end $$;

select
  table_name,
  field_name,
  count(*) as problem_count,
  min(created_at) as first_seen_at,
  max(created_at) as last_seen_at
from ceplog_negative_integrity_report
group by table_name, field_name
order by table_name, field_name;

select
  table_name,
  record_id,
  field_name,
  bad_value,
  label,
  created_at
from ceplog_negative_integrity_report
order by created_at desc nulls last
limit 100;
