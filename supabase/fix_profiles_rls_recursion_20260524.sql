-- CEPLOG profiles RLS recursion fix
-- Bu dosyayi Supabase SQL Editor'da manuel calistirin.
-- profiles policy icinde profiles tablosunu tekrar sorgulayan policy birakmaz.

alter table public.profiles enable row level security;

drop policy if exists "profiles_authenticated_all" on public.profiles;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_read_authenticated" on public.profiles;
drop policy if exists "profiles_owner_admin_all" on public.profiles;
drop policy if exists "profiles_admin_all" on public.profiles;
drop policy if exists "profiles_owner_read_all" on public.profiles;
drop policy if exists "profiles_workspace_read" on public.profiles;

do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and (
        qual ilike '%profiles%'
        or with_check ilike '%profiles%'
      )
  loop
    execute format('drop policy if exists %I on public.profiles', policy_name);
  end loop;
end $$;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());
