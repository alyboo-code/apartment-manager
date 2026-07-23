# PLAN

> The current milestone: why this sprint of Codex tasks exists.

**Milestone:** Fix the billing-correctness defects the code audit surfaced (BQ-002…BQ-006)
**Status:** in-progress
**Source:** `planning/BUILD_QUEUE.md` → BQ-002, BQ-003, BQ-004, BQ-005, BQ-006

## Goal

BQ-001 shipped (TASK-001 — a failed read can no longer masquerade as an empty database). The same
Current Objective — *close the paths where a transient failure or a wrong default becomes permanent
data loss or a mis-collected bill* — now covers five defects a direct code audit surfaced, all
approved 2026-07-24. Each is a place where what the landlord sees, saves, or hands to the caretaker
diverges from what is true:

- **BQ-002** — the dashboard names the month missing a bill, then drops the landlord on a Billing
  screen showing a *different* month, with the wrong nav tab highlighted. A bill gets entered
  against the wrong `period`, corrupting the carried-balance chain.
- **BQ-003** — Quick Entry's live "Total Due" omits `carryIn` and `extras` and mishandles the away
  flag, so the preview disagrees with the bill it actually writes.
- **BQ-004** — the printed Bill Sheet drops moved-out tenants who still owe for the month, so real
  balances are never put in front of the person collecting.
- **BQ-005** — a *successful* background refresh rebuilds the Billing grid and silently wipes
  meter readings typed but not yet saved.
- **BQ-006** — every period selector defaults to the current month, but the billing work is always
  last month, taxing every session and compounding BQ-002.

## Scope

Five tasks, TASK-002…TASK-006, each atomic and independently testable. Ordered by priority
(BQ-002/003/004/005 are P1; BQ-006 is P2) so `/go` builds them in that order. Dependencies:
TASK-005 sequences after TASK-001 (done); TASK-006 sequences after TASK-002.

**Explicitly out of scope** — do not fold these in:
- any change to `computeBill()`'s arithmetic itself (align previews *to* it, never the reverse)
- offline-first read caching or retry/backoff policy
- Quick Entry gaining new away / carry-in controls (it must only stop *misreporting* them)
- reconciling the `rooms.active` vs `rooms.status` overlap (ROADMAP → Known issues)

## Risk

**High across the group.** BQ-003 is bill arithmetic (Hard Rule 7); BQ-004 decides which bills reach
a printed collection artifact (Hard Rule 7 by consequence); BQ-005 touches the read path
(`refreshFromCloud`, Hard Rules 3-4); BQ-002 and BQ-006 steer which `period` a bill is written
against. Per Hard Rule 10 the group is **never chained** — every task runs solo and is reviewed
solo. Per D-032 each lands **`approved`** (held for human merge), **not** `done`; none auto-deploys.
Stated in advance so each review verdict checks a prior commitment rather than a fresh judgment call.

## Definition of done for the milestone

For each task: every acceptance criterion passes, `npm test` is green (32+), and — for the
arithmetic tasks (TASK-003, TASK-004) — `TEST_REPORT.md` carries worked numeric examples, not just
"tests pass". Verified by simulating the real behavior through the Playwright suite, not by reasoning
about the diff.
