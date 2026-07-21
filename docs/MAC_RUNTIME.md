# Mac Runtime — what the AI Dev OS actually runs on this machine

> **Scope.** This documents the *deployed automation* on this Mac: the processes, the schedule, the
> stack, and the moving parts that let you build the app from Telegram while away. It is the macOS
> counterpart to `AI-DEV-OS.md` (the generic OS) and `SYSTEM-OVERVIEW.md` (the pipeline concept).
>
> The other OS docs still describe the **Windows** origin — Task Scheduler, `WakeToRun`, `.cmd`
> shims. This machine runs **launchd** instead, and several behaviours differ because of it. Where
> they conflict about runtime behaviour, this file is right for this machine.
>
> **Audited live 2026-07-22** by inspecting the running jobs, installed binaries, and plists — not
> by reading the scripts. Re-audit with the commands in the last section if anything here looks
> stale.

## One-paragraph summary

Three cooperating systems. **n8n** (hosted, off this machine) is the phone bridge: it turns your
Telegram messages into files in the GitHub repo and relays replies back. **launchd** (on this Mac)
runs two scheduled PowerShell jobs that pull those files, act on them, and push results. The
**work itself** is done by the `claude` CLI, invoked headlessly by those jobs to build and review
code on task branches. The repo on GitHub is the message bus between all three — nothing is held in
memory; every instruction and every reply is a committed file.

## The stack actually installed here

| Tool | Version | Path | Role |
|---|---|---|---|
| PowerShell | 7.6.3 | `/opt/homebrew/bin/pwsh` | Runs every automation script. The whole OS is `.ps1`. |
| .NET | 10.0.302 | `/opt/homebrew/bin/dotnet` | PowerShell 7's runtime. `pwsh` is a thin apphost over it. |
| Node.js | 26.5.0 | `/opt/homebrew/bin/node` | Runs the Playwright test suite. |
| npm | 11.17.0 | `/opt/homebrew/bin/npm` | `npm test` — the verification gate. |
| claude | 2.1.215 | `/opt/homebrew/bin/claude` | **The builder and the reviewer.** Invoked headless (`claude -p`). |
| codex | **not installed** | — | The *intended* builder. Absent, so `claude` does both roles via the D-048 fallback. |
| git | 2.39.5 (Apple) | `/usr/bin/git` | Talks to the GitHub repo — the message bus. |
| python3 | 3.9.6 (system) | `/usr/bin/python3` | Static file server for the test suite (`http.server`); small JSON/plist chores. |

Everything except `git` and `python3` is from **Homebrew** (`/opt/homebrew`). That single fact is
behind two of the hardest-won fixes here — see "launchd gotchas" below.

**codex is absent.** The OS was designed for two vendors — Codex builds, Claude reviews, so the
model that writes the code is not the model that judges it. With only `claude`, both roles are the
same model (disclosed on every such task per D-048). The separation that survives is enforced
structurally, not by vendor — see "How builder and reviewer are kept apart".

## The two launchd jobs

Both are user LaunchAgents in `~/Library/LaunchAgents/`, both run `pwsh -NoProfile -File <script>`,
both log to `claude-session.log`, and both carry the same two environment variables (see gotchas).

### `com.aidevos.apartment-manager.dispatcher`

- **Runs:** `tools/Dispatch-Commands.ps1`
- **Schedule:** `StartInterval` — **every 300 s (5 min)**. `RunAtLoad = true`, so it also fires the
  moment it is loaded.
  > ⚠ The installer default is **1800 s (30 min)**. This machine is currently at 5 min because it
  > was dropped for interactive testing. To restore: set `StartInterval` back to 1800 and
  > `launchctl unload`/`load` the plist, or re-run `setup-command-dispatcher-scheduler.ps1`.
- **Job:** the remote control loop. Pull the repo, find new command/decision files, act on them,
  write replies, push. This is what makes `/status`, `/go`, `/enable`, etc. work from the phone.

### `com.aidevos.apartment-manager.overnight`

- **Runs:** `run-claude.ps1`
- **Schedule:** `StartCalendarInterval` — **21:00 and 02:00 daily**.
- **Job:** the unattended planning pass — triage captures into proposals, apply approval replies,
  convert approved build-queue items into tasks, refresh the digest. It does **not** build code;
  building happens through the dispatcher's `/go` or `/build`.

Confirm both are loaded:

```bash
launchctl list | grep aidevos
```

A PID or `0` in the first column means loaded. `-` means not currently running (normal between
ticks).

## Power: the Mac must stay awake

launchd does **not** wake a sleeping Mac. macOS has no `WakeToRun` equivalent (the Windows OS relied
on one), so a sleeping machine sits on a queued `/go` until something touches it. This machine is
therefore configured to **not sleep**:

```
$ pmset -g | grep sleep
 sleep                0 (sleep prevented by powerd)
```

The display still sleeps (`displaysleep 10`) and the disk still spins down (`disksleep 10`) — only
system sleep is disabled. On a desktop that idles at a few watts this is the right trade for a
remote loop that actually fires. If this machine is ever a laptop that closes its lid, the loop
stops until it is reopened.

## n8n — the phone bridge (external)

n8n is **not on this Mac.** It is a hosted n8n instance (the workflows talk to Telegram and to the
GitHub API; no webhook server runs locally). The repo holds **exported copies** of three workflows
as documentation and backup — the live versions run in n8n and may have drifted from these files.

| Workflow (repo copy) | Trigger | What it does |
|---|---|---|
| `n8n-telegram-inbox.json` | Telegram message | Sorts each message into one of three lanes and **creates a file in the repo** via the GitHub API. No thinking — pure transport. |
| `n8n-telegram-replies.json` | **every 2 min** | Reads `captures/replies/OUTBOX.md` from GitHub; if non-empty, sends it to Telegram and clears it. The clear-after-send is the delivery proof. |
| `n8n-telegram-digest.json` | **cron `0 7 * * *`** | Reads `planning/DIGEST.md` from GitHub and sends it to Telegram each morning. |

All three reach the repo through the **GitHub API** (`api.github.com/repos/alyboo-code/apartment-manager`),
not through this Mac. That is why **nothing is visible to n8n until it is pushed to `main`**, and why
the dispatcher must `git pull` every tick.

> The exported `n8n-telegram-inbox.json` still contains `REPLACE_WITH_YOUR_TELEGRAM_USER_ID` in its
> authorized-sender check, yet captures arrive — so the *live* workflow was edited in the n8n UI and
> never re-exported. Treat the repo copies as approximate. Re-export from n8n to refresh them.

## The three message lanes

n8n routes every Telegram message by how it **starts**:

| Message starts with | Lane | File written | Consumed by |
|---|---|---|---|
| a control verb: `/status /next /go /run /build /review /merge /audit /stop /enable /disable /log` | **command** | `captures/commands/<id>.md` | `Dispatch-Commands.ps1` (dispatcher) |
| a decision verb, **no slash**: `accept approve park reject clarify` | **decision** | `captures/decisions/<id>.md` | `Apply-Decisions.ps1` (overnight) |
| anything else | **capture** (an idea) | `captures/inbox/<id>.md` | triage in `run-claude.ps1` (overnight) |

## End-to-end: a `/go` from the phone

```
 phone: /go
   │
   ▼  Telegram
 n8n (hosted) ── GitHub API ──▶ writes captures/commands/<id>.md on main
   │
   ▼  ≤5 min later
 launchd fires Dispatch-Commands.ps1 on this Mac
   │  git pull --ff-only         (the file only existed on GitHub until now)
   │  find status: new commands
   │  /go → Invoke-Autopilot:
   │     1. a task at status: review?  → Run-Claude-Review.ps1   ← finish work in flight first
   │     2. approved work unbuilt?     → Run-Codex-Build.ps1 → auto-review
   │     3. nothing queued?            → Run-Audit.ps1 (find bugs) → plan
   │  write captures/replies/OUTBOX.md → commit → push
   │
   ▼  ≤2 min later
 n8n replies workflow → sends OUTBOX.md to your phone → clears it
```

The builder (`Run-Codex-Build.ps1`) checks out `task-<id>`, invokes `claude -p` to implement the
one task, commits on that branch, and hands to review. The reviewer (`Run-Claude-Review.ps1`) runs
`claude -p` to judge the diff, runs `npm test` as an independent gate, and either auto-merges
(reversible work → `done`) or holds for your `/merge` (red-zone work → `approved`).

## `tools/` — the phase runners

Every automation script. All PowerShell, all self-contained (no shared lib — a repo convention).

| Script | Invoked by | Role |
|---|---|---|
| `Dispatch-Commands.ps1` | dispatcher launchd job | The remote-control loop. Routes every Telegram command. |
| `Run-Codex-Build.ps1` | `/build`, `/go` | Builds one task on `task-<id>` via `claude` (or codex, if present). |
| `Run-Claude-Review.ps1` | `/review`, `/go` | Reviews a branch, runs the `npm test` gate, merges or holds. |
| `Run-Merge.ps1` | `/merge` | Two-step manual merge of a held (`approved`) red-zone branch. |
| `Run-Audit.ps1` | `/audit`, idle `/go` | Scans the app for bugs, writes proposals. |
| `Apply-Decisions.ps1` | overnight | Applies `approve/park/reject` replies to PROPOSALS + BUILD_QUEUE. |
| `Generate-Digest.ps1` | overnight | Builds `planning/DIGEST.md` for the morning Telegram digest. |
| `Generate-Codex-Notice.ps1` | overnight | Builds `planning/CODEX_READY.md` (the "N tasks ready" notice). |
| `Invoke-AutoPromote.ps1` | overnight | Auto-promotes Decision:Approve + Risk:Low proposals (D-042). |
| `Check-DocsConsistency.ps1` | manual / CI-of-one | Flags identifiers in docs that no longer exist in `index.html`. |
| `Verify-Decisions.ps1` | manual | Runs the `Verify:` pointers in `docs/DECISIONS.md` against the code. |

## How builder and reviewer are kept apart (with one vendor)

Real vendor separation is unavailable without `codex`, so the separation is enforced by **process
and permission** instead. Three levers, all verified live:

1. **`npm test` gates both landing paths.** The verification gate runs on `approved` (held) work as
   well as `done` (auto-merge) work. The test suite — written before the build, by a different
   author — is the one check no model can talk its way past.
2. **The builder cannot touch `tests/`.** Enforced twice: a `--disallowedTools "Edit(tests/**)"`
   grant, and `^tests/` in the commit-scope guard (because the builder also has `Bash(node *)` and
   could otherwise write a file through Node).
3. **The reviewer cannot edit `index.html` or `tests/`.** A reviewer that quietly fixes a bug is a
   second builder; a reviewer that can weaken a test can manufacture its own green light.

The deepest separation is not the reviewer at all — it is that **`npm test` is deterministic and
model-independent.** See `docs/DECISIONS.md` D-005 and `tests/README.md`.

## launchd gotchas (both cost a full debugging session)

Both stem from launchd giving a job a **bare environment** — it does not read your shell profile.

1. **`DOTNET_ROOT`.** Homebrew's `pwsh` is a thin apphost that finds .NET via `DOTNET_ROOT` or a
   few defaults Homebrew does not populate. Without it in the plist, every scheduled run dies before
   PowerShell starts: *"You must install .NET to run this application."*
2. **`PATH`.** launchd's default PATH omits `/opt/homebrew/bin` — where `claude` lives. Without a
   PATH in the plist, `pwsh` starts, the dispatcher runs, and then the builder's `Get-Command
   claude` returns nothing: *"neither 'codex' nor 'claude' is on PATH"* — which reads like an auth
   failure but is purely environmental. **The identical build works when run by hand in a terminal.**

Both are baked into the plists' `EnvironmentVariables` (verify with `PlistBuddy -c Print` below) and
into the two `setup-*.ps1` scripts so a re-install keeps them.

## Deploy target (unverified)

`_headers` is a Netlify-format file and the remote is GitHub, but there is no `netlify.toml`, no
`.github/workflows/`, and no other host config in the repo — so the site-to-repo link could not be
confirmed from code. Treat a push to `main` as "probably live in ~1 min" and verify in the browser.
Confirm the Netlify connection before trusting an unattended red-zone deploy. (Also in
`CLAUDE.md` → Deploy and `STATUS.md`.)

## Re-audit commands

Run these to regenerate the facts in this doc:

```bash
# stack + versions
for b in pwsh dotnet node npm claude codex git python3; do printf "%-8s " $b; command -v $b && $b --version 2>/dev/null | head -1; done

# launchd jobs + full plist
launchctl list | grep aidevos
/usr/libexec/PlistBuddy -c Print ~/Library/LaunchAgents/com.aidevos.apartment-manager.dispatcher.plist
/usr/libexec/PlistBuddy -c Print ~/Library/LaunchAgents/com.aidevos.apartment-manager.overnight.plist

# sleep must be 0
pmset -g | grep '^ *sleep'

# automation master switch
grep -m1 'AUTOMATION_ENABLED =' run-claude.ps1
```
