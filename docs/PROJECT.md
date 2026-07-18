# apartment-manager — Project

> North star. What this is and why. **Write this first** — triage scores every captured idea
> against the north-star goals below, so vague goals produce a vague backlog.

## What it is

A point-of-sale for rooms for rent. A landlord records each room and who lives in it, enters the
month's electric reading and any other charges, and the app produces the bill sheet for that
month — then tracks who has paid and who is overdue. Alongside billing it keeps the operating
picture: expenses, maintenance requests, and mortgage progress. It runs in a browser, works on a
phone, and keeps working when the connection drops.

## Who it's for

Today: one landlord — the author — managing their own units, replacing a spreadsheet and a
notebook.

Where it is going: other small landlords running the same monthly rhythm on their own units. That
future is not hypothetical enough to ignore — it is the reason data isolation between accounts is
ranked as high as it is below, well before the first outside user signs up. Building for it now is
cheaper than retrofitting it after a leak.

## Core value loop

The monthly cycle the landlord actually repeats:

1. **Read the meters** — walk the units, note each room's electric reading.
2. **Enter usage and charges** — reading plus rent, plus any one-off charges for that room.
3. **Generate the bill sheet** — the printable per-room statement for the period.
4. **Send it** to each tenant.
5. **Mark payments** as they arrive; watch the overdue list shrink.

Steps 2, 3, and 5 are where the time goes and where the app earns its keep. Expenses, maintenance,
and mortgage tracking hang off this loop but are not part of it.

## North-star goals (for triage scoring)

**Ranked.** Triage scores each captured idea against these — an item serving a higher goal
outranks a cosmetic one *regardless of how appealing it sounds*. This ranking is the single
most load-bearing thing in this file.

1. **Never lose or corrupt billing history.** The record of who owes what and who has paid *is*
   the product; everything else is a view over it. A lost month cannot be reconstructed from
   memory, and a silently wrong one is worse than a visibly missing one — it gets acted on. This
   is why the write path queues failed writes to an outbox and distinguishes "offline, will
   retry" from "server refused, never retrying", and it is why any change touching persistence
   is treated as red-zone regardless of how small the diff looks.
2. **Never show one landlord another landlord's data.** Every row carries a `user_id` and every
   query filters on it. The day this app has a second user, one leak ends it — there is no
   version of "we showed your tenants' names and payment history to a stranger" that gets
   apologized away. Ranked above convenience even though there is currently only one account,
   because the cost of getting it wrong is not proportional to the number of users affected.
3. **Make the monthly management convenient.** The reason anyone opens the app instead of a
   spreadsheet. Fewer taps, less re-typing, less arithmetic done by hand, the phone working as
   well as the laptop. Real and load-bearing — it is just outranked by the two ways this product
   can fail permanently rather than annoyingly.

The gap between #2 and #3 is the important one. A polished new view that touches account scoping
loses to a plain fix that protects it.

## Non-goals (deliberately not building)

- **A tenant-facing login.** Tenants receive bill sheets; they do not get accounts. The auth
  surface stays one role wide.
- **Online rent collection / payment processing.** The app records that a payment happened. Money
  moves outside it. Taking payments would drag in PCI scope, disputes, and refunds for no gain in
  the core loop.
- **Accounting software.** Expenses are tracked to understand the property, not to file taxes. No
  double-entry, no ledger, no chart of accounts.
- **A build step or framework.** See Hard Rule 9 and DECISIONS D-001. The single-file architecture
  is a deliberate choice, not an accident to be corrected.
- **Multi-property portfolio management.** Rooms in a building, not buildings in a portfolio.
  Revisit only if a real landlord asks for it.

## Stack

- **One file:** `index.html` — markup, CSS, and ~169 functions of vanilla JS. No framework, no
  bundler, no build step. Open it and it runs.
- **Backend:** Supabase (Postgres + Auth). Client loaded from CDN with an SRI hash. Seven tables:
  `rooms`, `bills`, `payments`, `expenses`, `maintenance`, `mortgages`, `settings`. Schema in
  `supabase-schema.sql`.
- **Auth:** Supabase email/password. Every table row carries `user_id`; every query filters on it.
- **Offline:** failed writes queue to a localStorage outbox (`apt_outbox`) and replay on
  reconnect. Service worker (`sw.js`) plus `manifest.webmanifest` make it installable.
- **Deploy:** push to `main`. See CLAUDE.md "Deploy".
