# Garage WOD Tracker

A training log for the garage gym. Next.js, SQLite, no account anywhere else.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

In production it listens on **3006** — see [`deploy/README.md`](deploy/README.md)
for the port table it shares with the other services on the host.

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
| `src/app/` | Routes and layouts. |
| `src/lib/` | Domain logic, no React. `score.ts` parses and formats whiteboard scores. |
| `test/` | Vitest specs, `*.test.ts`, run in `node`. |
| `deploy/` | systemd unit and deployment notes. |
| `data/` | The SQLite database. Gitignored, never in a build. |

## Scores

A score is either a time or a count of rounds, and the two notations overlap at
a bare integer: `45` is 45 seconds for a timed workout and 45 rounds for an
AMRAP. `parseScore` therefore takes the event's kind rather than guessing from
the text, which is the difference between a 45-second sprint and an
impossible day.
