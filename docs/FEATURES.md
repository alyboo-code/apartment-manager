# Features

> Catalog by area, with status. The source of truth for whether a feature EXISTS —
> not whether it is good.
>
> **Derived by reading `index.html`.** Status reflects presence in code, not quality.
> `shipped` = present and reachable in the UI. `partial` = present with a known gap.

## Auth

| Feature | Entry point | Status |
|---|---|---|
| Email/password login | `doLogin()`, `#login-screen` | shipped |
| Logout | `doLogout()` | shipped |
| Session restore on reload | `_session`, Supabase SDK | shipped |
| In-app signup | — | not built (accounts created in Supabase directly) |
| Password reset | — | not built |
| Tenant-facing login | — | **non-goal** (see `docs/PROJECT.md`) |

## Rooms and tenants

| Feature | Entry point | Status |
|---|---|---|
| Add / edit room | `saveRoom()` | shipped |
| Room list | `renderRooms()` | shipped |
| Tenant directory | `renderTenants()` | shipped |
| Tenant contact details (phone, email, ID type) | `rooms` columns | shipped |
| Emergency contact | `"ecName"`, `"ecRel"`, `"ecPhone"` | shipped |
| Deposit / advance tracking | `deposit`, `advance`, `"depositDate"`, `"depositNotes"` | shipped |
| Move-in / move-out dates | `"moveIn"`, `"moveOut"` | shipped |
| Room status (active / inactive) | `status`, `active` | partial — two overlapping fields, `status` is newer |

## Billing — the core loop

| Feature | Entry point | Status |
|---|---|---|
| Per-period bill generation | `saveBill()`, `renderBilling()` | shipped |
| Single-room bill save | `saveSingleBill()` | shipped |
| Electric meter readings → kWh | `"prevReading"`, `"currReading"`, `"kWh"` | shipped |
| Configurable electric rate | `settings.electricity`, `#elec-rate-list` | shipped |
| Water and wifi charges | `settings.water`, `settings.wifi` | shipped |
| Per-person water split | `persons` on room and bill | shipped |
| Ad-hoc extra charges | `extras` (jsonb), `saveCharges()`, `#charge-list` | shipped |
| Balance carry-forward | `"prevBalance"`, `"carryIn"` | shipped |
| Printable bill sheet | `renderBillSheet()`, `#bs-printable` | shipped |
| Tenant/room name snapshot on bill | `migrateBillSnapshots()` | shipped |
| Quick entry | `saveQuickEntry()` | shipped |
| Emailing bills to tenants | — | not built (sent manually) |

## Payments

| Feature | Entry point | Status |
|---|---|---|
| Record a payment against a bill | `payments` table, `renderPayments()` | shipped |
| Payment mode and notes | `mode`, `notes` | shipped |
| Partial payments / running balance | `"paidAmount"`, `balance`, `status` | shipped |
| Overdue alerts | `renderOverdueAlerts()`, `#dash-overdue` | shipped |
| Online payment collection | — | **non-goal** (see `docs/PROJECT.md`) |

## Expenses

| Feature | Entry point | Status |
|---|---|---|
| Add expense (date, description, category, amount) | `renderExpenses()`, `#exp-*` | shipped |
| Per-period expense totals | `#exp-total`, `#exp-m` / `#exp-y` | shipped |
| CSV import with preview | `#exp-import-btn`, `#exp-import-preview`, `#import-confirm-btn` | shipped |
| Duplicate skip on import | `#import-skip-dup` | shipped |

## Maintenance

| Feature | Entry point | Status |
|---|---|---|
| Log a maintenance request | `saveMaintenance()` | shipped |
| Assign / report attribution | `"assignedTo"`, `"reportedBy"` | shipped |
| Status tracking + resolution date | `status`, `"resolvedDate"` | shipped |
| Cost tracking | `cost`, `#maint-total` | shipped |
| Filter by room / category / status | `#maint-room-filter`, `#maint-cat-filter`, `#maint-status-filter` | shipped |
| Search | `#maint-search` | shipped |

## Mortgage

| Feature | Entry point | Status |
|---|---|---|
| Log mortgage payments | `renderMortgage()`, `#mort-*` | shipped |
| Progress against target | `renderMortgageProgress()`, `settings.mortgageTotal` | shipped |
| Set mortgage goal | `saveMortgageGoal()` | shipped |

## Dashboard and reports

| Feature | Entry point | Status |
|---|---|---|
| Period stats | `renderDashboard()`, `#dash-stats` | shipped |
| Room occupancy overview | `#dash-rooms` | shipped |
| Notices | `renderNotices()`, `#dash-notices` | shipped |
| Monthly reports | `renderReports()` | shipped |
| Year report | `renderYearReport()` | shipped |

## Data and sync

| Feature | Entry point | Status |
|---|---|---|
| Per-row cloud writes | `persistUpsert()`, `persistDelete()` | shipped |
| Offline write queue | `apt_outbox`, `flushOutbox()` | shipped |
| Offline-vs-rejected distinction | `classifyWriteError()` | shipped |
| Sync status badge | `updateSyncStatus()`, `#sync-status` | shipped |
| Backup / restore | `replaceCloudWithDb()`, `bulkReplaceCloud()` | shipped |
| Legacy `apt_local_db` migration | `syncLocalBackup()` | shipped |
| **Failed-read handling** | `loadDB()` | **partial — see Known issues.** A failed read renders as an empty database rather than an error |

## Platform

| Feature | Entry point | Status |
|---|---|---|
| Installable PWA | `sw.js`, `manifest.webmanifest` | shipped |
| Mobile layout | CSS in `index.html` | shipped |
| Print styling for bill sheets | `#bs-printable` | shipped |
| Security headers / CSP | `_headers` | shipped |
| Sort preferences persisted | `apt_sort_prefs` | shipped |
| Multi-landlord accounts | `user_id` scoping + RLS | shipped at the data layer; **no onboarding flow yet** |
