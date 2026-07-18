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
