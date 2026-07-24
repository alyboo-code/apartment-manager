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

## TASK-003 — Make Quick Entry's preview equal the bill it actually saves · 2026-07-25

**Verdict: APPROVED** · branch `task-003` · reviewer: Claude (autonomous)

Scope of the diff: `index.html` → `qeCalc()` only (≈+10 loc), plus `CHANGELOG.md`/`TEST_REPORT.md`
evidence and AI-OS bookkeeping files. `git diff main..task-003 -- index.html` touches nothing but
`qeCalc()`. `saveQuickEntry()`, `qeGrand()`, and `computeBill()` are unchanged. Working tree clean;
no `tests/` change was committed (see must-fix note).

### Review checks

Both checks below were performed by me in this single pass (no sub-agents this run), by reading the
diff and the surrounding functions in `index.html` directly.

**1. SECURITY — RAN. CLEAN, no findings.** This is a pure client-side arithmetic change inside a
live-preview function:
- No Supabase query added or altered — no read path, no write path, no `persistUpsert`/`persistDelete`,
  no outbox, no `user_id` scoping surface touched (Hard Rules 3–6 not implicated). `qeCalc()` reads
  only the in-memory `db.bills` via `getBill()`, which was populated under the existing per-`user_id`
  load.
- No new DOM sink: the total and breakdown are written with `textContent`, not `innerHTML`; no
  interpolation of user/DB strings into markup. `extras` is summed with `existing.extras.reduce((s,e)
  => s + (+e.amount || 0), 0)` — numeric coercion, `Array.isArray` guarded, no injection surface.
- No secret leakage; no auth change. Nothing under Hard Rules 3–6 is affected.

**2. ACCEPTANCE — traced criterion by criterion against the real code, not "looks plausible".**
I diffed `qeCalc()`'s new `total` term-by-term against `computeBill()` (index.html `computeBill`,
the arithmetic authority) and against `saveQuickEntry()`'s call `computeBill(r.id, p, prev, curr,
persons, wifi)` (6 args — omits the 7th `away`):

- **AC-1 MET** — `qeCalc()` now adds `carryIn = existing ? (+existing.carryIn || 0) : 0` and
  `extrasTotal = Array.isArray(existing.extras) ? existing.extras.reduce(...) : 0`, read off the
  same `getBill(roomId, p)` bill. These are byte-identical to `computeBill()`'s own `carryIn` /
  `extrasTotal` expressions.
- **AC-2 MET** — `awayFlag = !!existing && !caretaker && (+existing.water === 0)` reproduces exactly
  `computeBill()`'s fallback branch `(!!existing && !caretaker && (+existing.water === 0))` used when
  the `away` arg is omitted — which is precisely what `saveQuickEntry()` does. `water` and `wifiAmt`
  are both gated by `(caretaker || awayFlag) ? 0 : …`, matching `computeBill()`. Quick Entry gains
  no away control, as required (PROP-003).
- **AC-3 MET** — full term reconciliation: `rent + elec + water + wifiAmt + prevBal + carryIn +
  extrasTotal` equals `computeBill()`'s `rent + electricity + water + wifi + prevBalance + carryIn +
  extrasTotal` for the same inputs (`elec`/`electricity` both `round(kWh × elecRateFor(p))` with the
  same `p`; `prevBal`/`prevBalance` both `getBill(roomId, prevPer(p))?.balance ?? 0`; `wifi` both
  gated the same and, since `saveQuickEntry` always passes the checkbox, `wifiOverride` is always
  defined so `computeBill` uses `wifiOverride ? s.wifi : 0`). `qeGrand()` sums the corrected
  `qe-total-*` cells, so the grand total follows. The `kWh < prev` and empty-`curr` early returns
  are untouched.
- **AC-4 MET** — for a room with no `carryIn`, no `extras`, and not away, all three added terms are
  0 (`carryIn=0`, `extrasTotal=0`, `awayFlag=false`), so the computed `total` is identical to the
  pre-change `rent + elec + water + wifiAmt + prevBal`.
- **AC-5 — DEFERRED to the objective gate.** `npm test` requires an approval that is unavailable in
  this autonomous run, so I could not execute the suite myself. This runner runs `npm test`
  independently after me as the hard gate; `TEST_REPORT.md` and `CHANGELOG.md` both report 32
  passed / 0 failed. I did not personally confirm green — flagged honestly rather than assumed.

**Hard Rule 7 (worked numeric examples required).** Present and correct in `TEST_REPORT.md`:
(a) Room 101, carryIn 500 + one 300 extra, not away, curr 200 / prev 150 →
`5000 + 850 + 300 + 300 + 0 + 500 + 300 = 7250`, preview == saved `totalDue` 7250 (pre-fix would
have shown 6450, understated by the 500+300). (b) Away room (saved `water===0`) →
`5000 + 850 + 0 + 0 + 0 = 5850`, preview water 0 == saved water 0. I re-verified both sums by hand
against `computeBill()`; both hold. `computeBill()`'s arithmetic is untouched — the preview was
aligned *to* it, satisfying the Hard Rule 7 constraint.

### Must-fix

None blocking approval.

### Nits / follow-up (non-blocking)

1. **No committed Playwright assertion.** The verification step asked for an added assertion in
   `tests/billing-math.spec.js` proving `qeCalc()`'s displayed total == saved `totalDue` for a
   `carryIn`+`extras` room. It was not committed — `tests/` was write-denied in the build run, and
   this is honestly disclosed in `TEST_REPORT.md`/`CHANGELOG.md`. The numbered acceptance criteria
   (AC-1…5) do not strictly require it (AC-5 is "32 tests"), and the reconciliation is verified by
   term-by-term code trace + the worked examples + the build's scratchpad runtime check
   (`{"preview":7250,"savedTotalDue":7250}` and `{"preview":5850,"savedTotalDue":5850,"savedWater":0}`).
   A write-permitted run should land the committed assertion so the guarantee is regression-locked.
2. **Breakdown text (`brkEl`) still omits `carryIn`/`extras`.** It shows `+bal <prevBal>` but not the
   carryIn/extras now folded into the total, so the itemization hint is slightly incomplete while the
   headline total is correct. Cosmetic, matches the pre-existing breakdown convention, outside the
   acceptance criteria — noted, not a must-fix.

### Merge gate

**Gate chosen: `approved` (HELD for human merge) — not `done`.** This is squarely red-zone under
Hard Rule 7: the change reconciles bill arithmetic that decides what a real tenant is asked to pay.
Even though the numbers are now provably equal, a bill-math surface never auto-ships (D-032; the
task's own reviewer note dictates `approved`). Additionally, AC-5's suite run is deferred to this
runner's objective gate rather than personally confirmed, which independently bars `done`. `main` is
NOT merged; the human confirms the green suite and, ideally, opens Quick Entry for a room with a
transferred balance to see preview == saved before merging.

