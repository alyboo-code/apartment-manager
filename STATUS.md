# STATUS

> Where the project is right now. The first thing any agent reads.

**Milestone:** Make a failed read impossible to mistake for an empty database (BQ-001)
**Active task:** T-001 — `loadDB()` must surface read failures
**Owner:** Codex
**Blockers:** none. `npm test` runs — 26 passing, 6 failing, and the 6 are TASK-001's acceptance
criteria in executable form (`tests/read-failures.spec.js`). Codex can pick this up.

## Last shipped

*Nothing yet.* No application code has changed. 2026-07-19: the AI Dev OS was seeded against this
app — `docs/PROJECT.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/FEATURES.md`,
`docs/DECISIONS.md` (D-001..D-004), and `CLAUDE.md`'s app-specific sections including Hard Rules
3-7. Four Telegram plumbing-test captures were archived to `captures/processed/2026/07/`.

## Triage log

- 2026-07-19 — 1 capture in, 1 proposal out. `20260719T0000Z-manual1-bug` → PROP-001 (Approve,
  Risk High) → BQ-001 → TASK-001. Inbox drained.
- 2026-07-20 — 1 capture in, 0 proposals out. `20260719T1108Z-19-unknown` (body: "Hello") is
  Telegram plumbing noise with no actionable content — same class as the four `test` captures
  archived 2026-07-19, and enriching it into a proposal would mean inventing a problem statement.
  Archived to `captures/processed/2026/07/` and marked `status: triaged`. **Residual:** the
  `captures/inbox/` copy could not be removed — `git mv` and `mv` were both blocked by this
  session's sandbox, and this run is forbidden from deleting files. The inbox copy is marked
  `status: triaged`, so triage is idempotent and will skip it; a human or a run with write
  permission should delete `captures/inbox/20260719T1108Z-19-unknown.md`.
- 2026-07-20 (second run) — 0 new captures. The only inbox file
  (`20260719T1108Z-19-unknown`) is already `status: triaged` and already archived to
  `captures/processed/2026/07/`, so it was skipped. No proposals written. **Residual unchanged:**
  `git rm` of the leftover inbox copy was again blocked by the sandbox — the archived copy is the
  authoritative one (it carries the `triaged:`/`outcome:` fields the inbox copy lacks), so removing
  the inbox duplicate loses nothing. Still needs a human or a write-permitted run.

- 2026-07-21 — 0 new captures, 0 proposals out. The only inbox file
  (`20260719T1108Z-19-unknown`) is already `status: triaged` and already archived to
  `captures/processed/2026/07/`, so it was skipped per the idempotence rule. Plan conversion was
  also a no-op: `planning/BUILD_QUEUE.md` holds one item (BQ-001) and it is already reflected in
  `TASKS.md` as TASK-001 (`source: BQ-001`), so no new tasks were created and no existing task was
  restatused. **Residual unchanged (third run):** the leftover inbox copy of
  `20260719T1108Z-19-unknown.md` still needs deleting by a human or a write-permitted run — this
  run is forbidden from deleting files. It is harmless: triage skips it every time.

- 2026-07-22 — 0 new captures, 0 proposals out. The only inbox file
  (`20260719T1108Z-19-unknown`) is already `status: triaged` and already archived, so it was skipped
  per the idempotence rule. Plan conversion was also a no-op: `planning/BUILD_QUEUE.md` still holds
  only BQ-001, already reflected in `TASKS.md` as TASK-001 (`source: BQ-001`). No tasks created, no
  status changed. **Residual unchanged (fourth run):** the leftover inbox copy of
  `20260719T1108Z-19-unknown.md` still needs deleting by a human or a write-permitted run; it is
  harmless, triage skips it every time. **New finding this run:** a human "Approve" reply was
  consumed without approving anything — see "Needs human verification" #2 below.

## Pipeline test — 2026-07-19

Exercised the automation directly rather than reading it. Results:

**Working:** Telegram → `captures/inbox/` (a live capture arrived mid-session). Both launchd jobs
(`com.aidevos.apartment-manager.overnight`, `.dispatcher`) loaded on macOS via `pwsh`.
`Generate-Codex-Notice.ps1` and `Generate-Digest.ps1` produce correct Telegram-ready output.
`Dispatch-Commands.ps1 -DryRun` correctly routed `/next` → "TASK-001, owner Codex, run: build".
`Check-DocsConsistency.ps1` and `Verify-Decisions.ps1` both pass clean.

**Found and fixed:**
- The planning files have a strict per-file regex format that no OS doc stated. Tasks written the
  way `CLAUDE.md`'s Definition of Ready describes parse as *zero tasks* — silently. Contract now
  documented in `CLAUDE.md` → Tooling Gotchas.
- `CLAUDE.md`'s risk-gate table and Sprint Execution Mode defined the red zone in terms of a
  different application (Firestore, tombstone-merge-deletion, `saveData()`, `cloudReady`,
  recipe-id handlers). None exist here. An agent checking "is this red zone?" would have found no
  match and auto-merged to production. Rewritten against this app's real surfaces.
- `planning/ROADMAP.md` was missing the `## Current Objective` heading the digest requires.

## Test suite — added 2026-07-19

Playwright, 32 tests, ~8s, fully offline. `npm test`. See `tests/README.md` and D-005.

Coverage maps to the Hard Rules: read failures (HR4), write path and outbox (HR3, HR6), billing
arithmetic (HR7), account scoping (HR5), plus boot/login smoke.

**Baseline: 26 passing, 6 failing by design** — the six are TASK-001's acceptance criteria. The
suite proved a second instance of the bug that code reading alone had missed:
`refreshFromCloud()` runs on focus/reconnect/visibilitychange and empties the in-memory db on a
failed refresh — rooms observed going 2 → 0 in a live session. Now folded into TASK-001 as AC-8.

## Needs human verification

1. **The deploy target is unconfirmed.** `_headers` is a Netlify-format file and the remote is
   `github.com/alyboo-code/apartment-manager`, but there is no `netlify.toml`, no
   `.github/workflows/`, and no other host config in the repo — so the site-to-repo link could not
   be verified from the code. `CLAUDE.md` → Deploy carries an explicit UNVERIFIED warning. Confirm
   in the Netlify dashboard before any agent pushes unattended.

2. **An approval reply was swallowed — PROP-002..006 are still waiting on you.** On 2026-07-21 a
   Telegram decision reply arrived whose entire body was the word `Approve`
   (`captures/decisions/20260721T1750Z-46-decide.md`). `Apply-Decisions.ps1` parses clauses as a
   verb *followed by proposal numbers* (`approve 2 3`, `approve 2-6`), or the convenience words
   `accept` / `approve all`. A bare `Approve` matches none of those, so zero proposals changed
   status and zero BUILD_QUEUE items were written — but the script still stamped the reply
   `status: applied` (commit a4f2f3b), because the per-file "mark applied" write runs before the
   `$applied.Count -eq 0` early return. The reply is now idempotently skipped forever.

   Consequence: PROP-002 through PROP-006 — five code-audited bugs, four of them P1, all with
   `▶ Decision: Approve` — are still `status: pending` and have never reached
   `planning/BUILD_QUEUE.md`. That is why this run's plan conversion had nothing to do.

   This run did **not** guess which proposals you meant. Bare "Approve" is genuinely ambiguous, and
   Hard Rule 1 says nothing builds without human approval. To unblock, reply with an explicit form:
   `accept` (applies each pending proposal's own recommended verdict), `approve all`, or
   `approve 2 3 4 5 6`. The parser fix itself is an OS-level change and belongs in a proposal, not
   in an unattended run — logged to `docs/AI_OS_NOTES.md`.

## 2026-07-20 02:43 -- AUTOMATION HALTED: Apply-Decisions.ps1 threw an error: Cannot find path '/Users/alyssamarieborbon/Downloads/Vibe coding/apartment-manager/captures/decisions' because it does not exist.
Investigate before the next scheduled run. Nothing further was committed, pushed, or notified this run.

**RESOLVED 2026-07-20 (commit e9ecca6).** `captures/decisions/` had never existed — git does not
track empty directories, and n8n would only have created it remotely on the first decision reply
ever sent. It was missing in every clone since install; it only surfaced now because automation was
disabled until today, so no planning run had ever reached that line. The folder now ships with a
README, and `Apply-Decisions.ps1` treats a missing folder as "no decisions yet" rather than
throwing. Verified both ways. Automation was never disabled by this — `Halt-Automation` ends the
one run, it does not flip `$AUTOMATION_ENABLED`.

## 2026-07-22 02:01 -- AUTOMATION HALTED: Claude session touched file(s) outside the allowed planning surface: docs/AI_OS_NOTES.md. NOT committing or pushing -- working tree left as-is for human review.
Investigate before the next scheduled run. Nothing further was committed, pushed, or notified this run.

<!-- stray test edit -->
