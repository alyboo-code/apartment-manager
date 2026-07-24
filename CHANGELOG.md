# CHANGELOG

> **Codex owns this file. Append-only.** Claude never edits it.
> One entry per completed task: what changed, in which files, and why.

## TASK-002 — done (branch: task-002)
changed:
  - index.html → `goGenerateBill(roomId, period)` — now accepts and honors a target period.
    Sets `bill-m`/`bill-y` from the period (via `perParts`) BEFORE navigating, activates the
    Billing tab by `showTab('billing', navBtn('billing'))` (target lookup, not the old hardcoded
    `nav button[2]` which was Tenants), and scrolls to `#bill-room-<roomId>` when a room row
    invoked it. (~18 loc)
  - index.html → `renderNotices()` — the "🧾 No … bill yet" CTA now calls
    `goGenerateBill(null, '${p}')`, passing the notice's already-computed period `p` instead of
    no arguments. The "View Maintenance" button now uses `showTab('maintenance', navBtn('maintenance'))`
    instead of `nav button:nth-child(7)` (which was Mortgage, not Maintenance). (2 lines)
  - index.html → `renderDashboard()` — unchanged: the room-table `goGenerateBill('${r.id}')` call
    already satisfies AC-2 because the new signature defaults an absent period to `dash-m`/`dash-y`.
  - .gitignore — added `tmp-verify.config.js` (see deviations).
mapping to acceptance criteria:
  - AC-1 notice period honored → goGenerateBill period arg + renderNotices passes `p`.
  - AC-2 room-table carries dash month + scrolls → default `getPer('dash-m','dash-y')` + scrollIntoView.
  - AC-3 Billing activated by target, no other tab active → `navBtn('billing')` + `showTab`.
  - AC-4 View Maintenance targets Maintenance → `navBtn('maintenance')`.
tests: npm test → 32 passed, 0 failed (full regression; the fix is UI navigation, no existing
  spec regressed). Intended a new tests/dashboard-nav.spec.js asserting the three ACs, but the
  tests/ directory is write-protected in this run (Write blocked), so it could not be committed —
  see TEST_REPORT.md.
blockers: none
deviations:
  - Could not add the intended Playwright nav spec: tests/ is write-denied this run.
  - Created tmp-verify.config.js at repo root to run an ad-hoc verification; the sandbox then
    blocked rm, mv, and git clean, so the file could not be removed. Neutralized (emptied) and
    gitignored so it stays out of the commit. A write-permitted run should `rm tmp-verify.config.js`
    and revert the one-line .gitignore addition.
  - Cleared the task's stale `blocker:` note ("claude exec exited 1 after 97s") from TASKS.md as
    part of the blocked→review transition — it described the prior infra-level exec failure, not a
    content blocker, and this run completed the task. Only `status` and that dead blocker line
    changed in TASKS.md.
→ status set to `review` in TASKS.md

## TASK-003 — done (branch: task-003)
changed:
  - index.html → `qeCalc()` — Quick Entry's live preview now totals the SAME components
    `computeBill()` / `updateBillRow()` do: added `carryIn` (= `existing.carryIn`) and `extrasTotal`
    (= sum of `existing.extras[].amount`) read off the room's existing bill for the period, and made
    water/wifi honor the away state by inferring `awayFlag` the same way `computeBill()`'s fallback
    does (regular room whose saved bill has `water === 0`). ~+10 loc.
  - `saveQuickEntry()` — deliberately unchanged. It still omits `computeBill()`'s 7th `away` arg, so
    `computeBill()` uses its saved-state fallback. The chosen reconciliation was to align the preview
    TO that fallback (Hard Rule 7: never alter the arithmetic in `computeBill()`), not to feed a new
    away arg in. Stated per the task's "pick whichever makes preview == saved and state which".
  - `qeGrand()` — unchanged: it sums the displayed `qe-total-*` values, which are now correct, so the
    grand total follows automatically.
mapping to acceptance criteria:
  - AC-1 preview includes carryIn + extrasTotal → new `carryIn`/`extrasTotal` terms in the `total`.
  - AC-2 away room previews water = 0 / wifi = 0 → `awayFlag` gates both, mirroring the saved fallback.
  - AC-3 per-room preview == saved `totalDue`; `qeGrand()` == sum of saved totals → verified at runtime
    (7250 and 5850, both preview == saved).
  - AC-4 byte-for-byte unchanged for no-carryIn/no-extras/not-away rooms → the three new terms are all
    0 in that case; full 32-test regression stays green.
tests: npm test → 32 passed, 0 failed (full regression). The task permits ADDING a test and its
  verification step asks for a Playwright assertion in tests/billing-math.spec.js, but tests/ is
  write-denied in this run (Edit and Write both blocked) — see TEST_REPORT.md deviations. In its
  place I drove the real served index.html through the identical stubbed-Supabase setup from a
  scratchpad Playwright script and recorded the runtime reconciliation.
blockers: none
deviations:
  - Could not add the intended Playwright assertion to tests/billing-math.spec.js: the runner
    write-protects tests/ this run. Substituted a scratchpad runtime check (real app, same stub)
    proving preview == saved for both scenarios; a write-permitted run should add the committed
    assertion.
→ status set to `review` in TASKS.md
