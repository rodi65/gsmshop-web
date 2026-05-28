-- CEPLOG repair: kartli satis kayitlarindan eksik Bankaya Giden hareketlerini tamamla.
-- Veri silmez. Aktif satislarda card_amount > 0 olup ilgili bank_movements yoksa tek hareket ekler.

create extension if not exists pgcrypto;

alter table public.bank_movements
  add column if not exists workspace_id text,
  add column if not exists direction text,
  add column if not exists related_sale_id uuid,
  add column if not exists related_table text,
  add column if not exists related_id text,
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz not null default now();

update public.bank_movements
set direction = case when movement_type = 'Bankadan Çekilen' then 'out' else 'in' end
where direction is null;

update public.bank_movements
set status = 'active'
where status is null;

alter table public.bank_movements alter column direction set default 'in';
alter table public.bank_movements alter column status set default 'active';

create index if not exists bank_movements_related_sale_idx
on public.bank_movements(related_sale_id);

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
        'Komisyon',
        'Düzeltme',
        'Teknik Servis Geliri',
        'Teknik Servis Kaparo',
        'Teknik Servis Tahsilat',
        'Teknik Servis İade',
        'Alım Ödemesi',
        'Cihaz Alım Ödemesi',
        'Telefon Alım Ödemesi',
        'Stok Alım Ödemesi',
        'Stok Ödemesi',
        'Aksesuar Alım Ödemesi',
        'Ürün Alım Ödemesi',
        'Tedarikçi Ödemesi',
        'Alım İptali',
        'Stok Ödemesi İptali',
        'Alım Ödemesi İptali',
        'Tedarikçi Ödemesi İptali'
      )
    );
end $$;

create or replace function public.repair_missing_sale_bank_movements(
  p_workspace_id text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id text := nullif(trim(coalesce(p_workspace_id, '')), '');
  v_inserted integer := 0;
begin
  insert into public.bank_movements (
    id,
    workspace_id,
    movement_type,
    direction,
    bank_name,
    amount,
    note,
    related_sale_id,
    related_table,
    related_id,
    status,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  select
    gen_random_uuid(),
    s.workspace_id,
    'Bankaya Giden',
    'in',
    s.bank_name,
    coalesce(s.card_amount, 0),
    coalesce(s.product_name, 'Satış') || ' kart/banka tahsilat',
    s.id,
    'sales',
    s.id::text,
    'active',
    s.created_by,
    s.updated_by,
    coalesce(s.created_at, now()),
    now()
  from public.sales s
  where coalesce(s.status, 'active') = 'active'
    and coalesce(s.card_amount, 0) > 0
    and nullif(trim(coalesce(s.bank_name, '')), '') is not null
    and (v_workspace_id is null or s.workspace_id = v_workspace_id)
    and not exists (
      select 1
      from public.bank_movements bm
      where bm.workspace_id = s.workspace_id
        and coalesce(bm.status, 'active') <> 'deleted'
        and (
          bm.related_sale_id = s.id
          or (
            bm.related_table = 'sales'
            and bm.related_id = s.id::text
          )
        )
    );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

grant execute on function public.repair_missing_sale_bank_movements(text) to authenticated;

select public.repair_missing_sale_bank_movements() as repaired_bank_movements;

notify pgrst, 'reload schema';
