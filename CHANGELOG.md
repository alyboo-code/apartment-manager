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
