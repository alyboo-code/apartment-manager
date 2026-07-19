# Decisions — approval replies from Telegram

The third capture lane. n8n routes a message here when it **starts with a decision verb**
(`accept`, `approve`, `park`, `reject`, `clarify`) — **no leading slash**. Anything starting with a
control verb goes to `../commands/`; everything else is an idea and goes to `../inbox/`.

```
Telegram  "Approve 2"  →  n8n  →  captures/decisions/<id>.md
                                        │  tools/Apply-Decisions.ps1 (run-claude.ps1 Phase 1)
                                        ├─ PROPOSALS.md  → status updated
                                        └─ BUILD_QUEUE.md → approved items appended
```

## Why this folder is committed with a README

It must **exist on disk**, empty or not. `tools/Apply-Decisions.ps1` opens it unconditionally, and
the whole runner uses `$ErrorActionPreference = 'Stop'` — so a missing folder throws, which
`run-claude.ps1` turns into a full `Halt-Automation`. Every planning run then dies before it
triages anything.

That is exactly what happened on 2026-07-20: the folder had never been created (n8n would only
create it remotely, on the first decision reply ever sent), so the first planning run after
automation was enabled halted with:

```
Apply-Decisions.ps1 threw an error: Cannot find path '.../captures/decisions' because it does not exist.
```

Git does not track empty directories, so this README is what keeps the folder alive in a fresh
clone. **Do not delete it**, even though the folder looks empty and disposable.

`Apply-Decisions.ps1` now also tolerates the folder being absent, so this is belt and braces.

## File format (what n8n writes)

```markdown
---
id: 20260704T2100Z-99-decide
kind: decision
captured: 2026-07-04T21:00:00Z
via: telegram
msg_id: 99
status: new
---

Approve 2
```

`status: new` is the idempotency key — `Apply-Decisions.ps1` skips anything already applied.
