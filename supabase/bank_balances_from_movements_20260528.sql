-- CEPLOG banka bakiyelerini bank_movements hareketlerinden turetme
-- Bu dosyayi Supabase SQL Editor'da manuel calistirin.
-- Veri silmez, tablo drop etmez.

alter table public.bank_movements
  add column if not exists direction text,
  add column if not exists status text,
  add column if not exists workspace_id text;

update public.bank_movements
set workspace_id = 'main'
where workspace_id is null;

update public.bank_movements
set direction = case
  when movement_type in (
    'Bankadan Çekilen',
    'Teknik Servis İade',
    'Teknik Servis İadesi',
    'Alım Ödemesi',
    'Cihaz Alım Ödemesi',
    'Telefon Alım Ödemesi',
    'Stok Alım Ödemesi',
    'Stok Ödemesi',
    'Aksesuar Alım Ödemesi',
    'Ürün Alım Ödemesi',
    'Tedarikçi Ödemesi'
  ) then 'out'
  else 'in'
end
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

create index if not exists idx_bank_movements_workspace_bank
on public.bank_movements(workspace_id, bank_name);

create or replace view public.bank_balances_from_movements as
select
  movement_rows.workspace_id,
  movement_rows.bank_name,
  coalesce(sum(case when movement_rows.derived_direction = 'in' then movement_rows.amount else 0 end), 0)::numeric(14,2) as total_in,
  coalesce(sum(case when movement_rows.derived_direction = 'out' then movement_rows.amount else 0 end), 0)::numeric(14,2) as total_out,
  coalesce(sum(case when movement_rows.derived_direction = 'in' then movement_rows.amount else -movement_rows.amount end), 0)::numeric(14,2) as balance,
  count(*)::bigint as movement_count,
  max(movement_rows.created_at) as last_movement_at
from (
  select
    coalesce(workspace_id, 'main') as workspace_id,
    bank_name,
    coalesce(amount, 0) as amount,
    created_at,
    case
      when coalesce(direction, '') in ('in', 'out') then direction
      when movement_type in (
        'Bankadan Çekilen',
        'Teknik Servis İade',
        'Teknik Servis İadesi',
        'Alım Ödemesi',
        'Cihaz Alım Ödemesi',
        'Telefon Alım Ödemesi',
        'Stok Alım Ödemesi',
        'Stok Ödemesi',
        'Aksesuar Alım Ödemesi',
        'Ürün Alım Ödemesi',
        'Tedarikçi Ödemesi'
      ) then 'out'
      else 'in'
    end as derived_direction
  from public.bank_movements
  where coalesce(status, 'active') = 'active'
    and nullif(trim(bank_name), '') is not null
) as movement_rows
group by movement_rows.workspace_id, movement_rows.bank_name;

create or replace function public.get_bank_balances(p_workspace_id text default null)
returns table (
  bank_name text,
  total_in numeric,
  total_out numeric,
  balance numeric,
  movement_count bigint,
  last_movement_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    balances.bank_name,
    balances.total_in,
    balances.total_out,
    balances.balance,
    balances.movement_count,
    balances.last_movement_at
  from public.bank_balances_from_movements balances
  where balances.workspace_id = coalesce(
    nullif(p_workspace_id, ''),
    (
      select nullif(profile.workspace_id, '')
      from public.profiles profile
      where profile.id = auth.uid()
      limit 1
    ),
    'main'
  )
  order by balances.bank_name;
$$;

grant execute on function public.get_bank_balances(text) to authenticated;

notify pgrst, 'reload schema';
