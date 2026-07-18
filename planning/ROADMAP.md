# ROADMAP

> Human-approved work only. Triage never writes here — `planning/PROPOSALS.md` does, and you
> promote from there.

## Current Objective

**Close the paths where a transient failure becomes permanent data loss**

Read by `tools/Generate-Digest.ps1` (which expects exactly this heading followed by a bold line)
and by triage, which scores every capture's `goal alignment` against it. Change it when the focus
changes — an objective left stale silently mis-ranks the whole backlog.

## Approved backlog

- **BQ-001 — `loadDB()` must not render a failed read as an empty database.** P0, effort S,
  Risk High (red zone, Hard Rule 4). From PROP-001, capture `20260719T0000Z-manual1-bug`.
  Approved 2026-07-19. → `planning/BUILD_QUEUE.md`

## Ideas

*Empty.*

## Research

*Empty.*

## Known issues

- **`loadDB()` swallows read errors.** All seven selects use `x.data || []` with no `.error`
  check; Supabase resolves failed queries as `{data: null, error}` rather than throwing. A failed
  read renders as an empty database and resets `settings` to defaults. Being fixed as BQ-001.
- **`rooms` has two overlapping status fields** — `active` (bool) and `status` (text). `status` is
  the newer one. Not yet reconciled; unclear which the UI reads in every path. Not scheduled.
- ~~**No test infrastructure exists.**~~ **RESOLVED 2026-07-19.** Playwright suite added: 32 tests
  across smoke, read failures, write path, billing math, and account scoping. `npm test` now
  satisfies AGENTS.md's Definition of Done. See `tests/README.md` and D-005.
- **`refreshFromCloud()` wipes on-screen data on a failed background refresh.** Calls `loadDB()`
  then `renderAll()` on focus / reconnect / visibilitychange; its `try/catch` cannot fire because
  `loadDB()` does not throw. Proven by test: rooms go 2 → 0 mid-session. Folded into TASK-001.
- **Dead check in `loadDB()`:** `typeof mortgages !== 'undefined'` can never be false — `mortgages`
  is a destructured element of the `Promise.all` result and is always defined. Harmless, but it
  reads as a guard that is doing nothing. Fold into BQ-001 only if it does not widen the diff.

## Do not work on

*Empty. Add things here when you decide NOT to do them — it stops agents re-proposing them
every triage run.*
