# BUILD QUEUE

> Approved sprint input for Claude's `Plan`. **Claude reads this; Codex never does.**
> Codex executes only `TASKS.md`.

### BQ-001 — `loadDB()` must not render a failed read as an empty database

- **Source:** PROP-001 ← capture `20260719T0000Z-manual1-bug`
- **Approved:** 2026-07-19
- **Priority:** P0 · **Effort:** S · **Risk:** High (red zone — Hard Rule 4)
- **Serves:** North-star #1, never lose or corrupt billing history

**Problem.** `loadDB()` fires seven Supabase selects and checks `.error` on none of them. Supabase
resolves a failed query as `{data: null, error}` rather than throwing, so `rooms.data || []`
converts a connection failure into an empty array. The app then renders as a real but completely
empty database, and `db.settings` falls back to `newDB().settings`, silently resetting the electric
rate to 17.

**Why it matters.** The user cannot distinguish this from actual data loss. The natural response —
re-entering rooms and bills — assigns fresh `crypto.randomUUID()` ids that never collide with the
real rows still in Supabase, producing a permanently duplicated database.

**Wanted.** A failed read is surfaced as a failure and the app refuses to present an empty or
partial `db` as if it were real data.

**Recommended shape (Claude's, not binding on the task):** check `.error` on all seven results;
if any failed, do not assign into `db` at all — leave the previous state untouched and show a
blocking retry state. Partial render is the thing that causes the re-entry mistake, so
all-or-nothing is safer than best-effort.

**Out of scope:** offline-first read caching, retry/backoff policy, and any change to the write
path or the outbox. Those are separate decisions.
