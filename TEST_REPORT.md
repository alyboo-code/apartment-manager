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

## TASK-003 · 2026-07-24
suite: npm test (Playwright, full suite)
result: 32 passed, 0 failed
reconciliation model chosen: `saveQuickEntry()` keeps omitting `computeBill()`'s `away` arg, so
`computeBill()` infers away from the saved bill (regular room, `water === 0`). The preview `qeCalc()`
was aligned TO that fallback (Hard Rule 7 — `computeBill()`'s arithmetic is not touched).

Hard Rule 7 — worked numeric examples (settings: elec rate 17, water 150/person, wifi 300).
Both were also executed against the real served index.html through the stubbed Supabase client
(scratchpad Playwright script, same route-interception + stub as tests/support/fixtures.js).

(a) Room 101 with a transferred balance AND a one-off extra, NOT away.
    Existing 2026-07 bill: carryIn = 500, extras = [{amount: 300}], water = 150 (≠0 → not away),
    wifi = 300 (→ WiFi on), persons = 2. Prev reading locked = bill-1.currReading = 150.
    Landlord types current = 200.
      kWh          = 200 − 150 = 50
      electricity  = round(50 × 17) = 850
      rent         = 5000
      water        = round(2 × 150) = 300
      wifi         = 300
      prevBalance  = bill-1 (2026-06) balance = 0
      carryIn      = 500
      extrasTotal  = 300
      ─────────────────────────────────────────────
      total        = 5000 + 850 + 300 + 300 + 0 + 500 + 300 = 7250
    qeCalc() preview = ₱7,250.00.  saveQuickEntry() → computeBill() totalDue = 7250.  EQUAL.
    (Before the fix, qeCalc omitted carryIn + extras and would have shown 6450 — understated by 800.)
    Runtime check: {"preview":7250,"savedTotalDue":7250,"savedWater":300,"savedWifi":300} → preview==saved.

(b) Room 101 marked away (regular room whose saved 2026-07 bill has water = 0, wifi = 0),
    no carryIn, no extras, persons = 2. Prev locked = 150. Types current = 200.
      kWh          = 50 → electricity = 850
      rent         = 5000
      water        = 0   (awayFlag true)
      wifi         = 0   (awayFlag true)
      prevBalance  = 0
      ─────────────────────────────────────────────
      total        = 5000 + 850 + 0 + 0 + 0 = 5850
    qeCalc() preview = ₱5,850.00.  saveQuickEntry() → computeBill() totalDue = 5850, water = 0.  EQUAL.
    (Before the fix, qeCalc showed water = 300 and wifi = 0-or-300 → previewed 6150+ while the saved
    bill was 5850: preview charged water the tenant was never billed.)
    Runtime check: {"preview":5850,"savedTotalDue":5850,"savedWater":0,"savedWifi":0} → preview==saved.

untested: no NEW committed Playwright assertion — tests/ is write-protected in this run (Edit and
Write to tests/ both return "directory denied by permission settings"). The task explicitly allows
adding a test and its verification step requests one in tests/billing-math.spec.js; that spec could
not be committed here. Compensating evidence: the scratchpad runtime run above (real index.html +
real stub) and the full 32-test regression. A write-permitted run should land the committed
assertion in tests/billing-math.spec.js.
manual (interactive browser): not performed — no interactive browser in this run; the served-app
reconciliation above stands in for it.
