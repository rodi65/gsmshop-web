-- CEPLOG workspace bazli guvenli test reset
-- Sadece asagidaki v_target_workspace_id icin ticari/test verilerini siler.
-- profiles, users, auth, workspace ayarlari ve tablo yapisi silinmez.

do $$
declare
  v_target_workspace_id text := 'BURAYA_WORKSPACE_ID_YAZ';
  v_table text;
  v_deleted bigint;
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
  if v_target_workspace_id = 'BURAYA_WORKSPACE_ID_YAZ' or nullif(trim(v_target_workspace_id), '') is null then
    raise exception 'v_target_workspace_id alanina temizlenecek workspace_id yazilmali.';
  end if;

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
      execute format('delete from public.%I where workspace_id::text = $1', v_table)
      using v_target_workspace_id;

      get diagnostics v_deleted = row_count;
      raise notice 'Temizlendi: %, adet: %', v_table, v_deleted;
    else
      raise notice 'Atlandi: % tablo yok veya workspace_id yok', v_table;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
