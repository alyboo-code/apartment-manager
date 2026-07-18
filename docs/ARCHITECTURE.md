# Architecture

> Subsystems by **named entry point**, data flow, and where things live.
> Never reference line numbers — they rot. Name functions, DOM ids, storage keys, DB paths.
>
> **Derived by reading `index.html`.** Code is the source of truth for behavior; if this file
> disagrees with the code, fix this file.

## Shape

One file. `index.html` contains the markup, a `<style>` block, and ~169 vanilla JS functions in a
single `<script>`. No framework, no bundler, no module system, no build step — the file is served
as-is and runs. The only external runtime dependency is the Supabase JS client, loaded from
jsDelivr under an SRI `integrity` hash.

This is deliberate (D-001, Hard Rule 9). Do not introduce a build step.

## Subsystems

### Auth — `doLogin()`, `doLogout()`, `showLoginScreen()`, `hideLoginScreen()`

Supabase email/password. A single role: the landlord. No tenant login, no in-app signup flow.

`doLogin()` calls `_sb.auth.signInWithPassword()`, then on success runs `hideLoginScreen()` →
`loadDB()` → `renderAll()` → `init()`. The session lives in `_session`; `_session.user.id` is the
`user_id` stamped on every written row and filtered on in every read.

DOM: `#login-screen` and `#app-root` are toggled via `style.display`; `#login-err` carries the
error text.

### Read path — `loadDB()`

On login, fires seven parallel selects (`Promise.all`) — one per table — each filtered
`.eq('user_id', uid_user)`, and populates the in-memory `db` object. `settings` uses
`.maybeSingle()` and is unwrapped from its `config` column. Finishes by calling
`migrateBillSnapshots()`.

> ⚠ **Known defect.** `loadDB()` checks `.error` on none of the seven results. Supabase resolves a
> failed query as `{ data: null, error }` rather than throwing, so `rooms.data || []` yields an
> empty array on failure and the app renders as a real-looking empty database. See Hard Rule 4 and
> `planning/ROADMAP.md` → Known issues.

### Write path — `persistUpsert()`, `persistDelete()`

The only sanctioned way to write. Per-row, never whole-db (Hard Rule 3) — this is what stops a
stale device from clobbering newer data or resurrecting a row another device just deleted.

`rowPayload()` stamps `user_id` and, for `settings`, wraps the object in a `config` column.
`_conflictCol()` picks the upsert conflict target: `user_id` for `settings`, `id` for everything
else.

On failure, `classifyWriteError()` separates two very different situations:

- **Offline** (`!navigator.onLine`, or a `TypeError` from a failed fetch) → queue to the outbox,
  quiet toast, retry later.
- **Rejected** (online, plus a structured PostgREST/Postgres error) → queue *with* a `hardError`,
  and call `reportWriteRejection()` to raise the red `⚠ NOT saved` badge.

Collapsing these two is a Hard Rule 6 violation. The code comment records why: a missing-column bug
once stayed invisible behind a cheerful "Saved offline".

### Offline queue — `apt_outbox`

`loadOutbox()` / `writeOutbox()` / `enqueue()` read and write a JSON array in localStorage under
`OUTBOX_KEY = 'apt_outbox'`. Each op is `{type: 'upsert'|'delete', table, payload|id, hardError?}`.

`flushOutbox()` replays ops in order, keeps failures for next time, and is guarded by a `_flushing`
re-entrancy flag. It is called opportunistically after every successful write, and by
`syncLocalBackup()` at startup.

`updateSyncStatus()` renders `#sync-status`: hidden when empty, amber "N changes pending sync" when
queued, red "⚠ N changes NOT saved — needs attention" when any op carries a `hardError` (messages
in the `title` tooltip).

### Restore — `replaceCloudWithDb()`, `bulkReplaceCloud()`

The most destructive code in the app. `replaceCloudWithDb()` builds a `keep` set of ids per table,
deletes every cloud row *not* in that set, then upserts everything via `bulkReplaceCloud()`. A
restore genuinely replaces rather than merges.

Reached only from an explicit user-initiated Restore. It is the sanctioned exception to Hard Rule 3.

### Legacy migration — `syncLocalBackup()`

One-time migration off the old whole-db-in-localStorage scheme. If `apt_local_db` exists, prompts to
upload it via `bulkReplaceCloud()`, then removes `apt_local_db` and `apt_unsynced_at`. Runs before
the normal outbox flush. `saveWithFallback()` is a legacy alias kept so any un-migrated caller
degrades to a cheap flush instead of throwing.

### Rendering — `renderAll()` and the `render*` family

`renderAll()` fans out to per-view renderers, each owning one region of the DOM:

| Function | Region |
|---|---|
| `renderDashboard()` | `#dash-stats`, `#dash-rooms`, `#dash-notices`, `#dash-overdue` |
| `renderRooms()`, `renderTenants()` | room and tenant lists |
| `renderBilling()` | `#billing-content`, `#charge-list` |
| `renderBillSheet()` | `#billsheet-content`, `#bs-table`, `#bs-printable` |
| `renderPayments()` | payment history |
| `renderExpenses()` | `#exp-body`, `#exp-total` |
| `renderMaintenance()` | `#maint-body`, `#maint-stats`, `#maint-total` |
| `renderMortgage()`, `renderMortgageProgress()` | `#mort-body` |
| `renderReports()`, `renderYearReport()` | reports |
| `renderNotices()`, `renderOverdueAlerts()` | dashboard alerting |

No virtual DOM, no reactivity. Mutators change `db`, call `persistUpsert()`, then call the relevant
renderer. Period selectors (`#dash-m`/`#dash-y`, `#bill-m`/`#bill-y`, `#bs-m`/`#bs-y`,
`#exp-m`/`#exp-y`) drive which period each view shows.

### Period and formatting helpers

`per(y, m)` produces the canonical `"YYYY-MM"` period key used throughout `db.bills`. `perLabel()`,
`perParts()`, and `prevPer()` convert and step; `prevPer()` handles the year boundary. `fmt()`
formats currency as `₱` with `en-PH` grouping and two decimals. `fmtKwh()` caps meter readings at
one decimal so float tails do not leak into the UI.

## Data flow

```
login  →  doLogin()  →  loadDB()  ──7 parallel selects──▶  Supabase
                            │
                            ▼
                        db (in memory)  ──▶  render*()  ──▶  DOM
                            ▲                    │
                            │              user edits
                            │                    ▼
                            └────────────  mutator (saveRoom, saveBill, …)
                                                 │
                                                 ▼
                                          persistUpsert()
                                            │        │
                                       success    failure
                                            │        │
                                            ▼        ▼
                                       Supabase   classifyWriteError()
                                                     │        │
                                                 offline   rejected
                                                     │        │
                                                     ▼        ▼
                                              apt_outbox  + red badge
                                                     │
                                              flushOutbox() on reconnect
```

## Sync model

Last-write-wins per row. No vector clocks, no tombstones. The protection against lost updates is
*granularity*: because every write is a single row, two devices editing different rooms never
conflict, and a stale device can only clobber the specific row it actually touched. This is exactly
why Hard Rule 3 exists — a whole-db write throws that protection away.

Deletes are hard deletes (`persistDelete()`), scoped by both `id` and `user_id`.

## Security boundaries

- **Client-side scoping:** every query carries `.eq('user_id', _session.user.id)`.
- **Server-side RLS:** `supabase-schema.sql` enables row-level security on all seven tables and
  installs an `owner_all_<table>` policy with both `using (user_id = auth.uid())` and a matching
  `with check`. Second layer — Hard Rule 5 requires the client filter regardless.
- **CSP:** `_headers` sets a Netlify CSP with an explicit `connect-src` allowlist (`self`,
  `*.supabase.co`, `wss://*.supabase.co`, `cdn.jsdelivr.net`), plus `frame-ancestors 'none'` and
  `X-Frame-Options: DENY`. A new external origin must be added there or it is blocked in production
  while working fine locally.
- **SRI:** the Supabase CDN `<script>` carries an `integrity` hash. Version bumps must update it or
  the app silently fails to load.
- The Supabase **anon key** is embedded in `index.html`. This is by design — anon keys are public
  and RLS is what enforces access. Not a leaked secret.

## Offline / PWA

`sw.js` and `manifest.webmanifest` make the app installable on a phone. Combined with the outbox,
the app stays usable without a connection — with the significant caveat that `loadDB()` currently
mishandles a failed *read*, so offline-at-startup is not yet safe.
