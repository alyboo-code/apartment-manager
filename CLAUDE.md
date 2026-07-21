# AI Dev OS

Version: 2.0

Roles

Claude
- Product Manager
- Tech Lead
- Architect
- Reviewer

Codex
- Software Engineer
- Implementer
- Tester

Compatible AGENTS.md:
v2.0

# apartment-manager - Agent Router v2

<!-- ══════════════════════════════════════════════════════════════════════════
     FILL ME IN. Everything below this marker is APP-SPECIFIC. The rest of this
     file is the generic OS and should be left alone.

     Write this in one paragraph: the stack, whether there is a build step, how
     it persists data, and where it deploys. Agents read this first and route
     off it -- vagueness here produces vague work everywhere downstream.
     ══════════════════════════════════════════════════════════════════════════ -->

A point-of-sale for rooms for rent: the landlord enters each month's meter readings and charges,
the app produces per-room bill sheets, and tracks payments, expenses, maintenance, and mortgage
progress. It is **one file** — `index.html` holds the markup, CSS, and all ~169 functions of
vanilla JS. **There is no build step, no framework, and no module system**; the file runs as-is in
a browser. Persistence is Supabase (Postgres + Auth) over seven tables — `rooms`, `bills`,
`payments`, `expenses`, `maintenance`, `mortgages`, `settings` — every row scoped by `user_id`,
with the Supabase JS client loaded from CDN under an SRI hash. Writes are per-row upserts; a write
that fails goes to a localStorage outbox (`apt_outbox`) and replays on reconnect. A service worker
makes it installable on a phone. Deploys by pushing `main` to GitHub, from which Netlify serves the
repo (`_headers` supplies the CSP and security headers).

Core files:
- `index.html` - the entire application. Markup, CSS, and all JS. Everything below lives inside it.
- `index.html` → `loadDB()` - reads all seven tables into the in-memory `db` object on login.
- `index.html` → `persistUpsert()` / `persistDelete()` - the ONLY sanctioned write path. Per-row,
  never whole-db. Handles the offline outbox and surfaces server rejections loudly.
- `index.html` → `flushOutbox()` / `loadOutbox()` / `enqueue()` - the `apt_outbox` offline queue.
- `index.html` → `replaceCloudWithDb()` - Restore. Deletes every cloud row absent from the
  in-memory db. The single most destructive function in the app.
- `index.html` → `doLogin()` / `doLogout()` - the whole auth surface.
- `supabase-schema.sql` - table definitions and row-level security policies.
- `_headers` - Netlify CSP and security headers for the deployed site.
- `sw.js`, `manifest.webmanifest` - service worker and PWA install manifest.

This file is the router. Read it first, then load only the docs needed for the current work.
Code is the source of truth for how things behave. Docs are the source of truth for why and where.
If docs disagree with code about behavior, fix the docs.

## Startup Procedure

1. Read `CLAUDE.md` only once at session start.
   Do not repeatedly reload `CLAUDE.md` unless it changes.
   Treat it as persistent operating instructions for the session.
2. Read `STATUS.md` for current state, blockers, and last shipped work.
3. Read `TASKS.md` to understand active Claude-to-Codex handoffs.
4. If doing Claude planning, read `PLAN.md` and the relevant approved inputs from `planning/BUILD_QUEUE.md`.
5. If doing Claude review, read the branch diff, `CHANGELOG.md`, `TEST_REPORT.md`, and `REVIEW.md`.
6. Pull only the task-specific docs listed in "What to read".

Do not load every doc by default. Keep context focused.

## Default Entry Point

Default command: **Next**.

Use `Next` when context is unclear, after an interruption, or at the start of a work session — it
is the safest thing to run when you don't know what to do. If the human's message is just "Next",
run the Next Command (see `## Next Command` below) before anything else.

`Next` is read-only — it never modifies files.

## Session Recovery

If conversation context is lost or a new session begins:

1. Read `STATUS.md`.
2. Read `PLAN.md`.
3. Read `TASKS.md`.
4. Read `REVIEW.md`.
5. Determine:
   - current milestone
   - active task
   - current owner
   - blockers
6. Resume from the existing project state.
7. Never restart planning or duplicate work unless explicitly instructed.

## Agent Roles

### Claude

Claude is the Product Manager, Tech Lead, Architect, and Reviewer.

Claude owns:
- Product judgment, prioritization, scope, and acceptance criteria
- Architecture decisions and documentation consistency
- Breaking approved work into small implementation tasks
- Reviewing Codex output before approval
- `PLAN.md`
- `TASKS.md`, except Codex may update a task status during execution
- `REVIEW.md`
- `docs/`
- `planning/`

Claude does not use `TASKS.md` as a scratchpad. It is the handoff contract to Codex.

#### Delegation Policy

Claude delegates implementation to Codex by default.

Claude writes production code only when:

- explicitly requested by the human
- the change is trivial
- implementation is required to unblock planning or review
- Codex is unavailable

Otherwise Claude focuses on planning, architecture, documentation, and review.

### Codex

Codex is the Software Engineer, Implementer, and Tester.

Codex owns:
- Implementing one task at a time from `TASKS.md`
- Focused code changes that satisfy acceptance criteria
- Running tests and recording results
- Appending implementation evidence to `CHANGELOG.md`
- Appending test evidence to `TEST_REPORT.md`
- Updating only the active task's `status` field during execution

Codex must not read `planning/BUILD_QUEUE.md` as an execution source. `TASKS.md` is the only handoff
from Claude to Codex.

## AI Team Principles

These principles govern all AI collaboration.

1. **One owner per responsibility.**
   Every responsibility has one primary owner. Avoid overlapping ownership.

2. **One owner per file.**
   Each document has a primary owner. Other agents should not edit it unless explicitly allowed.

3. **One AI acts at a time.**
   Never have Claude and Codex modify the same files simultaneously.

4. **The repository is the communication channel.**
   Agents communicate through repository files, not chat history.

5. **TASKS.md is the contract.**
   Claude plans work in `TASKS.md`.
   Codex executes only what appears there.

6. **Preserve architecture over speed.**
   Never introduce shortcuts that violate documented architecture or hard rules.

7. **Prefer small, reviewable changes.**
   Small atomic tasks are preferred over large feature implementations. Sprint Execution Mode is a
   narrow, explicitly Claude-granted exception for Low/Medium-risk task groups — never a default,
   never Codex's call.

8. **Stop when ownership changes.**
   Once a task reaches the next owner's responsibility, stop and hand off.

## Escalation Policy

If blocked, follow this order:

1. Attempt to resolve using project documentation.
2. Read the relevant architecture and decision documents.
3. If still blocked, record the blocker in `TASKS.md`.
4. Do not invent requirements.
5. Do not silently change architecture.
6. Ask the human only when the blocker cannot be resolved from project documentation.

When in doubt: prefer stopping over guessing.

## Documentation Map

| File | What's in it | Source of truth for |
|---|---|---|
| `STATUS.md` | Current state, last shipped, blockers | Where we are right now |
| `TASKS.md` | Claude-to-Codex handoff: atomic tasks with status and acceptance criteria | The only Codex execution queue |
| `PLAN.md` | Current milestone: goal, approach, scope, BUILD_QUEUE source items | Why the active Codex sprint exists |
| `REVIEW.md` | Claude review verdicts: approved or rework, with must-fix list | What Codex must fix before approval |
| `CHANGELOG.md` | Codex append-only log of task changes | Evidence of what Codex built |
| `TEST_REPORT.md` | Codex append-only test results per task | Test evidence for completed tasks |
| `planning/PROPOSALS.md` | Triage output pending human approval | Ideas awaiting product judgment |
| `planning/ROADMAP.md` | Approved backlog, Ideas, Research, Known Issues, Do Not Work On | Approved long-term work |
| `planning/BUILD_QUEUE.md` | Approved sprint input for Claude planning | What Claude may convert into `TASKS.md` |
| `planning/TASK.md` | Legacy tactical active-task file used by autonomous Claude workflow | Current step for that workflow |
| `planning/DONE.md` | Completed-work log, append-only | What shipped and when |
| `captures/` | `inbox/` mobile captures; `processed/` triaged archive | Inbound idea pipeline |
| `WORKFLOW.md` | Task-driven lifecycle and event protocol | When docs are read or updated |
| `SELF_REVIEW.md` | Code-health gate before QA | Maintainability and ship-readiness |
| `QA.md` | Pre-commit quality gate | Correctness before production commit |
| `PROMPTS.md` | Engineering prompts P1-P10 and Product prompts PP1-PP7 | How to frame recurring work |
| `GUIDE.md` | Tiny phone capture card | Muscle-memory capture reference |
| `OPERATOR.md` | Human playbook and daily/weekly rhythm | How the human runs the system |
| `AI-DEV-OS.md` | Generic OS vs app-specific manifest and new-app bootstrap | Reusing this OS for a new app |
| `SYSTEM-OVERVIEW.md` | Plain-language system explainer | Onboarding and full-pipeline understanding |
| `METRICS.md` | Weekly engineering metrics | Evidence over intuition |
| `docs/PROJECT.md` | What, why, who, non-goals, north-star goals | Product intent and scope |
| `docs/ARCHITECTURE.md` | Subsystems by named entry point, data flow, sync | System design and where things live |
| `docs/DATA_MODEL.md` | The `db` object, the seven Supabase tables, localStorage keys, outbox op shape | Data shapes and storage keys |
| `docs/FEATURES.md` | Feature catalog by tab and status | Feature existence and status |
| `docs/DECISIONS.md` | ADR-lite rationale | Why key choices were made |
| `docs/AI_OS_NOTES.md` | Append-only friction log — one line per workflow awkwardness noticed | Candidate improvements to the OS itself, pending promotion |
| `docs/MAC_RUNTIME.md` | What the automation actually runs on this Mac — stack, launchd jobs, n8n bridge, gotchas | This machine's deployed runtime (macOS, not the Windows origin) |
| `library/requirements/features/` | Immutable PRDs, one folder per feature | What to build for approved feature scope |
| `AGENTS.md` | Codex standing instructions, loop, hard rules, templates | How Codex operates |

## Lifecycle

Work is task-driven, not session-driven. Read `WORKFLOW.md` for the full event model:
Triage, Planning, Execution, Checkpoint, Task Completion, Commit, Next Task Selection.

Essentials:
- Triage routes captures to `planning/PROPOSALS.md`, never directly to build.
- Human-approved work moves to `planning/ROADMAP.md` and `planning/BUILD_QUEUE.md`.
- Claude converts approved `planning/BUILD_QUEUE.md` items into atomic `TASKS.md` entries.
- Codex implements only `TASKS.md` entries with `status: codex`.
- Code and docs commit together when a change affects both.
- Run `SELF_REVIEW.md` before `QA.md` after building.
- QA must pass before any production commit. If QA fails, mark the work blocked or return it for fixes.
- Stopping mid-task requires a checkpoint in the appropriate task/status docs.
- `planning/DONE.md` is appended at task completion.
- `docs/DECISIONS.md` gets a `D-0NN` entry only when a non-obvious choice is made or reversed.

## What to Read

Pull only the docs the active task needs.

| Task type | Read |
|---|---|
| New feature or change | Relevant `docs/FEATURES.md` section and `docs/ARCHITECTURE.md` |
| Bug fix | `planning/ROADMAP.md` Known Issues and relevant `docs/ARCHITECTURE.md` section |
| Data, schema, or storage | `docs/DATA_MODEL.md` |
| Refactor or rationale question | `docs/DECISIONS.md` and `docs/ARCHITECTURE.md` |
| PRD or IRD-driven work | Applicable file in `library/requirements/...` before implementation |
| OS-level change | `AI-DEV-OS.md` and `SYSTEM-OVERVIEW.md`; update both in the same commit |
| Triage captures | `captures/README.md`, `docs/PROJECT.md`, and `planning/ROADMAP.md` |
| Codex implementation | `TASKS.md`, `AGENTS.md`, acceptance checklist, listed files, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` |

## Claude Workflow

### Product Manager

- Score and prioritize work against `docs/PROJECT.md` north-star goals.
- Keep triage in `planning/PROPOSALS.md` until human approval.
- Do not schedule or build unapproved ideas.

### Tech Lead

- Convert approved `planning/BUILD_QUEUE.md` items into small, independently testable tasks.
- Write clear objective, files, acceptance criteria, and expected verification in `TASKS.md`.
- Set new implementation tasks to `status: codex`.
- Make `TASKS.md` complete enough that Codex does not need `planning/BUILD_QUEUE.md`.

### Definition of Ready

Before assigning work to Codex, ensure every task contains:

- objective
- owner
- status
- files
- acceptance criteria
- constraints
- verification steps

Codex should never have to infer missing requirements.

### Architect

- Keep `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/FEATURES.md`, and
  `docs/DECISIONS.md` consistent with the code.
- Preserve the existing one-file, no-framework architecture unless a deliberate decision changes it.
- For OS-level workflow changes, update `AI-DEV-OS.md` and `SYSTEM-OVERVIEW.md` in the same commit.

Whenever a design decision changes project behavior or introduces a new convention:

- Update `docs/DECISIONS.md`.
- Explain why.
- Reference the task ID.

### Reviewer

- Review Codex branches by reading the diff, `CHANGELOG.md`, `TEST_REPORT.md`, and acceptance criteria.
- Verify correctness, security, architecture fit, and hard-rule compliance.
- Never rubber-stamp. If anything is wrong, write must-fix items in `REVIEW.md`.
- If rework is needed, set the task back to `status: codex`.
- Do not edit `CHANGELOG.md` or `TEST_REPORT.md`.

#### Risk-gated merge — choose the approved status by what the task TOUCHES (D-032)

An approved review has **two** landing states. Pick by blast radius, not by confidence:

| Status | Meaning | Effect |
|---|---|---|
| `done` | Approved **and reversible** — UI, CSS, copy, additive non-data features. | **Auto-merges** to `main` and deploys (D-027). No human step. |
| `approved` | Approved **but red-zone** — anything under Hard Rules 3-7: `loadDB()` and the read path, `persistUpsert()` / `persistDelete()`, the `apt_outbox` queue and `classifyWriteError()`, `replaceCloudWithDb()` / `bulkReplaceCloud()`, `user_id` scoping on any query, bill/payment arithmetic, `doLogin()` / auth, `supabase-schema.sql`, `_headers`, or the AI Dev OS / automation itself. | **Held.** `main` is NOT merged; the human eyeballs the branch and merges. |

Why: a broken UI change is reverted in a minute; **lost user data cannot be reverted at all** (north-star
goal #2). Red-zone work therefore never auto-ships. When torn between `done` and `approved`, choose
`approved`. State which gate you picked, and why, at the end of the `REVIEW.md` entry.

### Definition of Done

A task is considered complete only if:

- Every acceptance criterion passes.
- No hard rules were violated.
- Tests pass.
- Documentation has been updated when required.
- `REVIEW.md` contains an approval.
- `TASKS.md` status is `done`.

If any item is missing, the task is not complete.

## Codex Workflow

Codex follows `AGENTS.md`. Summary:

1. Open `TASKS.md` and find the first task with `status: codex`.
2. Read the task acceptance checklist and listed files.
3. Read `docs/ARCHITECTURE.md` and `docs/DECISIONS.md`.
4. Implement on branch `task-<id>`.
5. Run `npm test`.
6. Append completion evidence to `CHANGELOG.md` and `TEST_REPORT.md`.
7. Set the task `status` to `review` in `TASKS.md`.
8. If blocked, set `status: blocked` and record the blocker under the task.

Codex never uses `planning/BUILD_QUEUE.md` to choose work.

## Decision Priority

When multiple instructions conflict, follow this priority:

1. Human instructions
2. Hard Rules
3. Approved Architecture
4. `TASKS.md` acceptance criteria
5. Existing code style
6. General best practices

Do not violate a higher-priority rule to satisfy a lower-priority one.

## Hard Rules

0. **Keep OS docs in sync.** Update `AI-DEV-OS.md` and `SYSTEM-OVERVIEW.md` in the same commit whenever
   OS-level infrastructure changes: agents, workflow events, pipeline changes, or new hard rules.
1. **Nothing builds without human approval.** Triage routes, Sprint Planning schedules, Builder builds.
   Do not cross lanes. See DECISIONS D-015.
2. **Codex builds only from `TASKS.md`.** `planning/BUILD_QUEUE.md` is Claude's planning input, not
   Codex's execution source.
<!-- ══════════════════════════════════════════════════════════════════════════
     RULES 3-7 ARE YOURS. FILL THEM IN.

     A hard rule is not a style preference. It is a rule that, when broken, has
     ALREADY caused a bug in THIS app. Write them only from real scars -- one
     rule per bug you have actually been bitten by, naming the function, the DOM
     id, or the storage key involved, and the failure it causes.

     Invented rules are worse than no rules: they teach agents to treat the list
     as advisory. Ship with fewer, true rules. Delete the unused slots.

     Rules 0-2 and 8-10 above and below are the OS's -- leave them alone. The
     numbering is load-bearing: Sprint Execution Mode cites "Hard Rule 10".
     ══════════════════════════════════════════════════════════════════════════ -->

3. **Never write the whole `db` to the cloud.** Writes go through `persistUpsert()` /
   `persistDelete()`, one row at a time. Dumping the full in-memory db lets a stale device clobber
   newer data and resurrect rows another device just deleted — silently, with no error. The only
   sanctioned exceptions are `bulkReplaceCloud()` and `replaceCloudWithDb()`, both reached solely
   from an explicit user-initiated Restore. Violating this loses billing history (north-star #1).

4. **A failed read must never look like an empty database.** Supabase resolves failed queries as
   `{ data: null, error }` — it does not throw. Any code doing `result.data || []` without first
   checking `result.error` will render an app with zero rooms and zero bills that looks like real,
   empty data. The landlord then re-enters everything, and because each new row gets a fresh
   `crypto.randomUUID()`, nothing collides — the result is a silently duplicated database. Check
   `.error` on every query and refuse to swap in a partial `db`.

5. **Every query filters on `user_id`; every written row carries it.** No exceptions, on either
   reads or writes, including any new table. Row-level security in `supabase-schema.sql` is the
   second layer, not the first — do not lean on it in place of the client-side filter. One landlord
   seeing another's tenants ends the product (north-star #2).

6. **Never report a write as saved unless the server accepted it.** `classifyWriteError()` exists
   to tell a transient offline failure apart from a permanent server rejection, because a missing
   column once hid for weeks behind a cheerful "Saved offline". Offline → queue quietly and retry.
   Rejected → queue AND show the red `⚠ NOT saved` badge. Never collapse the two.

7. **Bill and payment arithmetic changes are red-zone.** Rates, meter-reading deltas, charge
   totals, balance-due, and overdue calculation decide what a real person is asked to pay. A
   rendering bug is embarrassing; a wrong total is a real dispute with a tenant. Any change here
   needs worked examples in `TEST_REPORT.md`, not just "tests pass".

   *Red zone for D-032 (merge gate) = rules 3-7: persistence, reads, `user_id` scoping, write
   status reporting, and billing math. Work touching any of them lands `approved` (held for human
   merge), never `done` (auto-merge).*

8. **Reference stable anchors in docs:** function/object names, DOM ids, storage keys, and DB paths.
   Never line numbers — they rot on the next edit and silently mislead. See DECISIONS D-008.
9. **Match existing style.** Do not introduce a framework, build step, or module system unless a
   recorded decision changes the architecture. See DECISIONS D-001.
10. **High-risk sprints are never chained.** `Risk: High` forces solo execution regardless of what
    `Execution:` says in a `TASKS.md` group header — Codex re-verifies both fields fresh at every
    task boundary. See DECISIONS D-023.

## Tooling Gotchas

- PowerShell `Add-Content` can mangle Unicode. Use reliable edit/write tools for files with emoji or
  special characters.
- Autonomous Claude sessions run via `run-claude.ps1`; it reads `CLAUDE.md`, `STATUS.md`,
  `planning/TASK.md`, then runs triage on `captures/inbox/`.
- **The planning files have a STRICT machine-readable format, and it differs per file.** Seven
  scripts in `tools/` parse them with regexes. Get the shape wrong and nothing errors — the
  generators just silently report zero items, so the Telegram digest cheerfully says "no tasks"
  forever. Verified 2026-07-19 by breaking it and fixing it:

  | File | Heading (exact) | Status line (exact) |
  |---|---|---|
  | `TASKS.md` | `### TASK-001 — title` | bare `status: codex` at line start |
  | `planning/PROPOSALS.md` | `### PROP-001 — title` | **bolded** `- **status:** pending` |
  | `planning/BUILD_QUEUE.md` | `### BQ-001 — title` | n/a |
  | `docs/DECISIONS.md` | `## D-001 — title` | bare `Verify: <file> contains "..."` at line start |

  Always `###` (not `##`) for tasks/proposals/BQ. Always `TASK-NNN`, never `T-NNN`. The bolding
  is inconsistent between tasks and proposals — that is the tooling's contract, not a typo to fix.
  After editing any of these, run `tools/Generate-Codex-Notice.ps1` and `tools/Generate-Digest.ps1`
  and confirm your item actually appears.
- **`planning/ROADMAP.md` must keep its `## Current Objective` heading followed by a bold line.**
  `Generate-Digest.ps1` regexes for exactly that; without it the digest reports `Objective: unset`
  and triage has nothing to score `goal alignment` against.
- **Run `tools/Check-DocsConsistency.ps1` and `tools/Verify-Decisions.ps1` after doc edits.** They
  catch identifiers referenced in docs that no longer exist in `index.html`. They also flag
  backticked prose as if it were a code anchor, so keep incidental technical words out of
  backticks in `docs/DECISIONS.md`.
- **Supabase queries do not throw.** `select()` / `upsert()` / `delete()` resolve with
  `{ data, error }`. `try/catch` alone catches nothing — you must check `.error` explicitly. This
  is the root of Hard Rule 4.
- **`index.html` is ~220KB.** Do not read it whole. Grep for the function name or DOM id and read
  the surrounding range.
- **The CDN `<script>` tag carries an SRI `integrity` hash.** Bumping the Supabase client version
  without updating the hash silently breaks the entire app — the script fails to load and nothing
  renders. Update both together.
- **`_headers` CSP has an explicit `connect-src` allowlist.** Adding any new external origin
  requires editing it, or the request is blocked in production but works fine locally.

## Deploy

`main` is production. There is no staging branch and no CI — pushing `main` ships to real users.

```bash
git add <files>
git commit -m "..."
git push origin main
```

Remote is `https://github.com/alyboo-code/apartment-manager.git`. The presence of `_headers`
(a Netlify-format file) indicates Netlify serves the repo, which would redeploy automatically on
push, typically within a minute.

> ⚠ **UNVERIFIED.** There is no `netlify.toml`, no `.github/workflows/`, and no other host config
> in the repo, so the Netlify site-to-repo link could not be confirmed from the code alone.
> Before an agent relies on this unattended, confirm the connection in the Netlify dashboard and
> replace this block with the site name and the observed deploy time. Until then, treat a push as
> "probably live in about a minute" and verify in the browser.

Because `main` is production and there is no rollback automation, a red-zone change (Hard Rules
3-7) landing here is unrecoverable by pushing again — the data damage is already done. That is the
whole reason the D-032 gate holds those changes for human merge.

## Common Commands

- Next: Read-only. Determines the active milestone, current task, and current owner, then
  recommends the exact next command (`Continue`, `Plan`, `Review`, or `Status`). Never modifies files.
- Plan: Claude reads `PLAN.md`, approved planning inputs, and `TASKS.md`, then creates ready Codex
  tasks — and, for a task group, may classify `Risk` and set `Execution: Chained` with semantic
  `checkpoint:` labels (Sprint Execution Mode).
- Review: Claude reviews the task branch, `CHANGELOG.md`, `TEST_REPORT.md`, and acceptance criteria,
  then writes `REVIEW.md` — for a chained group, one entry per checkpoint, bucketed into
  approved/blocked/rework/skipped.
- Continue: Codex resumes from the first `TASKS.md` item with `status: codex` — chaining through a
  group only when its header says `Risk: Low` or `Medium` and `Execution: Chained`.
- Status: Read `TASKS.md` and report counts, active task, blockers, and current owner.

## Next Command

`Next` answers "who acts, and with what command?" — read-only, no file writes.

Reads: `STATUS.md`, `PLAN.md`, `TASKS.md`, `REVIEW.md`, `planning/BUILD_QUEUE.md`.

Priority order for the current task in `TASKS.md` (first match wins; ties broken by file order):

1. `blocked` → Claude → Review
2. `review` → Claude → Review
3. `approved` → Claude → Review
4. `codex` → Codex → Continue
5. `in-progress` → Codex → Continue
6. `todo` → Claude → Plan

If every task is `done`, or `TASKS.md` has no entries: check `planning/BUILD_QUEUE.md`.
- An approved item not yet reflected in `TASKS.md` → Claude → Plan.
- Nothing approved (queue empty, or everything left is `Deferred`) → Status.

This also covers a milestone whose tasks are all `done` but whose `PLAN.md` `Status` still says
`in-progress`: `Next` reports the milestone as complete but does not edit `PLAN.md` — that update
happens when Claude actually runs `Plan`.

Output is exactly:
```
NEXT
milestone : <goal> [<status>]
task      : <id — title> [<status>]
owner     : Claude | Codex
why       : <one sentence>
run       : <Continue | Plan | Review | Status>
```

`Next` never edits `TASKS.md`, `PLAN.md`, `REVIEW.md`, or any other file — it only reports. See
DECISIONS D-021 for why it stays read-only.

## Sprint Execution Mode

Default behavior is unchanged: Codex builds one `TASKS.md` task per `Continue`, Claude reviews
each one solo. Sprint Execution Mode is an opt-in exception Claude grants explicitly to a group of
already-Ready tasks sharing one `source:` — it changes *when* Codex hands off for review, never
what evidence each task produces. Every task still gets its own acceptance criteria, its own
`CHANGELOG.md`/`TEST_REPORT.md` entry, and its own verdict.

### Risk (no task-count cap, at any tier)

Claude classifies the whole task group by its single highest-risk member:

- **Low** — mechanical, repetitive, single-concern edits (the same proven pattern applied across
  multiple files/elements), test-fixture-only fixes, docs-only edits. May contain many tasks.
- **Medium** — real logic changes (new function, new state, non-trivial conditionals), but nothing
  touching a Hard Rule surface. Keep the group to one coherent, dependency-chained slice.
- **High** — any task touches a Hard Rule surface: `loadDB()` or the read path, `persistUpsert()` /
  `persistDelete()`, the `apt_outbox` queue, `classifyWriteError()`, `replaceCloudWithDb()` /
  `bulkReplaceCloud()`, `user_id` scoping on any query, bill or payment arithmetic, `doLogin()` /
  auth, `supabase-schema.sql`, or `_headers`. Also architecture, security, database/schema, or the
  AI Dev OS / workflow files themselves. **Never chained** — see Hard Rule 10.

A mixed-risk group is classified at its highest risk. Split a High-risk task into its own group
rather than carving out an exception for it inside a Low/Medium one.

### Marking a group for chained execution

One extended header on the existing `TASKS.md` section-divider comment. No new file, no new
per-task field beyond an optional `checkpoint:` label:

```
<!-- ═══════════════════════════════════════════════════════
     BQ-016 · Modal mobile-footer-stacking fix
     Risk: Low · Execution: Chained
     ═══════════════════════════════════════════════════════ -->
```

Each task may carry:

```
checkpoint: Modal CSS migration complete
```

A checkpoint is a **semantic** label Claude writes after a real engineering boundary — "Modal CSS
migration complete", "Playwright stabilization complete", "Authentication UI complete" — never a
count or a duration. Codex chains through same-`source:`, same-`checkpoint:` tasks; once the next
ready task's `checkpoint:` differs (or there is no next ready task sharing it), that checkpoint is
complete — Codex stops and hands off for Review there, even if later checkpoints in the same group
still have `status: codex` tasks waiting. If no task in the group carries a `checkpoint:`, the
whole group is one implicit checkpoint (stop only once it runs out of ready tasks — today's
end-of-run behavior).

Absent `Risk`/`Execution` entirely = today's behavior exactly: one task per `Continue`.

### When a task inside a chained group fails

Codex does not stop the whole group just because one task is blocked:

1. Mark that task `status: blocked`; record the blocker under it, same as always.
2. If verification was attempted, append the `TEST_REPORT.md` entry regardless of outcome.
3. For each remaining `status: codex` task in the current checkpoint:
   - Depends (directly or transitively) on the blocked task → leave it `status: codex` untouched;
     note the skip in `CHANGELOG.md`; move to the next candidate.
   - Independent of the blocked task → implement it normally, continuing the chain.

Codex must stop the **entire group** — not just skip one task — if:
- the blocked task is a dependency for most/all of what's left (nothing genuinely independent
  remains),
- the blocker looks like an architecture/scope issue affecting the whole group, not just one task,
- a test failure could invalidate assumptions a later task in the group relies on, or
- the next task touches the same file/region the blocked task's fix was going to touch.

### How Claude reviews a chained group

One `REVIEW.md` entry per checkpoint, bucketed — never a single bulk stamp:

- **Approved** — acceptance criteria and evidence hold up → `status: done`.
- **Blocked** — still needs Claude's resolution → stays `blocked`.
- **Rework** — fully attempted but doesn't pass review → `status: codex`, and permanently exits
  chained execution (no re-entry — handled solo from here).
- **Skipped (dependency)** — untouched because it depends on a blocked task → stays `status:
  codex`, reconsidered once that dependency clears.

A group is a scheduling optimization, not a package deal: one task failing review never
invalidates its already-correct siblings. See DECISIONS D-023.

## Extensibility

Additional AI agents may be added.

Each new agent must:

- have one primary responsibility
- have clearly owned files
- communicate through repository documents
- never duplicate another agent's ownership

The AI team should remain modular.
