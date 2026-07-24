# TEST REPORT

> **Codex owns this file. Append-only.** Claude never edits it.
> One entry per task: what was run, what passed, what failed. A task with no test evidence
> is not reviewable.

## TASK-002 · 2026-07-24
suite: npm test (Playwright, full suite)
result: 32 passed, 0 failed (~2.8s)
command output: `32 passed (2.8s)`

This task is UI navigation only (no persistence, no arithmetic, no read path), so the fix is
verified by (a) full-suite regression — all 32 pre-existing tests still pass — and (b) a code
walkthrough of each acceptance criterion:

- AC-1 — `renderNotices()` renders the CTA as `onclick="goGenerateBill(null, '<p>')"` where `<p>`
  is the notice's already-computed period. `goGenerateBill` sets `bill-m = perParts(p).m` and
  `bill-y = perParts(p).y` before `showTab('billing', …)`, and `showTab` re-renders Billing off
  those selectors via `getPer('bill-m','bill-y')`.
- AC-2 — the room-table CTA stays `goGenerateBill('<roomId>')` (no period); the new default
  `getPer('dash-m','dash-y')` carries the dashboard month, and `scrollIntoView` targets
  `#bill-room-<roomId>`.
- AC-3 — activation is `showTab('billing', navBtn('billing'))`. `navBtn` finds the button whose
  onclick contains `showTab('billing'`; `showTab` clears `.active` from all `nav button` then adds
  it to that one. The old `nav button[2]` (Tenants) hardcode is gone. Nav order confirmed:
  Dashboard0 Rooms1 Tenants2 Billing3 … so [2] was indeed Tenants.
- AC-4 — "View Maintenance" is `showTab('maintenance', navBtn('maintenance'))`. Old
  `nav button:nth-child(7)` was Mortgage (Maintenance is the 8th button); confirmed against the
  `<nav>` markup.

attempted end-to-end nav assertions: I wrote a 3-case spec (notice→Billing on prev month;
room-row Generate→Billing on dash month + card present; View Maintenance→Maintenance tab) but
could not run it committed — tests/ is write-protected this run, and an ad-hoc runner config at
repo root could not be executed because the permission layer only allows the bare `npm test`
invocation (extra `--config`/`npx` args require approval unavailable in autonomous mode). Recorded
so the reviewer knows the gap.

untested: no automated assertion of the DOM click-through was committed (see above). The three ACs
are covered by code review + full-suite regression, not by a new dedicated Playwright case.
manual (interactive browser): not performed — this run has no interactive browser; the served-app
verification I attempted was blocked as described.
