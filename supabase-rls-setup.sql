-- ============================================================
--  Apartment Manager — Row Level Security (RLS) setup
-- ============================================================
--
--  WHY THIS MATTERS
--  Your anon key is shipped inside the app's HTML. That is only
--  safe if RLS is ON for every table. Without these policies,
--  anyone who opens the page can read (or modify, or delete)
--  EVERY landlord's tenants, phone numbers, IDs, and finances.
--
--  HOW TO RUN
--  1. Open your Supabase project dashboard
--  2. Left sidebar -> SQL Editor -> New query
--  3. Paste this whole file
--  4. Click "Run"
--  5. Check the result table at the bottom: every table that
--     exists should show rowsecurity = true and policy_count = 1.
--
--  SAFE TO RUN MORE THAN ONCE. Tables that don't exist yet are
--  skipped automatically (so a missing "mortgages" table is fine).
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array['rooms','bills','payments','expenses','maintenance','mortgages','settings']
  loop
    -- Skip any table that doesn't exist in this project
    if to_regclass('public.' || t) is null then
      raise notice 'Skipping %, table does not exist', t;
      continue;
    end if;

    -- 1. Make sure the ownership column exists
    execute format(
      'alter table public.%I add column if not exists user_id uuid references auth.users(id) on delete cascade;',
      t
    );

    -- 2. Index it (every query filters by user_id)
    execute format(
      'create index if not exists %I on public.%I(user_id);',
      'idx_' || t || '_user_id', t
    );

    -- 3. Turn on Row Level Security
    execute format('alter table public.%I enable row level security;', t);

    -- 4. Owner-only policy covering select / insert / update / delete
    execute format('drop policy if exists %I on public.%I;', 'owner_all_' || t, t);
    execute format($f$
      create policy %I on public.%I
        for all
        to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $f$, 'owner_all_' || t, t);

    raise notice 'Secured %', t;
  end loop;
end $$;


-- ------------------------------------------------------------
--  VERIFY — every existing table should show rowsecurity = true
--  and policy_count = 1.
-- ------------------------------------------------------------
select
  c.relname        as table_name,
  c.relrowsecurity as rowsecurity,
  count(p.polname) as policy_count
from pg_class c
left join pg_policy p on p.polrelid = c.oid
where c.relname in ('rooms','bills','payments','expenses','maintenance','mortgages','settings')
  and c.relnamespace = 'public'::regnamespace
group by c.relname, c.relrowsecurity
order by c.relname;
