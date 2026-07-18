# PLAN

> The current milestone: why this sprint of Codex tasks exists.

**Milestone:** Make a failed read impossible to mistake for an empty database
**Status:** in-progress
**Source:** `planning/BUILD_QUEUE.md` → BQ-001

## Goal

Close the one path in this codebase where a transient network failure can lead to permanent data
corruption.

The write path is already carefully defended: `persistUpsert()` queues failures to an outbox and
`classifyWriteError()` refuses to let a server rejection masquerade as success. The read path has
none of that. `loadDB()` checks `.error` on zero of its seven selects, and because Supabase
resolves failed queries rather than throwing, a dropped connection renders as a real-looking empty
apartment manager with the electric rate reset to its default.

The damage is not the empty screen — it is what the user does next. Re-entering rooms and bills
assigns fresh UUIDs that never collide with the rows still sitting in Supabase, leaving a
permanently duplicated database that no one notices until reconciliation. That makes this a
north-star #1 failure (never lose or corrupt billing history), not a UI bug.

## Scope

One task, T-001. Deliberately narrow: check the errors, refuse to swap in a bad `db`, tell the
user. Nothing else in the read path changes.

**Explicitly out of scope** — each is its own decision, not a freebie to fold in here:
- offline-first read caching, so the app has something to show when the network is gone
- retry / backoff policy
- any change to the write path, the outbox, or `classifyWriteError()`
- reconciling the `rooms.active` vs `rooms.status` overlap (ROADMAP → Known issues)

## Risk

**High.** Touches `loadDB()` and the assignment into the global `db` — red zone under Hard Rule 4.
Per Hard Rule 10 this milestone is **never chained**; T-001 runs solo and is reviewed solo.

Per D-032 this lands `approved` (held for human merge), **not** `done`. It does not auto-deploy.
Stated here in advance so the review verdict is a check against a prior commitment rather than a
judgment call made after the fact.

## Definition of done for the milestone

A read failure produces a visible error and leaves the previous `db` untouched, verified by
actually simulating a failed query — not by reasoning about the diff.
