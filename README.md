# Apartment Manager

A single-file web app for managing apartment rentals: rooms, tenants, monthly
billing (electricity / water / WiFi), payments, expenses, mortgage tracking,
maintenance, and printable bills/receipts. Data lives in **Supabase**
(Postgres + Auth); the app is a single static HTML file hosted on **Netlify**.

---

## ⭐ The one file that matters

**`index.html`** is the entire app and the single source of truth. There are no
other "real" versions. If you ever see `index (1).html`, `index (6).html`,
`apartment-deploy.html`, etc. floating around your Downloads — those are old
copies. Ignore them. **Only edit `index.html` in this folder.**

---

## How it's wired

```
Browser (index.html)  ──►  Supabase  (Postgres tables + Auth)
        │
        └── hosted on Netlify (static file)
```

- Every change saves to Supabase **per row** (not the whole database).
- Failed saves queue offline and retry when back online.
- You log in with email + password (Supabase Auth). Each account only sees its
  own data, enforced by Row Level Security.

---

## Supabase setup (run these SQL scripts once, in order)

Open Supabase → **SQL Editor** → New query → paste → **Run**.

| Order | File | What it does |
|------:|------|--------------|
| 1 | `supabase-mortgages-table.sql` | Creates the `mortgages` table the Mortgage tab needs |
| 2 | `supabase-fix-rooms-columns.sql` | Adds room columns the app writes (emergency contact, notes, idType, active…) |
| 3 | `supabase-rls-setup.sql` | Confirms Row Level Security + owner-only policies on every table |

These are **schema-as-code**: if you ever add a new field in `index.html`, add
the matching column here too, or saving that field will silently fail.

### Tables
`rooms`, `bills`, `payments`, `expenses`, `maintenance`, `mortgages`,
`settings` (one JSON row per user). All keyed by a text `id` and scoped by
`user_id`.

---

## Deploying to Netlify

1. The file is already named `index.html` (Netlify serves that as the homepage).
2. Netlify dashboard → your site → **Deploys** → drag `index.html` onto the
   drop zone.
3. Wait ~30s, then hard-refresh the live site (Cmd+Shift+R).

The live site and your local file both use the **same Supabase cloud**, so
deploying never affects your data.

---

## 💾 Backups (do this!)

Your records live in Supabase, but get in the habit of an extra copy:

- In the app: **💾 Backup → Download Local Copy** every couple of weeks.
- Keep that `.json` somewhere private (email it to yourself / Google Drive).
- To recover: **💾 Backup → Choose File → Restore Backup**. Restore *replaces*
  all current data with the file's contents.

A downloaded backup is what saved 16 rooms after a data-loss scare in June 2026.

> ⚠️ Backups contain tenant names and phone numbers (PII). They are gitignored
> on purpose — never commit them to a public repo.

---

## Known limitations / future work

- No automated backups yet — enable Supabase Point-in-Time Recovery (paid plan).
- Failed writes can look like "saved offline"; a clearer rejected-vs-offline
  error state is a good next improvement.
- Money is handled as floating-point in the browser; integer centavos would be
  more audit-safe at scale.
- No real-time multi-device sync; the app refreshes on tab focus instead.
