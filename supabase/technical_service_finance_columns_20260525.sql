-- CEPLOG Teknik Servis finans kolonlari ve schema cache yenileme
-- Bu dosyayi Supabase SQL Editor'da manuel calistirin.
-- Veri silmez, tablo drop etmez.

alter table public.cash_movements
  add column if not exists related_service_id text,
  add column if not exists service_record_id text,
  add column if not exists reference_id text;

alter table public.bank_movements
  add column if not exists direction text,
  add column if not exists related_table text,
  add column if not exists related_id text,
  add column if not exists related_service_id text,
  add column if not exists service_record_id text,
  add column if not exists reference_id text,
  add column if not exists status text;

update public.bank_movements
set direction = case when movement_type = 'Bankadan Çekilen' then 'out' else 'in' end
where direction is null;

update public.bank_movements
set status = 'active'
where status is null;

alter table public.bank_movements alter column direction set default 'in';
alter table public.bank_movements alter column status set default 'active';

alter table public.bank_movements drop constraint if exists bank_movements_direction_check;
alter table public.bank_movements
add constraint bank_movements_direction_check
check (direction in ('in', 'out'));

alter table public.bank_movements drop constraint if exists bank_movements_status_check;
alter table public.bank_movements
add constraint bank_movements_status_check
check (status in ('active', 'cancelled', 'deleted'));

do $$
declare
  constraint_name text;
begin
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
        'İade Nakit',
        'Teknik Servis Geliri',
        'Teknik Servis Kaparo',
        'Teknik Servis Tahsilat',
        'Teknik Servis İade'
      )
    );
exception
  when undefined_table then
    null;
end $$;

do $$
declare
  constraint_name text;
begin
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
        'Teknik Servis Geliri',
        'Teknik Servis Kaparo',
        'Teknik Servis Tahsilat',
        'Teknik Servis İade',
        'Düzeltme'
      )
    );
exception
  when undefined_table then
    null;
end $$;

create index if not exists cash_movements_related_service_idx
on public.cash_movements(related_service_id);

create index if not exists cash_movements_service_record_idx
on public.cash_movements(service_record_id);

create index if not exists cash_movements_reference_idx
on public.cash_movements(reference_id);

create index if not exists bank_movements_related_idx
on public.bank_movements(related_table, related_id);

create index if not exists bank_movements_related_service_idx
on public.bank_movements(related_service_id);

create index if not exists bank_movements_service_record_idx
on public.bank_movements(service_record_id);

create index if not exists bank_movements_reference_idx
on public.bank_movements(reference_id);

notify pgrst, 'reload schema';
