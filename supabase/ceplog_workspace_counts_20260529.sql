-- CEPLOG workspace veri sayim raporu
-- Read-only: veri silmez, tablo degistirmez.
-- Eksik tablolar otomatik atlanir.

create temp table if not exists ceplog_workspace_counts_result (
  table_name text,
  workspace_id text,
  row_count bigint
) on commit drop;

truncate ceplog_workspace_counts_result;

do $$
declare
  v_table text;
  v_has_workspace boolean;
  v_tables text[] := array[
    'ledger_entries',
    'return_items',
    'returns',
    'exchanges',
    'sale_items',
    'stock_movements',
    'cari_movements',
    'pos_movements',
    'cash_movements',
    'bank_movements',
    'cash_closings',
    'expenses',
    'sales',
    'technical_services',
    'stock_items',
    'contacts',
    'business_transactions',
    'audit_logs'
  ];
begin
  foreach v_table in array v_tables loop
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = v_table
        and column_name = 'workspace_id'
    )
    into v_has_workspace;

    if to_regclass(format('public.%I', v_table)) is not null and v_has_workspace then
      execute format(
        'insert into ceplog_workspace_counts_result(table_name, workspace_id, row_count)
         select %L, workspace_id::text, count(*)::bigint
         from public.%I
         group by workspace_id
         having count(*) > 0',
        v_table,
        v_table
      );
    end if;
  end loop;
end $$;

select table_name, workspace_id, row_count
from ceplog_workspace_counts_result
order by workspace_id, table_name;
