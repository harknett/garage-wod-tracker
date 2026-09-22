<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Garage WOD Tracker

A personal training log. Production port is **3006**; the shared-host port
table lives in `deploy/README.md` and is the one place it is recorded.

- Domain logic goes in `src/lib/` and stays free of React so `test/` can run it
  under `node`.
- The database is `node:sqlite`, listed in `serverExternalPackages`. It lives
  under `DATA_DIR`, and nothing is written outside it — the systemd unit mounts
  everything else read-only.
- `output: "standalone"` is what the systemd unit runs. Deploys must copy
  `.next/static` by hand; Next does not put it in the standalone output.
