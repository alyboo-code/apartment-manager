# REVIEW

> Claude's review verdicts. Append-only. Never rubber-stamp.
>
> Each entry ends by stating which merge gate was chosen (`done` = reversible, auto-merges ·
> `approved` = red-zone, HELD for human merge) and why. See CLAUDE.md "Risk-gated merge".

## TASK-002 — Fix "Go to Billing": correct target month, target room, and nav highlight · 2026-07-24

**Verdict: APPROVED** · branch `task-002` · reviewer: Claude (autonomous)

### Guardian Gauntlet

Both specialists were run via the Task tool against `git diff main...task-002` as READ-ONLY
advisors (explicitly instructed not to edit/write/fix any file; commit-scope guard intact — the
working tree is clean and only `index.html`, `CHANGELOG.md`, `TASKS.md`, `TEST_REPORT.md`, and
`.gitignore` changed on the branch).

- **security-guardian — RAN. CLEAN, no findings.** Confirmed this is a pure UI-navigation change:
  no Supabase queries, no read/write path, no auth, no `user_id` scoping — Hard Rules 3–7 and
  PII/financial exposure are not implicated. Traced the one genuine XSS sink
  (`renderNotices()` → `el.innerHTML = notices.join('')`): the interpolated period `'${p}'` in
  `onclick="goGenerateBill(null, '${p}')"` is a computed `NNNN-NN` date string
  (`${y}-${String(m+1).padStart(2,'0')}` from `Date` integers), never user/DB data — no injection.
  `navBtn()` only *reads* existing onclick attributes via `.includes()`; `roomId` is used only in a
  `getElementById`/`scrollIntoView` DOM lookup. Verified `tmp-verify.config.js` contains only
  comment lines — no secrets — and is untracked/gitignored, so it cannot leak via git. (One
  informational **pre-existing** note, NOT introduced by this diff: `renderNotices()` also
  interpolates landlord-entered room numbers into the same innerHTML — unchanged context, self-XSS
  only in a single-tenant-per-account model. On the record; not a finding against this branch.)
- **quality-guardian — RAN. All 5 acceptance criteria MET,** traced criterion-by-criterion against
  the real code (nav order confirmed from `<nav>` markup: Dashboard0 Rooms1 Tenants2 Billing3 …
  Mortgage6 Maintenance7 — validating both "wrong index" diagnoses):
  - **AC-1 MET** — `checkMonth` passes its already-computed `p` into `goGenerateBill(null, '${p}')`;
    `goGenerateBill` sets `bill-m`/`bill-y` from `perParts(p)` **before** `showTab('billing', …)`,
    which synchronously re-renders Billing off `getPer('bill-m','bill-y')`. Month-value convention
    verified consistent (options 0-indexed; `perParts` returns 0-indexed `m`; round-trips correctly).
  - **AC-2 MET** — room-table button is `goGenerateBill('${r.id}')` (roomId only), so the default
    `getPer('dash-m','dash-y')` carries the dashboard month (not the notice period); scroll targets
    `#bill-room-<roomId>`, which `renderBilling` builds synchronously before the scroll; `if (card)`
    guards null.
  - **AC-3 MET** — `showTab('billing', navBtn('billing'))`; `navBtn` matches by
    `showTab('billing'` target, and `showTab` clears `.active` from all nav buttons before setting
    the one passed. Old hardcoded `[2]` (Tenants) is gone. Prefix match can't collide with
    `showTab('billsheet'`.
  - **AC-4 MET** — "View Maintenance" → `showTab('maintenance', navBtn('maintenance'))`; old
    `nth-child(7)` (Mortgage) removed.
  - **AC-5 MET (recorded)** — 32 tests total (billing-math 9 + read-failures 7 + smoke 5 +
    user-scoping 5 + write-path 6); all five spec files are unchanged on the branch. A dedicated nav
    Playwright test was *allowed but not required* by AC-5; none committed — compliant.

**Gauntlet PASSED** — both guardians ran; no CONFIRMED security finding; no unmet acceptance
criterion.

### Independent reviewer verification

Traced `goGenerateBill`, `navBtn`, `showTab`, `renderNotices`/`checkMonth`, `renderDashboard`'s
Generate call site, and the `per`/`perParts`/`getPer` helpers directly. The month/period plumbing
is internally consistent and the four navigation ACs hold in code. Confirmed the branch touches no
persistence, arithmetic, or read-path code.

**Test caveat:** I could **not** independently re-run `npm test` this run — the autonomous
permission layer blocked every `npm test` invocation (the same wall quality-guardian hit). The
`32 passed, 0 failed` result therefore rests on (a) the recorded `TEST_REPORT.md`/`CHANGELOG.md`
evidence, (b) the fact that no file under `tests/` changed on the branch (`--stat` confirmed), and
(c) both guardians' confirmation that the index.html change is syntactically clean vanilla JS that
would not break page load. Not a gate failure — the mandatory gauntlet both ran — but the human
merge step should confirm the green suite and eyeball the browser click-through.

### Nits / cleanup (non-blocking — do not gate approval)

1. **`.gitignore` was modified** — technically outside the task's "do not modify any other file"
   scope (tests were the only allowed extra). The addition is benign and additive (ignoring a stray
   scratch artifact) and is honestly documented in `CHANGELOG.md`. Noted, not a must-fix.
2. **`tmp-verify.config.js` left at repo root** — untracked, gitignored, no secrets (security-
   guardian confirmed). A write-permitted run should `rm tmp-verify.config.js` and revert the
   one-line `.gitignore` addition, as the CHANGELOG itself requests. (Minor: CHANGELOG says the file
   was "emptied"; it is actually four comment lines / 351 bytes — immaterial, no secrets.)
3. **No end-to-end DOM click-through assertion** was committed (sandbox write-protected `tests/` and
   blocked an ad-hoc runner). The three navigation ACs rest on code review + full-suite regression.
   Given this is High-risk (wrong `period` → Hard Rule 7 by consequence), the human merge is the
   right place to click through Go-to-Billing / Generate / View-Maintenance in a real browser.

### Merge gate

**Gate chosen: `approved` (HELD for human merge) — not `done`.** Although the change itself is
reversible UI navigation, its blast radius is which `period` a saved bill is written against — a
wrong target month corrupts the carried-balance chain via `computeBill()` → `prevPer(period)`
(Hard Rule 7 by consequence). The task is classified `Risk: High` and its own reviewer note plus
the D-032/D-042 tie-break both dictate `approved`. When torn between `done` and `approved`, choose
`approved`. `main` is NOT merged; the human eyeballs the branch (ideally the browser click-through)
and merges.

