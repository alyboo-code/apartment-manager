# TASKS

> Claude's handoff contract to Codex. The ONLY thing Codex executes from.
> One task per entry. Codex updates only the `status` field of the task it is working on.

<!-- ═══════════════════════════════════════════════════════
     BQ-001 · Failed reads must not look like an empty database
     Risk: High · Execution: Solo (Hard Rule 10 — never chained)
     ═══════════════════════════════════════════════════════ -->

### TASK-001 — Make `loadDB()` surface read failures instead of rendering an empty database

status: done
owner: Codex
source: BQ-001
risk: High
checkpoint: Read-path error handling complete

> Risk High — red zone, Hard Rule 4. Solo execution, never chained (Hard Rule 10).

#### Objective

`loadDB()` in `index.html` fires seven Supabase selects via `Promise.all` and checks `.error` on
none of them. Supabase resolves a failed query as `{ data: null, error }` rather than throwing, so
`rooms.data || []` silently converts a connection failure into an empty array, and
`settings.data ? … : newDB().settings` silently resets the electric rate to its default of 17.

The result is an app that renders as a real, empty apartment manager after a failed load. The user
cannot tell this from actual data loss. If they respond by re-entering rooms and bills, each new
row receives a fresh `crypto.randomUUID()` that cannot collide with the real rows still in
Supabase — leaving a permanently duplicated database.

Make a failed read impossible to mistake for real data.

#### Files

- `index.html` → `loadDB()` — the fix.
- `index.html` → `doLogin()` — calls `loadDB()` then unconditionally proceeds to `renderAll()` and
  `init()`. Must not render a successful-looking app after a failed load.
- `index.html` → `init()` — same pattern on the boot path.
- `index.html` → `refreshFromCloud()` — **the second and worse instance.** It calls `loadDB()` then
  `renderAll()` on window focus, on reconnect, and on `visibilitychange`. Its `try/catch` cannot
  fire, because `loadDB()` does not throw. A brief blip while the landlord is mid-task therefore
  blanks the screen they are working in. Confirmed by test: rooms go 2 → 0.
- `index.html` — wherever the new error state's markup and styling belong; match surrounding
  conventions (see `#sync-status` and `#login-err` for how existing states are done).

Do not modify any other file. In particular, **do not edit anything under `tests/`** — the suite
is the acceptance criteria. If you believe a test is wrong, set `status: blocked` and say so;
do not weaken it.

#### Acceptance criteria

1. Every one of the seven results in `loadDB()` has its `.error` checked before its `.data` is
   used.
2. If **any** of the seven failed, the global `db` is **not** reassigned. Whatever was there
   before — including `undefined` on a first load — stays. No partial population, no mixing good
   tables with empty ones.
3. On failure the user sees an explicit, blocking error state saying the data could not be loaded,
   with a retry control. It must be impossible to reach the normal app views showing empty data
   after a failed load.
4. Retrying re-runs `loadDB()` and, on success, proceeds normally to `renderAll()` / `init()`.
5. The failure state distinguishes "could not reach the server" from "the server refused the
   request", consistent with how `classifyWriteError()` treats writes (D-003). The user-facing
   copy may be simple, but a rejection must not be presented as a transient blip.
6. A settings read failure does **not** fall back to `newDB().settings`. Silently resetting the
   electric rate to 17 is itself a Hard Rule 7 problem — wrong rate, wrong bill.
7. On success, behavior is byte-for-byte unchanged from today, including the
   `migrateBillSnapshots()` call at the end.
8. `refreshFromCloud()` never replaces good on-screen data with empty data. If its `loadDB()` call
   fails, the existing `db` and the rendered UI stay as they were; surface the failure without
   destroying what the landlord is looking at.
9. **`npm test` passes — all 32 tests.** The six currently-failing tests in
   `tests/read-failures.spec.js` are this task's acceptance criteria in executable form, and the
   26 that pass today must still pass afterwards.

#### Constraints

- **Hard Rule 3:** do not introduce any whole-db write. This is a read-path task; the write path,
  the outbox, and `classifyWriteError()` are not to be touched.
- **Hard Rule 5:** every select keeps its `.eq('user_id', uid_user)` filter. Do not drop or
  restructure the scoping while refactoring.
- **Hard Rule 9 / D-001:** vanilla JS in `index.html`. No framework, no build step, no npm
  package, no new CDN dependency.
- **Hard Rule 8:** if you update docs, reference function names and DOM ids, never line numbers.
- Keep `Promise.all` — do not serialize the seven queries. Load time matters and parallelism is
  not the bug.
- Match the surrounding code style: the existing comment density in the persistence layer is high
  and explains *why*, not *what*. Follow that.
- Out of scope: offline read caching, retry/backoff policy, and the
  `typeof mortgages !== 'undefined'` dead check (fold that in **only** if it does not widen the
  diff — otherwise leave it).

#### Verification steps

Run `npm test`. The suite is the specification — see `tests/README.md`.

**Baseline before you start: 26 passing, 6 failing.** The six failures are in
`tests/read-failures.spec.js` and are this task's acceptance criteria written as executable tests:

| Test | Acceptance criterion |
|---|---|
| total network failure at boot does not render an empty app | AC-2, AC-3 |
| server rejection is distinguished from being offline | AC-5 |
| ONE failing table out of seven must not produce a partial db | AC-2 |
| a settings-only failure must not silently reset the electric rate | AC-6 |
| retry after a failure loads the data correctly | AC-4 |
| a failed background refresh must not wipe data already on screen | AC-8 |

Done means **32 passing, 0 failing**, with no test modified. The suite drives the real
`index.html` through a stubbed Supabase client, so these are genuine end-to-end runs, not unit
mocks of your own code.

Also confirm by hand once, because a green suite is not the same as a working app:

- Log in normally with a live connection. Everything renders as before.
- With DevTools set to Offline, reload. You get the error state, not an empty apartment manager.
- Restore the connection and use the retry control. The app recovers.

Record the `npm test` summary line and the manual pass in `TEST_REPORT.md`. "Tests pass" alone is
not an acceptable entry — give the counts.

#### Notes for the reviewer

Per D-032 this task lands **`approved`** (held for human merge), not `done`. It touches the read
path and the `db` assignment — squarely in the Hard Rule 4 red zone. It must not auto-merge to
`main`, which is production.

<!-- ═══════════════════════════════════════════════════════
     BQ-002 · "Go to Billing" lands on the wrong month and highlights the wrong tab
     Risk: High · Execution: Solo (Hard Rule 10 — never chained)
     ═══════════════════════════════════════════════════════ -->

### TASK-002 — Fix "Go to Billing": correct target month, target room, and nav highlight

owner: codex
status: approved
source: BQ-002
priority: P1
depends-on: none
risk: High
checkpoint: Dashboard→Billing navigation correct

> Risk High — the outcome of getting this wrong is a bill saved against the wrong `period` (Hard
> Rule 7 by consequence). Solo, never chained (Hard Rule 10).

#### Objective

In `renderNotices()`, the "🧾 No … bill yet" notice's only call to action is `goGenerateBill()`
invoked with **no arguments**. `goGenerateBill(roomId)` then:
- ignores its `roomId` entirely,
- never sets the Billing period selectors `bill-m` / `bill-y`, and
- highlights the wrong nav button: it activates `document.querySelectorAll('nav button')[2]`.
  Nav order is Dashboard 0, Rooms 1, **Tenants 2**, Billing 3 — so index 2 is Tenants. The Billing
  panel shows while the **Tenants** tab reads active.

Because the period is left at whatever `initPeriodSels()` set (the current month), the landlord
arrives to enter *last* month's readings into *this* month's bill. `computeBill()` pulls
`prevBalance` from `prevPer(period)`, so a wrong period corrupts the carried-balance chain from
that point on. Separately, `renderNotices()`'s "View Maintenance" button targets
`nav button:nth-child(7)` — 1-indexed that is **Mortgage**, not Maintenance (Maintenance is the
8th nav button). Two independent hardcoded nav indices, both wrong.

#### Files

- `index.html` → `renderNotices()` — pass the notice's already-computed period into the CTA; fix
  the "View Maintenance" target.
- `index.html` → `goGenerateBill()` — accept and honor a period; set `bill-m`/`bill-y`; scroll to
  the room; activate the Billing nav button by target, not index.
- `index.html` → `renderDashboard()` — the dashboard room-table "Generate" call site, if it needs
  the period-carry contract in AC-2.

Do not modify any other file. Adding or extending a test under `tests/` **is allowed** for this
task (unlike TASK-001, whose tests were the pre-written spec).

#### Acceptance criteria

1. `goGenerateBill()` accepts and honors a target period. When invoked from a dashboard **notice**,
   the Billing period selectors `bill-m`/`bill-y` are set to the notice's period *before*
   navigating, and `renderBilling()` reflects that month. The notice's already-computed period `p`
   in `renderNotices()` is passed into the call rather than recomputed.
2. When invoked from the dashboard **room table** ("Generate", which passes a `roomId`), it carries
   the dashboard's currently-shown month (`dash-m`/`dash-y`) into `bill-m`/`bill-y` — **not** the
   notice period — and scrolls the Billing view to that room's card `#bill-room-<roomId>`.
3. Navigation activates the **Billing** nav button looked up by its `showTab('billing', …)` target,
   never by a hardcoded index. No other tab reads as active afterward.
4. `renderNotices()`'s "View Maintenance" button activates the **Maintenance** nav button, looked up
   by its `showTab('maintenance', …)` target rather than `nth-child(7)`.
5. `npm test` passes — all 32 tests, 0 failing.

#### Constraints

- No framework, no build step, vanilla JS in `index.html` (Hard Rule 9 / D-001).
- Reference DOM ids and function names, never line numbers (Hard Rule 8).
- Do **not** touch persistence, bill/payment arithmetic, or the read path — this is UI navigation.
- Look nav buttons up by their `showTab('<tab>', …)` onclick target so the mapping survives any
  future nav reordering. Do not hardcode a new index.

#### Verification steps

Run `npm test` (32 passing, 0 failing). Manual, recorded in `TEST_REPORT.md` with counts:
- From Dashboard showing a "No <last month> bill yet" notice, click **Go to Billing** → Billing tab
  is active and the period is last month.
- From a dashboard room row, click **Generate** → Billing active, period = the month the dashboard
  was showing, scrolled to that room's card.
- Click **View Maintenance** on the open-repairs notice → Maintenance tab is active.

#### Notes for the reviewer

Consequence is a bill written against the wrong `period` (Hard Rule 7 by consequence). Per D-032
this lands **`approved`** (held for human merge), not `done`.

<!-- ═══════════════════════════════════════════════════════
     BQ-003 · Quick Entry's Total Due disagrees with the bill it saves
     Risk: High · Execution: Solo (Hard Rule 7 — bill arithmetic; never chained)
     ═══════════════════════════════════════════════════════ -->

### TASK-003 — Make Quick Entry's preview equal the bill it actually saves

owner: codex
status: codex
source: BQ-003
priority: P1
depends-on: none
risk: High
checkpoint: Quick Entry preview reconciled with saved bill

> Risk High — bill arithmetic, red zone under Hard Rule 7. **Worked numeric examples required in
> `TEST_REPORT.md`, not just "tests pass".** Solo, never chained (Hard Rule 10).

#### Objective

Three formulas that must agree do not. `computeBill()` totals
`rent + electricity + water + wifi + prevBalance + carryIn + extrasTotal`. `updateBillRow()` (the
main Billing grid's live preview) matches it, including `carryIn` and `extrasTotal`. `qeCalc()`
(Quick Entry's live preview) totals `rent + elec + water + wifiAmt + prevBal` and stops — **no
`carryIn`, no `extras`**. So a room carrying a transferred balance (set by `executeTransfer()`) or a
one-off charge (set by `saveCharges()`) previews low, and `qeGrand()` sums the understated per-room
totals.

Second, separate defect in the same path: `saveQuickEntry()` calls
`computeBill(r.id, p, prev, curr, persons, wifi)` **without** the 7th `away` argument, so
`computeBill()` falls back to the saved away-flag (regular room with `water === 0`) and writes
`water = 0`; meanwhile `qeCalc()` unconditionally previews `persons × water`. A room marked away
previews water charged but saves water zero.

Make Quick Entry's preview equal, room for room, the `totalDue` that `saveQuickEntry()` writes.

#### Files

- `index.html` → `qeCalc()` — add `carryIn` + `extrasTotal` from the existing bill; honor the away
  state consistently with what gets saved.
- `index.html` → `qeGrand()` — only if the grand-total roll-up needs adjustment.
- `index.html` → `saveQuickEntry()` — reconcile the `away` argument so preview == saved (either
  pass `away` explicitly, or leave `computeBill()`'s fallback and make `qeCalc()` match that
  fallback — pick whichever makes preview == saved and state which in `TEST_REPORT.md`).

Adding or extending a test under `tests/` **is allowed** for this task.

#### Acceptance criteria

1. `qeCalc()`'s per-room total includes `carryIn` (= `existing.carryIn`) and `extrasTotal`
   (= sum of `existing.extras[].amount`) read off the room's existing bill for the period, exactly
   as `computeBill()` / `updateBillRow()` compute them.
2. `qeCalc()` honors the away state consistently with what `saveQuickEntry()` → `computeBill()`
   persists: an away-state room (regular room whose saved bill has `water === 0`) previews water = 0
   and wifi = 0, matching the saved figure. Quick Entry does **not** gain an away control — it must
   only stop misreporting (PROP-003 recommendation).
3. For every room, the number `qeCalc()` displays equals the `totalDue` that `saveQuickEntry()`
   writes via `computeBill()` for the same inputs. `qeGrand()` equals the sum of those saved
   `totalDue` values.
4. Behavior is byte-for-byte unchanged for rooms with no `carryIn`, no `extras`, and not away.
5. `npm test` passes — all 32 tests, 0 failing.

#### Constraints

- **Hard Rule 7:** do not change the arithmetic in `computeBill()` — align the preview *to* it.
- No framework/build; vanilla JS (D-001). Names not line numbers (Hard Rule 8).
- Do not touch the persistence or read path.

#### Verification steps

**Hard Rule 7 — `TEST_REPORT.md` must carry worked numeric examples**, with the `npm test` counts:
- (a) A room with a `carryIn` and one extra charge: show `qeCalc()` preview == saved `totalDue`
  with the full arithmetic written out.
- (b) An away-marked room: show preview water == saved water (0).

Add a Playwright assertion in `tests/billing-math.spec.js` (it already drives the real `index.html`
through a stubbed Supabase client — follow its patterns) proving `qeCalc()`'s displayed total equals
the saved bill's `totalDue` for a room with `carryIn` + `extras`. Run `npm test` — must be **32
passing, 0 failing** (33+ if you add a test). Manual: open Quick Entry for a room with a transferred
balance → the previewed Total Due matches the bill after Save.

#### Notes for the reviewer

Red zone, Hard Rule 7. Verify the worked examples in `TEST_REPORT.md`, not just a green suite. Per
D-032 this lands **`approved`** (held for human merge), not `done`.

<!-- ═══════════════════════════════════════════════════════
     BQ-004 · Bill Sheet omits moved-out tenants who still owe for that month
     Risk: High · Execution: Solo (Hard Rule 7 by consequence; never chained)
     ═══════════════════════════════════════════════════════ -->

### TASK-004 — Bill Sheet must include moved-out tenants who have a saved bill for the month

owner: codex
status: codex
source: BQ-004
priority: P1
depends-on: none
risk: High
checkpoint: Bill Sheet room filter matches Dashboard/Billing

> Risk High — decides which bills land on a printed collection artifact (Hard Rule 7 by
> consequence). Solo, never chained (Hard Rule 10).

#### Objective

`renderBillSheet()` filters rooms with `roomStatus(r) === 'active'` only. `renderDashboard()` and
`renderBilling()` both use `roomStatus(r) === 'active' || getBill(r.id, p)`, each with a comment
that moved-out/inactive rooms must still show for months where they have a saved bill, so past
records are never hidden. Because the Bill Sheet omits those rooms, a tenant who moved out mid-cycle
still owing for the month they lived there is absent from the printed sheet handed to the caretaker,
and the money is never asked for. The sheet's Total Billed / Balance are computed from the same
truncated `rows`, so they understate the month to match. `printBillSheet()` prints exactly what
`renderBillSheet()` builds, so the omission reaches paper. The balance stays visible on Dashboard
and Billing — the app knows about it and hides it only from the artifact that drives collection.

#### Files

- `index.html` → `renderBillSheet()` — the room filter, the totals derived from `rows`, and the
  moved-out badge.
- `index.html` → `printBillSheet()` — only if the printed markup needs the badge shown/hidden.

Adding or extending a test under `tests/` **is allowed** for this task.

#### Acceptance criteria

1. `renderBillSheet()` uses the same filter as `renderDashboard()` / `renderBilling()`:
   `roomStatus(r) === 'active' || getBill(r.id, p)`.
2. The Bill Sheet totals (Total Billed, Collected, Balance, and every per-column sum) are computed
   from the corrected `rows`, so a moved-out tenant's saved bill is included.
3. A moved-out tenant's row is visually marked on the sheet using the existing `badge b-moved`
   ("Moved Out") that Dashboard/Billing already append in this exact case.
4. Rooms with no saved bill for the period render as they do today; the "N of M rooms billed" count
   still means rooms that have a bill.
5. `npm test` passes — all 32 tests, 0 failing.

#### Constraints

- One-predicate change to match the two screens that already got it right; keep the totals math
  derived from the visible `rows` so they never diverge.
- No framework/build (D-001). Names not line numbers (Hard Rule 8). Do not touch persistence or the
  read path.

#### Verification steps

Hard Rule 7 by consequence — `TEST_REPORT.md` must show a worked case with the `npm test` counts: a
room set moved-out with a saved bill carrying a balance for period P appears on the Bill Sheet for P
with the Moved Out badge, and the sheet's Total Balance includes that balance. Add a Playwright
assertion (extend `tests/billing-math.spec.js` or add a spec) reproducing it. Run `npm test` — 32
passing, 0 failing (33+ with the added test). Manual: generate a bill, move that tenant out, open
the Bill Sheet for that month → row present with badge, totals include it.

#### Notes for the reviewer

Red zone by consequence — Hard Rule 7 governs what a real person is asked to pay. Per D-032 this
lands **`approved`** (held for human merge), not `done`.

<!-- ═══════════════════════════════════════════════════════
     BQ-005 · Background refresh silently discards meter readings typed into the Billing grid
     Risk: High · Execution: Solo (read path, Hard Rules 3-4; never chained)
     ═══════════════════════════════════════════════════════ -->

### TASK-005 — Background refresh must not discard unsaved readings in the Billing grid

owner: codex
status: codex
source: BQ-005
priority: P1
depends-on: TASK-001
risk: High
checkpoint: refreshFromCloud guards unsaved Billing input

> Risk High — `refreshFromCloud()` is the read path; the fix changes when `loadDB()` / `renderAll()`
> are allowed to run. Red zone under Hard Rules 3-4. Solo, never chained (Hard Rule 10).

#### Objective

`refreshFromCloud()` runs on `visibilitychange`, `focus`, and `online`. It guards on `_refreshing`,
a missing `_session`, an open `#overlay`, a non-empty outbox, and an 8s throttle — then runs
`loadDB()` + `renderAll()`, which rebuilds the Billing grid from `db`. The grid's inputs
(`prev-<id>`, `curr-<id>`, `persons-<id>`, `wifi-<id>`, `away-<id>`) are inline in
`#billing-content`, **not** in a modal, so the open-`#overlay` guard — the codebase's own
"don't yank an in-progress edit" acknowledgement — never protects them. On a phone, typing eight
rooms' readings then briefly switching apps fires `visibilitychange`, and a **successful** refresh
silently wipes every unsaved reading. Quick Entry (a modal) is protected; the main grid it
duplicates is not.

This is distinct from the *failed*-refresh case TASK-001 fixed (leave `db` intact, quiet toast).
This is a **successful** refresh discarding un-saved local input. Per PROP-005, **suppress** the
refresh while readings are pending — matching the open-modal precedent — rather than
refresh-and-restore.

#### Files

- `index.html` → `refreshFromCloud()` — add the early-return guard.
- `index.html` — a small helper to detect unsaved Billing-grid input, placed near the billing
  render code, if needed.

Adding or extending a test under `tests/` **is allowed** for this task.

#### Acceptance criteria

1. `refreshFromCloud()` returns early (no `loadDB()`, no `renderAll()`) when the **Billing** tab is
   the active view *and* its grid holds unsaved meter-reading input — i.e. a `curr-<id>` (or other
   editable grid input) value differing from the saved bill state it was rendered from. Model the
   guard on the existing open-`#overlay` early return.
2. The suppression is specific to unsaved Billing input: a refresh still runs normally when the grid
   is untouched or the user is on another tab, subject to the existing guards.
3. The *failed*-refresh behavior TASK-001 added (toast + leave `db`/UI intact) is unchanged.
4. Once the landlord saves (Save Bill / Save All Bills) or the grid no longer holds unsaved input,
   refreshes resume normally.
5. `npm test` passes — all 32 tests, 0 failing.

#### Constraints

- **Hard Rules 3-4:** do not alter `loadDB()` and introduce no whole-db write. Add only an
  early-return guard in `refreshFromCloud()`.
- Keep the guard cheap — it runs on every window focus. Reuse existing state/helpers.
- No framework/build (D-001). Names not line numbers (Hard Rule 8).

#### Verification steps

Add a Playwright test (new spec, or follow `tests/read-failures.spec.js` / `tests/write-path.spec.js`
patterns): type a `curr-<id>` value, dispatch `visibilitychange` / `focus` with a *successful*
stubbed `loadDB()`, and assert the typed value survives. Run `npm test` — 32 passing, 0 failing
(33+ with the added test). Manual, recorded in `TEST_REPORT.md` with counts: on Billing, type
readings for several rooms, switch tabs/apps and back → readings still present; Save, switch back →
normal refresh resumes.

#### Notes for the reviewer

Touches the read path (`refreshFromCloud`), Hard Rules 3-4 red zone. Per D-032 this lands
**`approved`** (held for human merge), not `done`.

<!-- ═══════════════════════════════════════════════════════
     BQ-006 · Period selectors default to the current month, but the work is last month
     Risk: High · Execution: Solo (steers the billed period; never chained)
     ═══════════════════════════════════════════════════════ -->

### TASK-006 — Default billing-cycle selectors to last month; leave transactional tabs on current

owner: codex
status: codex
source: BQ-006
priority: P2
depends-on: TASK-002
risk: High
checkpoint: Period-selector defaults split by tab

> Risk High — the default decides which `period` a saved bill is written against. The change itself
> is a reversible UI default, but its blast radius is billing data, so it takes the safer gate
> (D-042 tie-break). Solo, never chained (Hard Rule 10).

#### Objective

`initPeriodSels()` sets `mSel.value = cm` (current month) for all seven prefixes — `dash`, `bill`,
`pay`, `exp`, `mort`, `bs`, `rep`. But the monthly rhythm is to bill the month that just *ended*
(you cannot bill October until October is over), and the app already encodes this: `renderNotices()`
treats the previous month as the urgent case unconditionally, and only flags the current month once
`today.getDate() >= 25`. So the landlord hand-changes the month on Billing, then again on Bill Sheet
to print, then again on Dashboard to check — each a chance to read or write the wrong month, and
each compounding TASK-002. Default the billing-cycle selectors to the previous month; leave the
transactional selectors (Payments, Expenses, Mortgage), recorded as they happen, on the current
month. Implements PROP-006's recommended split.

#### Files

- `index.html` → `initPeriodSels()`.

Adding or extending a test under `tests/` **is allowed** for this task.

#### Acceptance criteria

1. When `today.getDate() < 25`, `initPeriodSels()` defaults `bill`, `bs`, and `dash` to the
   **previous** month/year; when `today.getDate() >= 25`, it defaults them to the current month.
   Mirror the 25th boundary `renderNotices()` already uses.
2. `pay`, `exp`, `mort`, and `rep` continue to default to the current month/year.
3. The previous-month default rolls the year back in January (prev month of January = December of
   the prior year). Confirm the year `<option>` list still includes the defaulted year — the range
   `startY … cy+1` should already cover it; verify the prev-year case.
4. Only the selected default changes; the option lists are unchanged, and manually changing any
   selector still works and persists exactly as today.
5. `npm test` passes — all 32 tests, 0 failing.

#### Constraints

- This encodes PROP-006's recommended split: `bill`/`bs`/`dash` → previous (before the 25th),
  `pay`/`exp`/`mort`/`rep` → current. If a specific selector's default is genuinely ambiguous to
  you, set `status: blocked` and record the question rather than guessing.
- No framework/build (D-001). Names not line numbers (Hard Rule 8).

#### Verification steps

Add a test asserting that with a mocked before-the-25th date the `bill-m` / `bs-m` / `dash-m`
selects default to last month while `pay-m` / `exp-m` / `mort-m` default to this month, plus a
January case that rolls the year back. Run `npm test` — 32 passing, 0 failing (33+ with the added
test). Manual, recorded in `TEST_REPORT.md` with counts: load before the 25th → Billing / Bill Sheet
/ Dashboard show last month; Payments / Expenses / Mortgage show this month.

#### Notes for the reviewer

A reversible UI default, but its blast radius is which `period` a saved bill targets (it compounds
TASK-002). Per the D-042 tie-break and D-032, this lands **`approved`** (held for human merge), not
`done`.
