-- CEPLOG non-negative integrity guards
-- Supabase SQL Editor'da calistirilir.
-- Amac: yeni/duzenlenen kayitlarda negatif stok, kasa, banka ve cari tutarini veritabani seviyesinde engellemek.
-- Not: NOT VALID kullanildigi icin mevcut eski kayitlari zorla degistirmez; sonraki insert/update islemlerini korur.

begin;

do $$
begin
  if to_regclass('public.stock_items') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'stock_items' and column_name = 'quantity'
    ) and not exists (
      select 1 from pg_constraint
      where conrelid = 'public.stock_items'::regclass and conname = 'stock_items_quantity_non_negative'
    ) then
      alter table public.stock_items
        add constraint stock_items_quantity_non_negative
        check (quantity >= 0) not valid;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'stock_items' and column_name = 'buy_price'
    ) and not exists (
      select 1 from pg_constraint
      where conrelid = 'public.stock_items'::regclass and conname = 'stock_items_buy_price_non_negative'
    ) then
      alter table public.stock_items
        add constraint stock_items_buy_price_non_negative
        check (buy_price >= 0) not valid;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'stock_items' and column_name = 'sell_price'
    ) and not exists (
      select 1 from pg_constraint
      where conrelid = 'public.stock_items'::regclass and conname = 'stock_items_sell_price_non_negative'
    ) then
      alter table public.stock_items
        add constraint stock_items_sell_price_non_negative
        check (sell_price >= 0) not valid;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'stock_items' and column_name = 'supplier_paid'
    ) and not exists (
      select 1 from pg_constraint
      where conrelid = 'public.stock_items'::regclass and conname = 'stock_items_supplier_paid_non_negative'
    ) then
      alter table public.stock_items
        add constraint stock_items_supplier_paid_non_negative
        check (supplier_paid >= 0) not valid;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'stock_items' and column_name = 'seller_cari_remaining'
    ) and not exists (
      select 1 from pg_constraint
      where conrelid = 'public.stock_items'::regclass and conname = 'stock_items_seller_cari_remaining_non_negative'
    ) then
      alter table public.stock_items
        add constraint stock_items_seller_cari_remaining_non_negative
        check (seller_cari_remaining >= 0) not valid;
    end if;
  end if;

  if to_regclass('public.sales') is not null then
    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.sales'::regclass and conname = 'sales_amounts_non_negative'
    ) then
      alter table public.sales
        add constraint sales_amounts_non_negative
        check (
          total_amount >= 0
          and cash_amount >= 0
          and card_amount >= 0
          and remaining_amount >= 0
          and buy_cost >= 0
        ) not valid;
    end if;
  end if;

  if to_regclass('public.expenses') is not null then
    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.expenses'::regclass and conname = 'expenses_amount_non_negative'
    ) then
      alter table public.expenses
        add constraint expenses_amount_non_negative
        check (amount >= 0) not valid;
    end if;
  end if;

  if to_regclass('public.cash_movements') is not null then
    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.cash_movements'::regclass and conname = 'cash_movements_amount_non_negative'
    ) then
      alter table public.cash_movements
        add constraint cash_movements_amount_non_negative
        check (amount >= 0) not valid;
    end if;
  end if;

  if to_regclass('public.bank_movements') is not null then
    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.bank_movements'::regclass and conname = 'bank_movements_amount_non_negative'
    ) then
      alter table public.bank_movements
        add constraint bank_movements_amount_non_negative
        check (amount >= 0) not valid;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'bank_movements' and column_name = 'commission_rate'
    ) and not exists (
      select 1 from pg_constraint
      where conrelid = 'public.bank_movements'::regclass and conname = 'bank_movements_commission_rate_non_negative'
    ) then
      alter table public.bank_movements
        add constraint bank_movements_commission_rate_non_negative
        check (commission_rate >= 0) not valid;
    end if;
  end if;

  if to_regclass('public.contacts') is not null then
    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.contacts'::regclass and conname = 'contacts_balance_non_negative'
    ) then
      alter table public.contacts
        add constraint contacts_balance_non_negative
        check (balance >= 0) not valid;
    end if;
  end if;
end $$;

commit;

select
  conrelid::regclass as table_name,
  conname as constraint_name,
  convalidated as validated_for_existing_rows
from pg_constraint
where conname in (
  'stock_items_quantity_non_negative',
  'stock_items_buy_price_non_negative',
  'stock_items_sell_price_non_negative',
  'stock_items_supplier_paid_non_negative',
  'stock_items_seller_cari_remaining_non_negative',
  'sales_amounts_non_negative',
  'expenses_amount_non_negative',
  'cash_movements_amount_non_negative',
  'bank_movements_amount_non_negative',
  'bank_movements_commission_rate_non_negative',
  'contacts_balance_non_negative'
)
order by conrelid::regclass::text, conname;
