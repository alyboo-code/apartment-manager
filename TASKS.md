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
