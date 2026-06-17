-- ============================================================
--  Creates the "mortgages" table the app's Mortgage tab needs.
--  Same ownership + security model as your other tables.
--  Safe to run more than once.
-- ============================================================

-- 1. The table, with the exact columns the app sends
create table if not exists public.mortgages (
  id          text primary key,
  user_id     uuid references auth.users(id) on delete cascade,
  date        text,
  amount      numeric,
  type        text,
  notes       text,
  "createdAt" bigint
);

-- 2. Index on the ownership column
create index if not exists idx_mortgages_user_id on public.mortgages(user_id);

-- 3. Lock it down so each user only sees their own rows
alter table public.mortgages enable row level security;

drop policy if exists owner_all_mortgages on public.mortgages;
create policy owner_all_mortgages on public.mortgages
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 4. Confirm
select 'mortgages table ready' as status;
