-- Fixes: infinite recursion (Postgres error 42P17) in the profiles_admin_all
-- and subscriptions_admin_all RLS policies defined in 0001_init.sql.
--
-- Root cause: "profiles_admin_all" checked admin status with
--   exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
-- — a query against profiles evaluated from WITHIN a policy on profiles
-- itself, which Postgres cannot resolve. This silently made every
-- profiles.role lookup fail for every user since the table was created; it
-- was invisible because a failed lookup defaults to "not admin", which
-- happened to be the correct answer for every non-admin account. It only
-- became visible once a real admin account needed the check to return true.
-- Confirmed live: a real authenticated session's query against profiles
-- returned exactly this 42P17 error before this fix, and a clean
-- {"role":"admin"} result after it.
--
-- Fix: check admin status via a SECURITY DEFINER function instead of a raw
-- subquery. Because the function runs with the privileges of its owner, its
-- internal query isn't re-subject to the same RLS policy that invoked it,
-- breaking the recursion.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from profiles where id = uid and role = 'admin');
$$;

drop policy if exists "profiles_admin_all" on profiles;
create policy "profiles_admin_all" on profiles for all using (public.is_admin(auth.uid()));

drop policy if exists "subscriptions_admin_all" on subscriptions;
create policy "subscriptions_admin_all" on subscriptions for all using (public.is_admin(auth.uid()));
