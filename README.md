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

## Supabase setup — one canonical schema file

**`supabase-schema.sql`** is the single source of truth for the database.
Open Supabase → **SQL Editor** → New query → paste the whole file → **Run**.
It is **idempotent** (safe to run any time): it creates missing tables, adds
missing columns, and applies Row Level Security with owner-only policies.

### ⭐ Adding a new field to the app — the checklist that prevents data loss
When you add a field in `index.html` (e.g. a new tenant detail):

1. Add `alter table public.<table> add column if not exists <name> <type>;`
   to `supabase-schema.sql` (camelCase names must be `"double-quoted"`).
2. Re-run `supabase-schema.sql` in Supabase.
3. Then deploy the app.

If you skip steps 1–2, saving that field fails — but the app now shows a red
**"⚠ NOT saved — needs attention"** badge so you'll know immediately (it no
longer hides as "saved offline").

### Tables
`rooms`, `bills`, `payments`, `expenses`, `maintenance`, `mortgages`,
`settings` (one JSON row per user). All keyed by a text `id` and scoped by
`user_id`, isolated per account by Row Level Security.

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

## Operations & hardening checklist

Things to set up in the **Supabase / Netlify dashboards** (one-time):

### Automated backups (do this)
- **Free plan:** Supabase does NOT keep automated backups. Your safety net is
  the in-app **💾 Backup → Download Local Copy** — do it on a schedule and keep
  the file in Drive/email. Consider upgrading for real backups.
- **Pro plan:** Project → **Database → Backups** → enable **Point-in-Time
  Recovery (PITR)**. Then you can roll the whole database back to any minute.

### Auth abuse protection
- Supabase → **Authentication → Attack Protection** (a.k.a. Rate Limits):
  leave the built-in login/signup rate limits on, and turn on **CAPTCHA**
  (hCaptcha or Cloudflare Turnstile) to stop bots and password-guessing.

### Security headers (already in the repo)
- `_headers` adds a Content-Security-Policy + clickjacking/MIME protections.
  It applies automatically **when you deploy the folder/repo** to Netlify
  (not when you drag a single file). Setting up Netlify → GitHub auto-deploy
  makes this automatic.

---

## Deliberately deferred (revisit if you grow past a single landlord)

These are real improvements but **not worth the complexity for one user**:

- **Real-time multi-device sync + optimistic concurrency.** Today the app
  refreshes on tab focus, which is plenty for one person on a phone + laptop.
  Add Supabase Realtime + an `updated_at` conflict check only if multiple
  people will edit the same property at the same time.
- **Money as integer centavos.** Amounts are floating-point in the browser.
  Fine at this scale; revisit only for audit-grade accounting. (This is a data
  migration — do it deliberately, with a backup, not casually.)
- **Foreign keys.** Intentionally omitted — see the note at the bottom of
  `supabase-schema.sql`. The app preserves history by design.
