<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Garage WOD Tracker

A multi-user training log for a garage gym. Production port is **3006**; the
shared-host port table lives in `deploy/README.md` and is the one place it is
recorded.

## Voice

Screen copy is deliberately terse and direct — ownership, no excuses, no
cheerleading. "Log it", not "Save result". Keep new copy in that register, but
never at the cost of clarity: **error messages stay plain and specific**, because
someone is reading them mid-session with chalk on their hands.

## Rules that are easy to break

- **Scores are derived, never typed.** `deriveScore` turns logged movements
  into the workout's result, keyed off the format's score kind. Nothing in the
  UI should ask for a score directly. The format also owns sort direction
  (`compareScores`), so leaderboard ranking cannot happen in SQL.
- **A null score is not a zero.** It means started-but-not-recorded, and it
  sorts last in both directions; a zero would beat every finisher in a
  lower-is-better workout.
- **A result can exist before the session is over.** `results.completed`
  separates a draft from a finished session; the logging screen autosaves with
  `completed: false` and only the finish sets it true. Every query that ranks
  or counts training filters `completed = 1` — leaderboard, analytics and the
  AI context — or a workout abandoned halfway lands on the board as a finished
  bad score. Finishing sticks: the upsert takes `MAX(completed)` so a late
  autosave cannot reopen a session.
- **Removing an assignment destroys training history.** `results` is keyed on
  the assignment and cascades, so it is the only action in the app that can
  delete a logged session. Any control that calls it asks twice and names what
  goes with it.
- **A plan is the record that sessions were written together**, and the only
  place the model's week summary survives. `workouts.plan_id` is
  `ON DELETE SET NULL`: a workout somebody has already done outlives the week
  it was planned in.
- **An owner may rearrange and prune an athlete's week; only the athlete logs
  it.** `moveAssignment` and `deleteAssignment` both take an actor and accept
  the athlete or any owner. The card takes three separate permissions
  (`canLog`, `canMove`, `canRemove`) rather than one read-only flag, since a
  coach sits between the two states.
- **Weeks run Sunday to Saturday.** `weekStart` returns the Sunday on or
  before a date, and `DAY_NAMES` is Sunday-first to match `getDay()`. Changing
  this moves every planner view and the date the planner snaps to.
- **Only an owner can view another athlete**, the subject comes from
  `?athlete=`, and the store's checks are the real boundary — the page hiding
  buttons is a courtesy, not the enforcement.
- **`results.date` is a denormalised copy of the assignment's date.** Moving a
  session must update both, or it sits on one day in the planner and another
  in the record.
- **Loads are whole grams, durations are seconds.** Kilograms and pounds are
  renderings. Convert at the boundary — form input and AI import — and nowhere
  else.
- **A track decides the shape of the week.** `TRACK_SPECS[track].brief` goes
  to the model ahead of the phase, because a session written for 40 minutes is
  simply wrong in a 12-minute slot. `sessions` is the same number the planner
  defaults the day count to — keep the brief's wording and that figure in step.
- **A workout keeps the track it was written for**, exactly like its phase.
  `users.track` is intent; `workouts.track` is history.
- **A phase is not a label — it changes the week.** `PHASE_SPECS[phase].brief`
  is the instruction the model actually receives, and it outranks the coach's
  brief. Keep `summary` (on screen) and `brief` (to the model) saying the same
  thing.
- **A workout keeps the phase it was written under.** `users.phase` is now;
  `workouts.phase` is history. Never backfill the second from the first.
- **`Store.transaction` is re-entrant via savepoints.** Methods that wrap their
  own writes nest legitimately (`importWeek` around `createWorkout`); plain
  `BEGIN` would throw. Keep new multi-write methods going through it.
- **The equipment list is a hard constraint on generation.** Only
  `availableEquipment()` reaches the prompt: listing a broken rower is the same
  as programming one.
- **The CSP lives in `src/proxy.ts`, not `next.config.ts`.** It needs a fresh
  nonce per request, because Next streams page data in inline `<script>` tags.
  A static `script-src 'self'` blocks every one of them: pages still render and
  the server logs nothing, but React never hydrates (minified error #412) and
  everything interactive silently stops working.
- **A page that reads `process.env` or the database must be `force-dynamic`.**
  Otherwise it is prerendered and the value is baked in at build time — which
  is what made `/setup` insist `SETUP_TOKEN` was unset no matter what the
  server had.
- **Domain logic lives in `src/lib/` and stays free of React**, so `test/` can
  run it under `node` against a real SQLite file.
- **Never edit a shipped migration** — append a new entry to `MIGRATIONS`.
- The database is `node:sqlite`, listed in `serverExternalPackages`. It lives
  under `DATA_DIR`, and nothing is written outside it; the systemd unit mounts
  everything else read-only.
- `output: "standalone"` is what the systemd unit runs. Deploys must copy
  `.next/static` by hand — Next does not put it in the standalone output.

## Secrets

`ANTHROPIC_API_KEY` and `SETUP_TOKEN` are read from the environment and belong
in a systemd drop-in, never in the shipped unit or the repo.
