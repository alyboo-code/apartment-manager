# 📱 Phone Card

Everything you send the bot lands in one of **three lanes**, decided by how the message starts.

---

## 1 · CAPTURE — an idea

**Just text it.** No slash needed.

> *tenants should get a text when their bill is ready*

Tag it if you feel like it — `/feature` `/bug` `/todo` `/idea` `/research`. Skip it and triage
works out what it is.

> **Capture. Don't think.** Judgment happens later, on the PC, with the goals in front of it.

---

## 2 · DECIDE — answer the digest

The morning digest lists what's waiting. Reply with **no slash**:

| Reply | Means |
|---|---|
| `Accept` | take every recommendation as-is |
| `Approve 2` · `Approve 4-7` | build these |
| `Park 3` | valid, not now |
| `Reject 5` | drop it |
| `Clarify 6` | answer its question first |

*Approve + Low risk* items skip this step and queue themselves. Anything touching data, billing,
auth, or sync always waits for you.

---

## 3 · COMMAND — make something happen

| Send | Does |
|---|---|
| **`/go`** | **the everyday button.** Builds the top task — or, if nothing's queued, finds something worth doing and builds that |
| `/status` | branch, tree state, what's ready, what's mid-run |
| `/next` | whose turn it is and what to send |
| `/merge TASK-001` | show what a held branch touches (**cannot merge**) |
| `/merge TASK-001 yes` | actually land it |
| `/run` | triage + planning now, don't wait for tonight |
| `/build` · `/review` | one phase only, when you want the steps apart |
| `/audit` | go looking for problems |
| `/log` | last 40 lines, when something looks wrong |
| `/stop` | **kill switch** — halts automation now |
| `/enable` · `/disable` | the master switch |

`/status`, `/next`, `/stop`, `/enable`, `/disable` work even while automation is off — so you can
always look, and always flip the switch back.

---

## Rhythm

| When | What |
|---|---|
| any time | text ideas |
| 07:00 | digest arrives → reply `Accept` or pick |
| any time | `/go` |
| 21:00 · 02:00 | triage + planning, unattended |
| after a build | `/merge TASK-00N` → read it → `/merge TASK-00N yes` |

Commands are picked up within **5 minutes**. Your Mac has to be **awake** — asleep means nothing
runs.

---

## What won't happen without you

Work touching **billing data, payment records, account isolation, auth, or the sync layer** never
auto-merges. It lands `approved` and waits.

`/merge TASK-001` on its own only *shows* you the diff and why it was held. Landing it takes the
second message. That's deliberate: the gate wants you to have **looked** — not to have been at a
desk.

---

## When something looks stuck

1. `/status` — is automation on? is the tree clean? is a run in progress?
2. `/log` — last 40 lines
3. Still stuck → it's a PC-side problem; `OPERATOR.md` has the real playbook

A **dirty tree blocks every build.** If `/status` says *dirty*, commit or stash on the Mac —
nothing will build until it's clean.
