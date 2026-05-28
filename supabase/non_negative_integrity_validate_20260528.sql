-- CEPLOG non-negative guard validation
-- Run after supabase/non_negative_integrity_check_20260528.sql returns no rows.
-- This file does not delete or update business data.

do $$
declare
  guard record;
begin
  for guard in
    select *
    from (values
      ('public.stock_items', 'stock_items_quantity_non_negative'),
      ('public.stock_items', 'stock_items_buy_price_non_negative'),
      ('public.stock_items', 'stock_items_sell_price_non_negative'),
      ('public.stock_items', 'stock_items_supplier_paid_non_negative'),
      ('public.stock_items', 'stock_items_seller_cari_remaining_non_negative'),
      ('public.sales', 'sales_amounts_non_negative'),
      ('public.expenses', 'expenses_amount_non_negative'),
      ('public.cash_movements', 'cash_movements_amount_non_negative'),
      ('public.bank_movements', 'bank_movements_amount_non_negative'),
      ('public.bank_movements', 'bank_movements_commission_rate_non_negative'),
      ('public.contacts', 'contacts_balance_non_negative')
    ) as guards(table_name, constraint_name)
    where to_regclass(guards.table_name) is not null
      and exists (
        select 1
        from pg_constraint
        where conrelid = to_regclass(guards.table_name)
          and conname = guards.constraint_name
      )
  loop
    execute format(
      'alter table %s validate constraint %I',
      guard.table_name,
      guard.constraint_name
    );
  end loop;
end $$;

select
  conrelid::regclass::text as table_name,
  conname as constraint_name,
  convalidated as validated_for_old_rows
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
