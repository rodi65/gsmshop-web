-- CEPLOG bank_movements direction kolon fix
-- Bu dosyayi Supabase SQL Editor'da manuel calistirin.
-- Veri silmez, tablo drop etmez.

alter table public.bank_movements
  add column if not exists direction text;

update public.bank_movements
set direction = 'in'
where direction is null;

alter table public.bank_movements drop constraint if exists bank_movements_direction_check;
alter table public.bank_movements
add constraint bank_movements_direction_check
check (direction is null or direction in ('in', 'out'));

notify pgrst, 'reload schema';
