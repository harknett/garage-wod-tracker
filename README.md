# Garage WOD Tracker

Write the week. Train it. Log it. Live with the record.

A multi-user training log for a garage gym: the coach writes the programming on
a laptop — by hand or with Claude — and everyone does it and logs it from their
phone. Next.js, SQLite, no account anywhere else.

## What it does

| | |
| --- | --- |
| **Programming** | Every common format — for time, AMRAP, EMOM, death by, sets and reps, tabata, chipper, ladder, intervals, strength, skill — each with its own scoring rule. |
| **Training phases** | Every athlete is *ramping*, *conditioning*, *leaning* or *building*. The phase is the frame the whole week is written inside, and each session is stamped with the phase it was written under. |
| **AI weeks** | Claude writes a cohesive week against the athlete's phase, their last eight weeks of logged results, their RPE and notes, and the gym's equipment list. |
| **Equipment** | An inventory of what the gym actually owns. The model programs to it exactly, and kit marked out of action is never written into a session. |
| **Logging** | Per-movement reps, load, time and distance. The workout's result is derived from those as you type, never entered separately. Built for a phone, mid-session, with one hand. |
| **Planning** | Sessions can be moved to any other day from the week view; a logged result moves with them. |
| **Units** | Loads in kilograms or pounds, per athlete. Both are stored as grams, so two people logging the same barbell land on the same number. |
| **Leaderboard** | Any workout two or more athletes have done, ranked in the direction that format actually runs. |
| **Progress** | Sessions per week, RPE trend, format mix, and the heaviest load recorded per movement. |

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

The first visit lands on `/setup`, which needs `SETUP_TOKEN` set:

```bash
SETUP_TOKEN=dev npm run dev
```

That creates the owner account. Everyone else is added from **Athletes** and
gets a one-time password shown once on screen.

To try week generation locally, set `ANTHROPIC_API_KEY` too. Without it the
whole app works and the Build screen says generation is off.

In production it listens on **3006** — see [`deploy/README.md`](deploy/README.md)
for the shared-host port table, the systemd unit, TLS, upgrades and backups.

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Development server. |
| `npm run build` | Production build, including the standalone server. |
| `npm start` | Serve a build locally. |
| `npm test` | Vitest, once. |
| `npm run typecheck` | `next typegen` then `tsc --noEmit`. |
| `npm run lint` | ESLint. |

## Layout

| Path | Holds |
| --- | --- |
| `src/app/(auth)/` | Sign in, first-owner setup, change password. |
| `src/app/(app)/` | Everything behind the session: today, week, log, build, equipment, leaderboard, progress, athletes, settings. |
| `src/lib/workout/` | Formats and scoring — the rules that decide what a result means. |
| `src/lib/units.ts` | Grams and seconds in, kilograms, pounds and clocks out. |
| `src/lib/db/` | Schema migrations and every query, in one `Store`. |
| `src/lib/ai/` | The prompt, the output schema, and the importer that turns a generated week into rows. |
| `src/lib/auth/` | Sessions, scrypt passwords, sign-in throttling. |
| `test/` | Vitest specs, `*.test.ts`, run in `node` against real SQLite files. |
| `deploy/` | systemd unit and the deployment, upgrade and backup guide. |
| `data/` | The SQLite database. Gitignored, never in a build. |

## Phases

| Phase | Means |
| --- | --- |
| **Ramping** | Coming back from sedentary, illness or injury. Volume climbs before load; nothing to failure; sessions end with something left. |
| **Mobility & conditioning** | Daily maintenance and balance, with no composition or strength target in play. Every movement pattern covered, mobility programmed as real work, and a week repeatable indefinitely. Where a healthy athlete lives between blocks. |
| **Leaning** | Dropping fat while holding muscle. Density and conditioning, but enough heavy work that strength survives the deficit. |
| **Building** | Adding strength and muscle. Heavy compounds first, full rest, visible week-on-week progression; conditioning supports it rather than competing. |

The owner sets an athlete's phase on **Athletes**; it can be overridden for a
single generated week on **Build** without moving the athlete. A workout keeps
the phase it was written under forever — move someone from building to ramping
after an injury and last week still reads as the building week it was.

## Two things worth knowing

**The result is derived, never typed.** An athlete logs what they actually did
per movement, and the format decides what that adds up to: total reps divided
back into rounds for an AMRAP, working time for a for-time, the heaviest single
set for strength. Asking for both a score and the movements invites them to
disagree, and when they do there is no way to tell which one is the lie. The
same format spec decides which direction the leaderboard sorts.

**Loads are stored as whole grams.** Kilograms and pounds are both renderings
of that one number. A float would sort fine and group badly — `60.000000000000004`
becomes its own row on a leaderboard.
