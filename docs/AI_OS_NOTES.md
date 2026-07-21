# AI OS Notes

> Append-only friction log. One line per workflow awkwardness noticed while working.
> These are candidate improvements to the OS itself — not app bugs.

- 2026-07-22 — `Apply-Decisions.ps1` marks a decision capture `status: applied` even when its reply
  parsed to zero clauses, so an unparseable approval is silently consumed and can never be retried.
  Hit for real: a bare `Approve` (no proposal numbers, not `accept`/`approve all`) left PROP-002..006
  pending while stamping the reply applied. Two candidate fixes, both small: (a) only stamp
  `applied` when that file produced at least one clause, leaving unparsed replies `new`; (b) when a
  reply contains a verb but no numbers and no `accept`/`all`, write it back as `status: unparsed`
  with a note, so the digest can ask the human to restate it. Worth pairing with (c): make the digest
  state the accepted reply grammar explicitly, since the human has no way to know `Approve` alone is
  a no-op. See STATUS.md → "Needs human verification" #2 for the incident.

- 2026-07-22 — The OS docs (`AI-DEV-OS.md`, `SYSTEM-OVERVIEW.md`, both `setup-*.ps1`) describe a
  Windows/Task Scheduler runtime, but this machine runs macOS/launchd. Nothing documented the
  actual deployed stack until `docs/MAC_RUNTIME.md`. Candidate: a porting note in the generic OS
  docs pointing macOS installs at MAC_RUNTIME, or a `runtime:` field the installer stamps.
