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

- **A score is meaningless without its format.** `parseScore` takes the format;
  never infer it from the text. The format also owns sort direction
  (`compareScores`), so leaderboard ranking cannot happen in SQL.
- **Loads are whole grams, durations are seconds.** Kilograms and pounds are
  renderings. Convert at the boundary — form input and AI import — and nowhere
  else.
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
