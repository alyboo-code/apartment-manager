# DECISIONS

> ADR-lite. One entry per **non-obvious** choice made or reversed. Reference the task ID.
>
> Not every choice belongs here. A decision earns an entry when a future reader would
> otherwise ask "why on earth is it done this way?" — or worse, "fix" it.
>
> Optional `Verify:` line(s) on any entry are a machine-checkable pointer:
> `Verify: <file> contains "<literal text>"` or `Verify: <file> does not contain "<literal text>"`.
> Run `tools/Verify-Decisions.ps1` to check every one against the current code. Add one when a
> decision's correctness depends on something specific enough to name (a guard clause, a call site) —
> not every entry needs one.

## D-001 — No framework, no build step

**Decision:** The entire application is one file — `index.html` — containing markup, CSS, and
~169 vanilla JS functions. No framework, no bundler, no module system, no build step. The only
external runtime dependency is the Supabase JS client from CDN.

**Why:** The app is maintained by one person, and the deploy story is "the file is the artifact" —
what runs in production is exactly what is in the repo, with nothing in between to misconfigure or
to go stale. There is no build to break, no dependency tree to rot, no version skew between source
and bundle. Debugging in the browser lands on the real code. For a single-file CRUD app over seven
tables, a framework would add a toolchain to maintain without removing work that is actually hard.

**Consequences:** `index.html` is ~220KB and growing — grep for anchors rather than reading it
whole. No JSX, no imports, no npm packages: new capability arrives as either vanilla JS or a
CDN `<script>` with an SRI hash and a `connect-src` entry in `_headers`. Reversing this is a
deliberate architecture change requiring a new decision entry, not a convenience taken mid-task
(Hard Rule 9).

## D-002 — Per-row writes, never whole-db

**Decision:** All writes go through `persistUpsert()` / `persistDelete()`, one row at a time.
`bulkReplaceCloud()` and `replaceCloudWithDb()` are the only exceptions, reachable solely from an
explicit user-initiated Restore.

**Why:** This replaced an earlier scheme that mirrored the whole `db` into localStorage
(`apt_local_db`) and pushed it wholesale. That scheme let a stale device overwrite newer data and
resurrect rows another device had just deleted — silently, with no error surfaced. Per-row writes
make granularity the safety mechanism: two devices editing different rooms cannot conflict, and a
stale device can only clobber the exact row it touched.

**Consequences:** There is no "save everything" button and there should not be. `saveWithFallback()`
survives only as a legacy alias degrading to a cheap outbox flush. `syncLocalBackup()` performs the
one-time migration off `apt_local_db` and then deletes the key. Codified as Hard Rule 3.

Verify: index.html contains "async function persistUpsert"

## D-003 — Offline and rejected writes are never conflated

**Decision:** `classifyWriteError()` splits write failures into transient-offline (queue quietly,
retry) and server-rejected (queue *with* a `hardError` and raise the red `⚠ NOT saved` badge).

**Why:** A missing database column once stayed invisible for an extended period because every
failed write reported "Saved offline" — the app looked healthy while data was going nowhere. An
error that retrying will never fix must be loud, because the user's only alternative signal is
noticing months later that a bill is missing. This directly serves north-star goal #1.

**Consequences:** Every new write path must route through `persistUpsert()` / `persistDelete()` to
inherit the classification. Any code that catches a write error and shows a generic message
re-introduces the bug. Codified as Hard Rule 6.

Verify: index.html contains "function classifyWriteError"

## D-005 — Tests stub Supabase rather than using a real test project

**Decision:** The Playwright suite replaces the Supabase CDN script with a test double
(`tests/support/supabase-stub.js`) via route interception, and strips the SRI `integrity`
attribute from that one `<script>` tag in the *served* HTML. `index.html` on disk is never
modified and ships with SRI intact. A `package.json` exists solely to run Playwright — the app
still has no build step (D-001).

**Why:** Every bug worth catching in this codebase is a *failure* mode — a dropped connection
mid-read, one table out of seven rejecting, a server refusing a write. A real Supabase project
cannot be made to fail on command, on the fourth of seven parallel queries, deterministically,
every run. The stub also keeps credentials out of the repo, removes shared remote state that two
runs could race over, and lets the suite finish in about eight seconds offline.

The SRI strip is not optional: substituting the CDN response necessarily fails the integrity
check and the browser blocks the script, which is correct behavior. Stripping it in the served
copy is the narrowest possible workaround, and the fixture throws a loud error if the tag ever
changes shape rather than silently serving an app with no Supabase client.

**Consequences:** The stub must honour the real client's contract exactly, and one clause matters
more than the rest: **queries resolve, they do not throw** — a failed select gives
`{ data: null, error }`. A stub that threw would make the Hard Rule 4 bug look like correct code
and the entire read-failure suite would be worthless. Real client upgrades can drift from the
stub; `tests/smoke.spec.js` is the canary. `node_modules/`, `test-results/`, and
`playwright-report/` are gitignored; the suite itself is committed.

Verify: tests/support/supabase-stub.js contains "Queries RESOLVE, they do not throw"

## D-004 — Bills snapshot tenant name and room number

**Decision:** Each bill row carries denormalized `"tenantName"` and `"roomNumber"` copies, written
by `migrateBillSnapshots()`, rather than joining to `rooms` at render time.

**Why:** Rooms get deleted and tenants move out. A bill that renders as "(deleted room)" makes
payment history unreadable exactly when it matters — during a dispute about who paid what. The
snapshot is the historical fact; the room record is the current state, and they are allowed to
diverge.

**Consequences:** These fields look like normalization errors and must not be "cleaned up".
Renaming a tenant does not retroactively rewrite old bills — that is intended.
