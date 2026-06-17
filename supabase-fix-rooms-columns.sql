-- ============================================================
--  Adds the room columns the app uses but the table was missing.
--  Without these, saving/restoring rooms fails ("Saved offline").
--  Safe to run more than once.
-- ============================================================

alter table public.rooms add column if not exists active         boolean;
alter table public.rooms add column if not exists "idType"       text;
alter table public.rooms add column if not exists "depositNotes" text;
alter table public.rooms add column if not exists "ecName"       text;
alter table public.rooms add column if not exists "ecRel"        text;
alter table public.rooms add column if not exists "ecPhone"      text;
alter table public.rooms add column if not exists notes          text;

-- Confirm the rooms table now has every column the app sends
select string_agg(column_name, ', ' order by column_name) as rooms_columns
from information_schema.columns
where table_schema = 'public' and table_name = 'rooms';
