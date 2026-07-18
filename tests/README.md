# Tests

Playwright suite for apartment-manager. Run with `npm test`.

```bash
npm install       # first time only
npm run setup     # first time only — downloads Chromium (~130MB)
npm test          # headless, ~8 seconds
npm run test:ui   # interactive, for debugging a failure
npm run test:headed
```

The app has no build step (D-001) and this does not change that. `package.json` exists **only** to
run these tests — `index.html` is still served and deployed exactly as it sits in the repo.

> **Why browser install is a separate `npm run setup` and not a `postinstall` hook.** The host
> serves this repo statically. Before the test suite existed there was no `package.json` at all,
> so the host did no install step. Adding one means `npm install` may now run on every deploy — and
> a `postinstall` that downloads Chromium would run with it, slowing or breaking production
> deploys for a browser no deploy needs. For the same reason there is deliberately **no `build`
> script**. If you ever add one, check what the host does with it first.

## How it works

`index.html` is served unmodified by a plain `python3 -m http.server`. Two route interceptions do
all the work:

1. **The Supabase CDN script is replaced** with `tests/support/supabase-stub.js`, a test double we
   control completely.
2. **The `integrity` attribute is stripped from that one `<script>` tag** in the served HTML.
   Substituting the CDN response necessarily fails the SRI check, and the browser blocks the
   script — correctly. The file on disk is never touched, so production keeps its SRI protection.
   If the tag ever changes shape, the fixture throws a clear error rather than silently serving an
   app with no Supabase client.

The app itself contains no test hooks, no `if (window.TEST)` branches, and no injected seams.
Everything is driven from outside.

## Why a stub instead of a real Supabase test project

The bugs worth catching here are *failure* modes: a dropped connection mid-read, one table out of
seven rejecting, the server refusing a write. You cannot ask a real Supabase project to fail on
command, on the fourth of seven parallel queries, deterministically, every run.

It also means no credentials in the repo, no shared remote state for two runs to race over, and a
suite that finishes in about eight seconds offline.

The stub honours one contract above all others: **queries resolve, they do not throw.** A failed
select returns `{ data: null, error }`. That is the real client's behaviour and the entire reason
Hard Rule 4 exists — a stub that threw would make the buggy code look correct.

## Layout

| File | Covers |
|---|---|
| `smoke.spec.js` | Boot, login, logout, all seven tables loading. If this fails, the harness is broken, not the app. |
| `read-failures.spec.js` | **Hard Rule 4** — failed reads must not look like empty data. *Currently failing by design; see below.* |
| `write-path.spec.js` | **Hard Rules 3, 5, 6** / D-002, D-003 — per-row writes, outbox queueing, offline vs. rejected. |
| `billing-math.spec.js` | **Hard Rule 7** — `computeBill()` arithmetic, carry-forward, meter rollover. |
| `user-scoping.spec.js` | **Hard Rule 5** / north-star #2 — every query scoped by `user_id`, no cross-account leakage. |
| `support/supabase-stub.js` | The test double. |
| `support/fixtures.js` | Route interception, seed data, failure controls. |

## The six failing tests are supposed to fail

`read-failures.spec.js` is the executable form of TASK-001's acceptance criteria. Those six tests
document a real, unfixed bug: `loadDB()` checks `.error` on none of its seven selects, so a failed
read renders as a real-looking empty database.

**Do not "fix" the suite by weakening them.** Codex's job in TASK-001 is to make them pass by
fixing `loadDB()` and `refreshFromCloud()`. When they go green, delete this section.

Current expected state: **26 passing, 6 failing.**

The `refreshFromCloud` failure is the one to look at first — it demonstrates rooms going from 2 to
0 in the live UI on a background refresh, which is what a landlord would experience as their data
vanishing mid-session.

## Seed data

`seedRows()` in `support/fixtures.js` provides two rooms, a paid and an unpaid bill, a payment, an
expense, a maintenance ticket, and a mortgage payment — plus **one room owned by a different
user**. That last row is not decoration: it is how `user-scoping.spec.js` proves isolation for real
instead of assuming it.

## Adding a test

```js
const { test, expect } = require('./support/fixtures');

test('what should be true', async ({ app, page }) => {
  await app.seed();
  await app.authenticate();
  await app.goto();
  await expect(page.locator('#app-root')).toBeVisible();
  // ...
});
```

Helpers on `app`: `seed()`, `authenticate()`, `goto()`, `db()`, `outbox()`, `selectLog()`,
`writeLog()`, `failTables()`, `failTablesOnBoot()`, `clearFailures()`.

Write the failure message into the assertion. `expect(x).toBe(2)` tells whoever hits it nothing;
"a failed background refresh emptied the in-memory db" tells them what broke and why it matters.
