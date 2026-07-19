# PROPOSALS

> Triage output, awaiting human approval. **Nothing here is approved to build.**
> You approve items into `planning/ROADMAP.md` / `planning/BUILD_QUEUE.md` — UNLESS a proposal's own
> `▶ Decision` is Approve and its own `▶ Risk` is Low, in which case it promotes itself straight to
> `planning/BUILD_QUEUE.md` with no reply needed (D-042). Everything else still waits for you.

### PROP-001 — `loadDB()` renders a failed read as an empty database
- ▶ Decision: Approve — a silent read failure is indistinguishable from real data loss, and the
  recovery behavior it provokes (re-entering data) actively corrupts the database. Fix next.
- ▶ Risk: High — touches the read path and the in-memory `db` swap. Red zone per Hard Rule 4.
  Cannot self-promote under D-042; needs human approval.
- type:        bug
- source captures: 20260719T0000Z-manual1-bug (×1)
- goal alignment:  supports — directly serves North-star #1 (never lose or corrupt billing
  history). Current Objective: make the AI Dev OS produce trustworthy work on this app.
- expected user value: The landlord — the only user today. Prevents the single worst
  non-malicious outcome available in the current code: opening the app, seeing an empty
  apartment manager, re-entering rooms and bills by hand, and silently duplicating the database
  because client-generated UUIDs never collide. Every month of billing history is at stake.
- evidence:    Found by direct code audit of `loadDB()`. All seven selects use `x.data || []`
  with no `.error` check; `settings` additionally falls back to `newDB().settings`, silently
  resetting the electric rate. Supabase's documented contract is that queries resolve rather
  than throw, so `try/catch` would not help either. Asymmetry is the tell: the write path
  (`classifyWriteError`) is carefully defended, the read path is not defended at all.
- effort:      S — one function, plus an error state in the UI.
- dependencies: none
- confidence:  high — the failure mode is readable directly from the code.
- ambiguity:   What the UI should do on failure. Options: block with a retry screen, or show a
  banner over a clearly-marked stale/empty state. Recommend blocking — a partial render is what
  causes the re-entry mistake in the first place.
- why now vs later: Now. Every day it ships is a day a bad connection can cost a month of
  billing records, and it gets more expensive to fix once other landlords are on it.
- AI-recommended priority: P0
- **status:** approved (human approved in session 2026-07-19; recorded per Decision Priority #1)

### PROP-002 — "Go to Billing" lands on the wrong month and highlights the wrong tab
- ▶ Decision: Approve — the dashboard tells the landlord which month is missing a bill, then
  drops them on a screen showing a different month, with no indication the month changed.
- ▶ Risk: High — the outcome is a bill saved against the wrong `period`. That is billing data,
  not presentation. Cannot self-promote under D-042.
- type:        bug
- source captures: /audit (this run)
- goal alignment:  supports — serves North-star #1 (never lose or corrupt billing history) and #3
  (make the monthly management convenient). Current Objective: close the paths where a transient
  failure becomes permanent data loss.
- expected user value: The landlord, on the highest-traffic path in the app. `renderNotices()`
  raises an urgent red notice for the *previous* month ("No October bill yet for Room 101") whose
  only call to action is `goGenerateBill()`. That function ignores both of its inputs: it never
  reads the notice's period, and it discards the `roomId` the dashboard passes at
  `index.html` → `renderDashboard()`. The landlord arrives on Billing still showing the current
  month — the period selectors are initialized to today by `initPeriodSels()` and nothing resets
  them — and enters October's meter readings into November's bill. Nothing warns them, because
  every reading is individually plausible. The wrong month then propagates: `computeBill()` pulls
  `prevBalance` from `prevPer(period)`, so the carried balance chain is wrong from that point on.
- evidence:    Direct code audit. `goGenerateBill(roomId)` at `index.html` takes `roomId` and
  never references it, and never touches `bill-m` / `bill-y`. Same function highlights
  `document.querySelectorAll('nav button')[2]` — index 2 is **Tenants**, not Billing (Dashboard 0,
  Rooms 1, Tenants 2, Billing 3), so the Billing panel shows while the Tenants tab reads as
  active. The same off-by-one appears in `renderNotices()`, whose "View Maintenance" button passes
  `nav button:nth-child(7)` — 1-indexed, that is **Mortgage**, not Maintenance. Two independent
  hardcoded nav indices, both wrong.
- effort:      S — set the two period selects from the notice's period, use the roomId to scroll to
  `#bill-room-<id>`, and look the nav button up by its target instead of by index.
- dependencies: none
- confidence:  high — all three defects are readable directly from the code.
- ambiguity:   Whether "Generate" from the dashboard room table should also switch the period. It
  should not — that button is scoped to the month the dashboard is already showing, so it should
  carry `dash-m`/`dash-y` across rather than the notice's period.
- why now vs later: Now. It is cheap, and it is the mechanism by which the app's own reminder
  leads the landlord into mis-dating a bill.
- AI-recommended priority: P1
- status:      pending

### PROP-003 — Quick Entry's Total Due disagrees with the bill it actually saves
- ▶ Decision: Approve — the fast path shows the landlord one number and writes a different one.
- ▶ Risk: High — bill arithmetic, red zone under Hard Rule 7. Needs worked examples in
  `TEST_REPORT.md`, not just "tests pass". Cannot self-promote under D-042.
- type:        bug
- source captures: /audit (this run)
- goal alignment:  supports — North-star #1 (never lose or corrupt billing history) and #3. Current
  Objective: close the paths where a transient failure becomes permanent data loss.
- expected user value: The landlord, on step 2 of the core value loop. Quick Entry is the
  designed-for-speed path — one row per room, Enter to advance — and it is the screen most likely
  to be used standing in a hallway with a phone. Its per-room "Total Due" and its
  "TOTAL — ALL ROOMS" footer are what the landlord reads to sanity-check the month before
  committing. Both are computed by a formula that is missing terms the saved bill includes.
- evidence:    Direct code audit, by comparing three formulas that should agree.
  `computeBill()` totals `rent + electricity + water + wifi + prevBalance + carryIn + extrasTotal`.
  `updateBillRow()` — the main Billing grid's live preview — matches it, including `carryIn` and
  `extrasTotal`. `qeCalc()` — Quick Entry's live preview — totals
  `rent + elec + water + wifiAmt + prevBal` and stops there: no `carryIn`, no `extras`. So a room
  carrying a transferred balance (set by `executeTransfer()`) or a one-off charge (set by
  `saveCharges()`) previews low, and `qeGrand()` sums the same understated figures. Second,
  separate mismatch in the same function: `saveQuickEntry()` calls `computeBill()` without the
  `away` argument, so `computeBill()` falls back to the saved away-flag and writes `water = 0`,
  while `qeCalc()` unconditionally previews `persons × water`. A room marked away previews water
  charged and saves water zero.
- effort:      S — extend `qeCalc()` to read `carryIn`/`extras` off the existing bill and honor the
  saved away-flag, the way `updateBillRow()` already does.
- dependencies: none — but it is worth landing with PROP-005, which is the other half of trusting
  what Billing shows you.
- confidence:  high — three formulas that should be identical, side by side.
- ambiguity:   Whether Quick Entry should also *expose* away and carry-in as editable controls, or
  merely stop misreporting them. Recommend the latter only: PP4 says prefer the simplest version
  that still serves the job, and the main Billing grid already owns those controls.
- why now vs later: Now. A preview that disagrees with what gets written trains the landlord to
  distrust the screen, and the discrepancy is silent — the saved bill is simply different from the
  one they approved.
- AI-recommended priority: P1
- status:      pending

### PROP-004 — Bill Sheet omits moved-out tenants who still owe for that month
- ▶ Decision: Approve — the caretaker's collection sheet is missing balances that are still owed.
- ▶ Risk: High — it decides what a real person is asked to pay, and the fix changes which bills
  land in a printed artifact. Red zone under Hard Rule 7 by consequence if not by arithmetic.
- type:        bug
- source captures: /audit (this run)
- goal alignment:  supports — North-star #1 (the record of who owes what *is* the product) and #3.
  Current Objective: close the paths where a transient failure becomes permanent data loss.
- expected user value: The landlord and the caretaker. The Bill Sheet is step 3 of the core value
  loop by name — "Generate the bill sheet", the printable summary handed to the caretaker who does
  the collecting. If a tenant moved out mid-cycle still owing for the month they lived there, that
  row is absent from the sheet and the money is never asked for. The balance stays visible on
  Dashboard and Billing, so the app both knows about it and hides it from the one artifact that
  drives collection.
- evidence:    Direct code audit of an inconsistency the codebase elsewhere treats as deliberate.
  `renderDashboard()` and `renderBilling()` both filter
  `roomStatus(r) === 'active' || getBill(r.id, p)`, each carrying a comment explaining the intent:
  "moved-out or inactive rooms still show for months where they have a saved bill, so past records
  are never hidden." `renderBillSheet()` filters `roomStatus(r) === 'active'` only, with no such
  comment. Its totals row is computed from the same truncated `rows`, so the printed
  Total Billed / Balance understate the month to match. `printBillSheet()` prints exactly what
  `renderBillSheet()` built, so the omission reaches paper.
- effort:      S — one filter, to match the two screens that already got this right.
- dependencies: none
- confidence:  high — the divergence is a single predicate, and the correct form is already written
  twice elsewhere with a comment stating why.
- ambiguity:   Whether a moved-out tenant's row should be visually marked on the printed sheet.
  Recommend yes — Dashboard already appends a "Moved Out" badge in this exact case, so reuse it.
- why now vs later: Now. Effort is one line, and every month it ships is a month a real balance can
  go uncollected because it was never on the sheet.
- AI-recommended priority: P1
- status:      pending

### PROP-005 — Background refresh silently discards meter readings typed into the Billing grid
- ▶ Decision: Approve — leaving the app for ten seconds mid-entry wipes unsaved readings with no
  warning, on the exact screen where the landlord types the most.
- ▶ Risk: High — `refreshFromCloud()` is the read path, and the fix changes when `loadDB()` and
  `renderAll()` are allowed to run. Red zone under Hard Rules 3-4. Cannot self-promote under D-042.
- type:        bug
- source captures: /audit (this run)
- goal alignment:  supports — North-star #3 (make the monthly management convenient) and #1 by way
  of the re-entry it forces. Current Objective: close the paths where a transient failure becomes
  permanent data loss.
- expected user value: The landlord, on a phone, on step 2 of the core value loop. The Billing tab
  renders one editable card per room with `prev-<id>`, `curr-<id>`, `persons-<id>`, `wifi-<id>` and
  `away-<id>` inputs, and nothing is written until "Save Bill" or "Save All Bills" is pressed. Walk
  the units, type eight rooms' readings, switch to the calculator or a messaging app to check
  something, come back — `visibilitychange` fires, `refreshFromCloud()` runs `loadDB()` then
  `renderAll()`, `renderBilling()` rebuilds every card from `db`, and every unsaved reading is
  gone. On a phone, leaving the app is not an edge case; it is the normal way the task gets done.
- evidence:    Direct code audit. `refreshFromCloud()` is wired to `visibilitychange`, `focus` and
  `online` in `init()`. It guards on exactly three things: `_refreshing`, an open `#overlay`, and a
  non-empty outbox. The open-modal guard is the codebase's own acknowledgement of this hazard —
  its comment says "don't yank an in-progress edit" — but the Billing grid's inputs are inline in
  `#billing-content`, not in a modal, so the guard never applies to them. Quick Entry, which *is* a
  modal, is protected; the main grid it duplicates is not. Note this is a distinct defect from the
  `refreshFromCloud()` issue already tracked under ROADMAP Known Issues and folded into TASK-001:
  that one is about a *failed* refresh wiping the screen, this one is about a *successful* refresh
  discarding un-saved local input.
- effort:      S — extend the existing guard to skip the refresh when the Billing grid holds
  un-saved input, the same way the open-modal case is already skipped.
- dependencies: Worth sequencing after TASK-001, which is already rewriting `loadDB()`'s failure
  behavior and will touch `refreshFromCloud()`'s neighborhood.
- confidence:  high — the guard list is four lines and the Billing inputs are demonstrably outside
  it.
- ambiguity:   Whether to suppress the refresh entirely while readings are pending, or to refresh
  and restore the typed values afterward. Recommend suppressing — it is smaller, and it matches the
  precedent the open-modal guard already set.
- why now vs later: Now. It costs the landlord the single most tedious task in the month, silently,
  and the re-entry it forces is exactly the behavior North-star #1 warns about.
- AI-recommended priority: P1
- status:      pending

### PROP-006 — Every period selector defaults to the current month, but the work is always last month
- ▶ Decision: Approve — seven selectors default to a month the landlord is usually not working on,
  and correcting them is a per-tab tax on every session.
- ▶ Risk: High — the default decides which `period` a saved bill is written against. The change
  itself is a UI default and trivially reversible, but its blast radius is billing data, so it
  takes the safer gate per the D-042 tie-break.
- type:        feature
- source captures: /audit (this run)
- goal alignment:  supports — North-star #3 (fewer taps, less re-typing) with a correctness edge on
  #1. Current Objective: close the paths where a transient failure becomes permanent data loss.
- expected user value: The landlord, every month, on every tab. The documented monthly rhythm is to
  read meters and bill for the month that just *ended* — you cannot bill October until October is
  over. `initPeriodSels()` sets `mSel.value = cm` (current month) for all seven prefixes —
  `dash`, `bill`, `pay`, `exp`, `mort`, `bs`, `rep` — so the landlord changes the month by hand on
  Billing, then again on Bill Sheet to print it, then again on Dashboard to check it, then again on
  Reports. Each is two taps on a phone, and each is a chance to forget one and read the wrong
  month's numbers.
- evidence:    Direct code audit, corroborated by the app's own logic. `renderNotices()` treats the
  previous month as the urgent case — it calls `checkMonth(prevM…, urgent = true)` unconditionally,
  and only flags the *current* month once `today.getDate() >= 25`, i.e. once the current month is
  nearly over too. The app already encodes "last month is the one that needs billing" in its
  reminder logic while defaulting every selector to the opposite. Compounds PROP-002, which is the
  bug that makes the mismatch bite: the notice names the previous month, and the destination shows
  the current one.
- effort:      S — one function, `initPeriodSels()`, plus a decision on the rule.
- ambiguity:   What the rule should be. A blanket "always previous month" is wrong for Payments
  and Expenses, which are recorded as they happen. Recommend defaulting only the billing-cycle
  selectors — `bill`, `bs`, and `dash` — to the previous month before the 25th, and leaving
  `pay`, `exp` and `mort` on the current month. This is a product judgment and the human should
  confirm the split rather than have it inferred.
- dependencies: Overlaps PROP-002; land that first, since a correct destination reduces how much
  this one has to carry.
- confidence:  med — the friction is certain and code-grounded; the exact right default per tab is
  a product call, not a code-readable fact.
- why now vs later: Now for the billing-cycle selectors, alongside PROP-002 — they are the same
  underlying confusion about which month the landlord means, and fixing one without the other
  leaves the seam visible.
- AI-recommended priority: P2
- status:      pending

## Proposal contract
*(the structured shape triage produces — keep this shape so downstream stages stay swappable)*
```
### PROP-NNN — <title>
- ▶ Decision: Approve | Park | Reject | Clarify — <one-line why; the recommended next action, stated first>
- ▶ Risk: Low | High — <one-line why. Low = reversible (UI, copy, additive non-data features). High =
  touches data/sync/storage, auth, security, or the AI Dev OS/automation itself (adapt this to your
  own app's actual red-zone surface once CLAUDE.md's Hard Rules are filled in) — the same D-032
  red-zone list, applied here at idea time instead of at merge time. When genuinely unsure, say
  High — the tie-break favors asking.>
- type:        feature | bug | chore | decision
- source captures: <ids> (×N duplicates)
- goal alignment:  supports | conflicts | mixed | neutral  — vs the Current Objective (name it; add which North-star goal)
- expected user value: <who benefits, how much, in the current phase>
- evidence:    <recurring friction · dup count · roadmap/similar-past alignment · demand signal>
- effort:      S | M | L
- dependencies: <none | …>
- confidence:  high | med | low
- ambiguity:   <none | what's unclear>
- why now vs later: <why it belongs in the next sprint, or why it should wait>
- AI-recommended priority: P0..P3   (goal-adjusted, not raw priority)
- status:      pending
```
*`▶ Decision` is the recommended action; `status` is your recorded outcome. They differ on purpose —
the AI recommends, you decide, UNLESS Decision is Approve and Risk is Low, in which case the decision
is made mechanically (D-042) and `status` goes straight to `approved` without waiting for a reply.*
**Approve** = build it (→ ROADMAP). **Park** = valid, not now. **Reject** = drop it. **Clarify** = AI
can't recommend confidently; it needs an answer from you first.
