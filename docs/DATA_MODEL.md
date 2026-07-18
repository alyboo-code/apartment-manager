# Data Model

> State shapes, storage keys, and persistence paths.
>
> **Derived from `index.html` (`newDB()`, `loadDB()`, `rowPayload()`) and `supabase-schema.sql`.**
> Code and schema are the source of truth; if this file disagrees, fix this file.

## In-memory state — `db`

One global, created by `newDB()` and populated by `loadDB()`:

```js
db = {
  rooms:       [],   // Room[]
  bills:       [],   // Bill[]
  payments:    [],   // Payment[]
  expenses:    [],   // Expense[]
  maintenance: [],   // Maintenance[]
  mortgages:   [],   // Mortgage[]
  settings:    {}    // Settings (single object, not an array)
}
```

The six arrays map 1:1 to Supabase tables of the same name. `settings` is the exception: it is a
single object stored in the `config` jsonb column of one `settings` row keyed by `user_id`.

**Settings defaults** (from `newDB()`) — these are also the fallback `loadDB()` uses when no
settings row exists:

```js
{ electricity: 17, wifi: 300, water: 150, name: 'My Apartment',
  wifiSubscription: 0, mortgageTotal: 0 }
```

`electricity` is the per-kWh rate; `wifi` and `water` are per-period charges.

> ⚠ Because `loadDB()` does not check `.error`, a failed settings read is indistinguishable from
> "no settings row yet" and silently resets rates to these defaults. See Hard Rule 4.

## Identity and scoping

- **Primary key:** every table uses `id text primary key`. Ids are generated client-side by
  `uid()` — `crypto.randomUUID()` where available, otherwise a timestamp+random fallback.
- **Ownership:** every row carries `user_id uuid references auth.users(id) on delete cascade`.
  `rowPayload()` stamps it on write; every read filters `.eq('user_id', …)`. See Hard Rule 5.
- **Deleting an auth user cascades** and removes all their rows.

Because ids are client-generated UUIDs, re-entering data that already exists does **not** collide —
it duplicates. This is the mechanism behind the Hard Rule 4 failure mode.

## Table shapes

Columns are quoted camelCase in Postgres where the JS object uses camelCase (e.g. `"roomId"`), so
the client object and the row are the same shape with no mapping layer.

### `rooms`
`id`, `user_id`, `number`, `tenant`, `type` (default `'regular'`), `persons` (default 1), `rent`,
`wifi` (bool), `active` (bool), `status` (default `'active'`), `phone`, `email`, `"moveIn"`,
`"moveOut"`, `"idType"`, `deposit`, `advance`, `"depositDate"`, `"depositNotes"`, `"ecName"`,
`"ecRel"`, `"ecPhone"`, `notes`.

`"ec*"` fields are emergency contact. Note both `active` (bool) and `status` (text) exist — `status`
is the newer field.

### `bills`
`id`, `user_id`, `"roomId"`, `period`, `rent`, `"prevReading"`, `"currReading"`, `"kWh"`,
`electricity`, `persons`, `water`, `wifi`, `"prevBalance"`, `"carryIn"`, `extras` (jsonb, default
`[]`), `"totalDue"`, `"paidAmount"`, `balance`, `status` (default `'unpaid'`), `"tenantName"`,
`"roomNumber"`, `"createdAt"` (bigint epoch ms).

- `period` is the canonical `"YYYY-MM"` key produced by `per(y, m)`.
- `"kWh"` is the meter delta: `"currReading" - "prevReading"`.
- `extras` holds ad-hoc per-room charges for the period.
- `"tenantName"` / `"roomNumber"` are **denormalized snapshots**, written by
  `migrateBillSnapshots()`, so payment history stays readable after a room is deleted. Do not
  "normalize" them away.

Everything on this table is billing math and therefore red-zone (Hard Rule 7).

### `payments`
`id`, `user_id`, `"billId"`, `date`, `amount`, `mode`, `notes`, `"createdAt"`.

Payments reference a bill; a bill's `"paidAmount"` and `balance` are the running rollup.

### `expenses`
`id`, `user_id`, `date`, `description`, `category`, `amount`, `"createdAt"`.

### `maintenance`
`id`, `user_id`, `date`, `"roomId"`, `category`, `description`, `"reportedBy"`, `"assignedTo"`,
`status` (default `'open'`), `"resolvedDate"`, `cost`, `notes`, `"createdAt"`.

### `mortgages`
`id`, `user_id`, `date`, `amount`, `type`, `notes`, `"createdAt"`.

Payment entries against the property mortgage; `settings.mortgageTotal` is the target that
`renderMortgageProgress()` measures against.

### `settings`
`user_id` (conflict target), `config` jsonb. One row per user. `_conflictCol()` returns `user_id`
for this table specifically because there is no per-row `id` to upsert against.

## localStorage keys

| Key | Constant | Contents | Owner |
|---|---|---|---|
| `apt_outbox` | `OUTBOX_KEY` | JSON array of queued write ops | `loadOutbox()` / `writeOutbox()` |
| `apt_sort_prefs` | `SORT_KEY` | Per-table sort preferences | `loadSortPrefs()` / `saveSortPrefs()` |
| `apt_local_db` | — | **Legacy.** Whole-db backup from the old scheme | `syncLocalBackup()`, delete-on-migrate |
| `apt_unsynced_at` | — | **Legacy.** Companion timestamp | `syncLocalBackup()`, delete-on-migrate |
| `sb-*-auth-token` | — | Supabase session, managed by the client library | Supabase SDK |

`apt_local_db` and `apt_unsynced_at` are read once by `syncLocalBackup()` and removed. New code must
never write them — that scheme is what Hard Rule 3 exists to prevent.

### Outbox op shape

```js
{ type: 'upsert', table: 'rooms', payload: {…row, user_id}, hardError?: 'message' }
{ type: 'delete', table: 'rooms', id: '…',                  hardError?: 'message' }
```

Presence of `hardError` means the server *rejected* the write and retrying will not help — this is
what turns `#sync-status` red. Its absence means offline-and-will-retry. See Hard Rule 6.

## Persistence paths

| Operation | Path |
|---|---|
| Read all | `loadDB()` → 7 parallel `.select().eq('user_id')` |
| Write one row | mutator → `persistUpsert(table, row)` → `.upsert(payload, {onConflict})` |
| Delete one row | mutator → `persistDelete(table, id)` → `.delete().eq('id').eq('user_id')` |
| Write while offline | → `enqueue()` → `apt_outbox` → `flushOutbox()` on reconnect |
| Restore from backup | `replaceCloudWithDb()` → delete-not-in-keep-set, then `bulkReplaceCloud()` |
| Legacy migration | `syncLocalBackup()` → `bulkReplaceCloud()` → remove `apt_local_db` |

There is no other sanctioned write path. Adding one is a Hard Rule 3 violation.

## Row-level security

`supabase-schema.sql` enables RLS on all seven tables and creates an `owner_all_<table>` policy per
table with `using (user_id = auth.uid())` **and** a matching `with check` — so a client cannot read
another user's rows, nor write a row stamped with someone else's `user_id`. The client-side
`.eq('user_id', …)` filter is still required (Hard Rule 5); RLS is the backstop, not the plan.
