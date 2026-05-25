-- CEPLOG BANK MOVEMENTS related_id DÜZELTME
-- Veri silmez, tablo drop etmez.

alter table public.bank_movements
  add column if not exists related_id text,
  add column if not exists direction text,
  add column if not exists related_service_id text,
  add column if not exists service_record_id text,
  add column if not exists reference_id text;

alter table public.cash_movements
  add column if not exists related_id text,
  add column if not exists related_service_id text,
  add column if not exists service_record_id text,
  add column if not exists reference_id text;

update public.bank_movements
set direction = 'in'
where direction is null;

alter table public.bank_movements
  drop constraint if exists bank_movements_direction_check;

alter table public.bank_movements
  add constraint bank_movements_direction_check
  check (
    direction is null or direction in ('in', 'out')
  );

notify pgrst, 'reload schema';
