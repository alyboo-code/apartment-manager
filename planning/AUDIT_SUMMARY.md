# Audit Summary — persistent state for /audit (D-043)

> Auto-maintained by `tools/Run-Audit.ps1`. The two state lines below are written by the script
> itself (deterministic, not the LLM); the sections after are Claude's own running notes. Don't
> hand-edit `last-audited-commit`/`last-full-refresh` — a wrong value here just means the next audit
> re-reads more (or less) than it needs to, not a correctness risk to the app itself.

## State
- last-audited-commit: 2ecd44561aa321b185e3f36449899b4180bcf3cc
- last-full-refresh: 2026-07-20

## App summary

Full read of `index.html` (4,380 lines — markup, CSS and all JS in one file; `style.css` and
`app.js` do not exist and never have). Structure, so a future audit can jump straight to a
subsystem instead of re-deriving the map:

- **Ten tabs**, each a `<section id="tab-*">` with one render function, dispatched through the
  `renders` map in `showTab()` and again in `renderAll()`: Dashboard, Rooms, Tenants, Billing,
  Payments, Expenses, Mortgage, Maintenance, Bill Sheet, Reports.
- **Billing math lives in three places that must agree**: `computeBill()` (authoritative — what
  gets saved), `updateBillRow()` (Billing grid live preview), `qeCalc()` (Quick Entry live
  preview). `retotalBill()` and `recalcBill()` re-derive totals from stored components;
  `repricedParts()` / `billIsStale()` / `recomputeBillsFrom()` re-price saved bills when a rate
  changes, rippling the change forward as a **delta** to `prevBalance` rather than an overwrite.
  Any future audit touching money should diff those three formulas first — that comparison is what
  produced PROP-003.
- **Rate history is effective-dated.** `elecRateFor(period)` walks `settings.electricityRates`
  (sorted `from` breakpoints) so old months keep old rates; `settings.electricity` is only the
  fallback and the display value. Water and WiFi have no history — they are flat settings, so
  re-pricing an old month applies *today's* water rate to it.
- **Balance carries forward two ways**: `prevBalance` (automatic, from `prevPer(period)`'s bill)
  and `carryIn` (manual, set by `executeTransfer()` when a tenant changes rooms — negative on the
  source bill, positive on the target). `extras[]` holds one-off named charges from
  `saveCharges()`. Previews that forget `carryIn` or `extras` understate the bill.
- **Rooms carry a tenant identity, not just a room.** `roomStatus()` reconciles the legacy `active`
  bool with the newer `status` text (`active` / `inactive` / `moved-out`). Bills snapshot
  `tenantName` + `roomNumber` at save time (`saveBill()`, backfilled by `migrateBillSnapshots()`)
  so history stays readable after a room is deleted; `billRoomLabel()` is the accessor and it
  prefers the snapshot. Dashboard and Billing deliberately show moved-out rooms for months where
  they have a bill — Bill Sheet does not, which is PROP-004.
- **Persistence matches the documented architecture.** Every mutator goes through `persistUpsert()`
  / `persistDelete()`; `bulkReplaceCloud()` and `replaceCloudWithDb()` are reached only from
  Restore. `classifyWriteError()` correctly separates offline-queue from server-rejection and
  `updateSyncStatus()` renders the red "NOT saved" badge. The **write** path is well defended; the
  **read** path is not, which is the already-known PROP-001 / BQ-001 / TASK-001 thread.
- **`refreshFromCloud()`** re-reads and re-renders on `focus` / `visibilitychange` / `online`,
  guarded only by `_refreshing`, an open `#overlay`, a non-empty outbox and an 8s throttle. That
  guard list is small and load-bearing — two separate defects already trace to it.
- **XSS defense is `esc()` / `escAttr()`**, applied at nearly every interpolation of user text. The
  exceptions found are `renderOverdueAlerts()` (`room.number`, `room.tenant`) and two report
  aggregations (expense category, payment mode). All are self-entered by the single landlord today,
  so impact is low — noted below rather than proposed.
- **Import/export**: hand-rolled `parseCSV()` (quoted fields, no escaped-quote handling),
  `parseDate()` normalizes several formats, Restore repairs 5-digit-year typos via `fixDate()`.
  JSON backup is whole-`db` download; Restore replaces cloud contents.
- **Mobile** is handled by a CSS table→card transform under 640px, fed `data-label` attributes by
  `decorateTables()` running off a `MutationObserver` — no render function has to know about it.
- **Dead code**: `fillPeriodSels()` is defined and never called; `initPeriodSels()` superseded it.
  `saveWithFallback()` is a deliberate legacy alias. Neither is worth a proposal.

## Already-surfaced findings

Do not re-propose any of these. Tracked elsewhere:

- **`loadDB()` renders a failed read as an empty database** — PROP-001 → BQ-001 → TASK-001, human
  approved. Includes the `refreshFromCloud()` wipe-on-*failed*-refresh and the dead
  `typeof mortgages !== 'undefined'` check, both folded in. See ROADMAP Known Issues.
- **`rooms` has two overlapping status fields** (`active` bool and `status` text) — ROADMAP Known
  Issues, not scheduled. `roomStatus()` reconciles them and `submitRoom()` writes both, so this is
  currently latent rather than broken.
- **No test infrastructure** — RESOLVED 2026-07-19, Playwright suite, see D-005.

Raised by this run (2026-07-20), pending human decision — PROP-002 through PROP-006:

- **PROP-002** — `goGenerateBill()` ignores its `roomId` and the notice's period, landing the
  landlord on the current month; plus two wrong hardcoded nav indices (`nav button[2]` = Tenants
  not Billing; `nth-child(7)` = Mortgage not Maintenance).
- **PROP-003** — `qeCalc()` omits `carryIn` and `extras` and ignores the saved away-flag, so Quick
  Entry's Total Due and grand total disagree with what `computeBill()` writes.
- **PROP-004** — `renderBillSheet()` filters active-only, so a moved-out tenant who still owes for
  that month is missing from the caretaker's printed collection sheet and from its totals.
- **PROP-005** — `refreshFromCloud()`'s open-modal guard does not cover the Billing grid's inline
  inputs, so a successful background refresh discards un-saved meter readings. Distinct from the
  failed-refresh issue already in TASK-001.
- **PROP-006** — all seven period selectors default to the current month while the billing rhythm
  is last month; `renderNotices()` already encodes the opposite assumption.

Examined and deliberately NOT proposed (so a future audit can skip re-litigating them):

- **Unescaped user text in three spots** — `renderOverdueAlerts()`, and the expense-category /
  payment-mode aggregations in `renderReports()`. Real policy violations against the file's own
  XSS-defense section, but every value is self-entered by the sole landlord, so there is no
  attacker today. Worth folding into any task that already touches those functions; not worth a
  proposal of its own.
- **`fillPeriodSels()` is dead code** — style nitpick, explicitly out of scope for this audit.
- **`parseCSV()` does not handle escaped quotes (`""`)** — real limitation, but import is a
  one-time onboarding path and the template steers users away from it. Low value.
- **Water/WiFi rates have no effective-dated history** the way electricity does, so re-pricing an
  old month applies today's water rate to it. Plausible future issue; no evidence it has bitten,
  and adding a second rate-history mechanism is a real design decision, not a fix. Revisit only if
  the landlord actually changes the water rate.
