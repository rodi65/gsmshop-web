-- CEPLOG CLEAN RESET
-- Kullanıcı / profil / workspace yapısını silmez.
-- Ticari verileri temizler.
-- Yeni müşteri veya test sıfırlama için kullanılır.

do $$
declare
  r record;
begin

  if to_regclass('public.bank_movements') is not null then
    delete from public.bank_movements;
  end if;

  if to_regclass('public.cash_movements') is not null then
    delete from public.cash_movements;
  end if;

  if to_regclass('public.sales') is not null then
    delete from public.sales;
  end if;

  if to_regclass('public.stock_items') is not null then
    delete from public.stock_items;
  end if;

  if to_regclass('public.contacts') is not null then
    delete from public.contacts;
  end if;

  if to_regclass('public.expenses') is not null then
    delete from public.expenses;
  end if;

  if to_regclass('public.cash_closings') is not null then
    delete from public.cash_closings;
  end if;

  for r in
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
      and table_name not in (
        'profiles',
        'workspaces',
        'workspace_members',
        'users',
        'auth_users'
      )
  loop
    begin
      execute format('delete from public.%I', r.table_name);
    exception
      when foreign_key_violation then
        null;
      when undefined_table then
        null;
    end;
  end loop;

end $$;

notify pgrst, 'reload schema';
