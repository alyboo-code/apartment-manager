-- ============================================================
--  Apartment Manager — CANONICAL DATABASE SCHEMA
-- ============================================================
--  This is the single source of truth for the Supabase database.
--  It is idempotent and SAFE TO RE-RUN any time: it creates
--  missing tables, adds missing columns, and (re)applies Row
--  Level Security with owner-only policies.
--
--  HOW TO RUN
--    Supabase dashboard -> SQL Editor -> New query -> paste -> Run
--
--  ⭐ WHEN YOU ADD A NEW FIELD IN index.html
--    Add the matching column to the right table below and re-run
--    this file. If you skip this, saving that field will FAIL
--    (the app now shows a red "NOT saved" warning when it does).
--    Column names that are camelCase MUST stay "double-quoted".
-- ============================================================


-- ---------- ROOMS ----------
create table if not exists public.rooms (id text primary key);
alter table public.rooms add column if not exists user_id        uuid references auth.users(id) on delete cascade;
alter table public.rooms add column if not exists number         text;
alter table public.rooms add column if not exists tenant         text;
alter table public.rooms add column if not exists type           text default 'regular';
alter table public.rooms add column if not exists persons        int  default 1;
alter table public.rooms add column if not exists rent           numeric default 0;
alter table public.rooms add column if not exists wifi           boolean default false;
alter table public.rooms add column if not exists active         boolean;
alter table public.rooms add column if not exists status         text default 'active';
alter table public.rooms add column if not exists phone          text;
alter table public.rooms add column if not exists email          text;
alter table public.rooms add column if not exists "moveIn"       text;
alter table public.rooms add column if not exists "moveOut"      text;
alter table public.rooms add column if not exists "idType"       text;
alter table public.rooms add column if not exists deposit        numeric default 0;
alter table public.rooms add column if not exists advance        numeric default 0;
alter table public.rooms add column if not exists "depositDate"  text;
alter table public.rooms add column if not exists "depositNotes" text;
alter table public.rooms add column if not exists "ecName"       text;
alter table public.rooms add column if not exists "ecRel"        text;
alter table public.rooms add column if not exists "ecPhone"      text;
alter table public.rooms add column if not exists notes          text;

-- ---------- BILLS ----------
create table if not exists public.bills (id text primary key);
alter table public.bills add column if not exists user_id       uuid references auth.users(id) on delete cascade;
alter table public.bills add column if not exists "roomId"      text;
alter table public.bills add column if not exists period        text;
alter table public.bills add column if not exists rent          numeric default 0;
alter table public.bills add column if not exists "prevReading" numeric default 0;
alter table public.bills add column if not exists "currReading" numeric default 0;
alter table public.bills add column if not exists "kWh"         numeric default 0;
alter table public.bills add column if not exists electricity   numeric default 0;
alter table public.bills add column if not exists persons       int default 1;
alter table public.bills add column if not exists water         numeric default 0;
alter table public.bills add column if not exists wifi          numeric default 0;
alter table public.bills add column if not exists "prevBalance" numeric default 0;
alter table public.bills add column if not exists "carryIn"     numeric default 0;
alter table public.bills add column if not exists "totalDue"    numeric default 0;
alter table public.bills add column if not exists "paidAmount"  numeric default 0;
alter table public.bills add column if not exists balance       numeric default 0;
alter table public.bills add column if not exists status        text default 'unpaid';
alter table public.bills add column if not exists "tenantName"  text;
alter table public.bills add column if not exists "roomNumber"  text;
alter table public.bills add column if not exists "createdAt"   bigint;

-- ---------- PAYMENTS ----------
create table if not exists public.payments (id text primary key);
alter table public.payments add column if not exists user_id     uuid references auth.users(id) on delete cascade;
alter table public.payments add column if not exists "billId"    text;
alter table public.payments add column if not exists date        text;
alter table public.payments add column if not exists amount      numeric default 0;
alter table public.payments add column if not exists mode        text;
alter table public.payments add column if not exists notes       text;
alter table public.payments add column if not exists "createdAt" bigint;

-- ---------- EXPENSES ----------
create table if not exists public.expenses (id text primary key);
alter table public.expenses add column if not exists user_id     uuid references auth.users(id) on delete cascade;
alter table public.expenses add column if not exists date        text;
alter table public.expenses add column if not exists description text;
alter table public.expenses add column if not exists category    text;
alter table public.expenses add column if not exists amount      numeric default 0;
alter table public.expenses add column if not exists "createdAt" bigint;

-- ---------- MAINTENANCE ----------
create table if not exists public.maintenance (id text primary key);
alter table public.maintenance add column if not exists user_id        uuid references auth.users(id) on delete cascade;
alter table public.maintenance add column if not exists date           text;
alter table public.maintenance add column if not exists "roomId"       text;
alter table public.maintenance add column if not exists category       text;
alter table public.maintenance add column if not exists description    text;
alter table public.maintenance add column if not exists "reportedBy"   text;
alter table public.maintenance add column if not exists "assignedTo"   text;
alter table public.maintenance add column if not exists status         text default 'open';
alter table public.maintenance add column if not exists "resolvedDate" text;
alter table public.maintenance add column if not exists cost           numeric default 0;
alter table public.maintenance add column if not exists notes          text;
alter table public.maintenance add column if not exists "createdAt"    bigint;

-- ---------- MORTGAGES ----------
create table if not exists public.mortgages (id text primary key);
alter table public.mortgages add column if not exists user_id     uuid references auth.users(id) on delete cascade;
alter table public.mortgages add column if not exists date        text;
alter table public.mortgages add column if not exists amount      numeric default 0;
alter table public.mortgages add column if not exists type        text;
alter table public.mortgages add column if not exists notes       text;
alter table public.mortgages add column if not exists "createdAt" bigint;

-- ---------- SETTINGS (one row per user) ----------
create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  config  jsonb not null default '{}'
);


-- ============================================================
--  INDEXES + ROW LEVEL SECURITY (owner-only, with WITH CHECK)
--  WITH CHECK stops a user from inserting/updating a row that
--  claims someone else's user_id — closes the gap your old
--  "own rows" policies (USING only) left open.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['rooms','bills','payments','expenses','maintenance','mortgages','settings']
  loop
    execute format('create index if not exists %I on public.%I(user_id);', 'idx_'||t||'_user_id', t);
    execute format('alter table public.%I enable row level security;', t);
    -- remove the old USING-only policy if it exists, plus our own
    execute format('drop policy if exists "own rows" on public.%I;', t);
    execute format('drop policy if exists %I on public.%I;', 'owner_all_'||t, t);
    execute format($f$
      create policy %I on public.%I
        for all to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $f$, 'owner_all_'||t, t);
  end loop;
end $$;


-- ---------- VERIFY ----------
select c.relname as table_name, c.relrowsecurity as rls_on, count(p.polname) as policies
from pg_class c
left join pg_policy p on p.polrelid = c.oid
where c.relnamespace = 'public'::regnamespace
  and c.relname in ('rooms','bills','payments','expenses','maintenance','mortgages','settings')
group by c.relname, c.relrowsecurity
order by c.relname;


-- ============================================================
--  FOREIGN KEYS — intentionally OPTIONAL (left commented out)
-- ============================================================
--  This app deliberately KEEPS bills/payments when a room is deleted, and
--  shows the tenant via a snapshot stored on the bill. So strict foreign keys
--  are a poor fit: they'd either block room deletion or cascade-delete the
--  history you want to preserve. The app already tolerates missing references.
--
--  If you ever want referential integrity that is still compatible with that
--  design, uncomment these. ON DELETE SET NULL keeps the row but clears the
--  dangling link; NOT VALID lets existing historical orphans stay as-is.
--
--  alter table public.bills       add constraint fk_bills_room
--    foreign key ("roomId") references public.rooms(id) on delete set null not valid;
--  alter table public.payments    add constraint fk_payments_bill
--    foreign key ("billId") references public.bills(id) on delete set null not valid;
--  alter table public.maintenance add constraint fk_maint_room
--    foreign key ("roomId") references public.rooms(id) on delete set null not valid;
