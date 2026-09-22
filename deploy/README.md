# Deploying Garage WOD Tracker

One Node process behind a reverse proxy, run by systemd as its own user, with
a SQLite file for state. It is built for a small VPS — one vCPU and 1 GB of RAM
is enough for a household or a gym.

- [Ports on a shared host](#ports-on-a-shared-host)
- [What the unit expects](#what-the-unit-expects)
- [Environment](#environment)
- [First install](#first-install)
- [Creating the first account](#creating-the-first-account)
- [Reverse proxy and TLS](#reverse-proxy-and-tls)
- [Upgrading](#upgrading)
- [Backups and restore](#backups-and-restore)
- [Troubleshooting](#troubleshooting)

## Ports on a shared host

These services sit behind one reverse proxy on one machine, so each takes a
different loopback port. Whichever two share a port, the second to start dies
with EADDRINUSE.

| Service | Port |
| --- | --- |
| schedule-f-books | 3000 |
| eden-planner | 3001 |
| tricklingspring | 3002 |
| jms-crm | 3003 |
| _reserved: headache_diary_ | 3004 |
| _reserved: the_eights_ | 3005 |
| **garage-wod-tracker** | **3006** |

Change a port with a drop-in rather than by editing the shipped unit, so an
upgrade does not overwrite the change:

```bash
sudo systemctl edit garage-wod-tracker
#   [Service]
#   Environment=PORT=3007
```

## What the unit expects

Nothing below is created automatically except the state directory.

| Thing | Notes |
| --- | --- |
| `garage-wod-tracker` user and group | System account, no login shell. |
| `/opt/garage-wod-tracker` | The build. Read-only to the service. |
| `/var/lib/garage-wod-tracker` | Created by `StateDirectory=` at 0700 on first start. Holds `training.db`. |

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin garage-wod-tracker
```

Node 22 or newer is required: the app uses the built-in `node:sqlite`, so there
is no native module to compile and nothing to rebuild when Node is upgraded.

## Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | 3000 | The unit sets 3006 — see the port table. |
| `HOSTNAME` | all interfaces | The unit sets 127.0.0.1. The standalone server honours this; `next start` does not. |
| `DATA_DIR` | `./data` | The unit points this at `/var/lib/garage-wod-tracker`. |
| `SETUP_TOKEN` | unset | Enables the one-time first-account page. Set it only while claiming the gym, then remove it. |
| `ANTHROPIC_API_KEY` | unset | Enables AI week generation. Without it the rest of the app works and the Build screen says generation is off. |

`ANTHROPIC_API_KEY` is a credential and must not go in the shipped unit, which
is world-readable in `/etc/systemd/system`. Put it in a root-owned drop-in:

```bash
sudo systemctl edit garage-wod-tracker
#   [Service]
#   Environment=ANTHROPIC_API_KEY=sk-ant-...
sudo systemctl restart garage-wod-tracker
```

Generation calls Claude Opus 5 once per week written — a handful of calls a
week, cents rather than pounds. It is a coach-facing feature: athletes never
trigger it, so the spend cannot run away on its own.

## First install

`output: "standalone"` emits a server that runs without `node_modules`, which
is why `/opt` can be mounted read-only. Next does **not** copy the static
assets into that output, so they are copied by hand.

```bash
git clone https://github.com/harknett/garage-wod-tracker.git
cd garage-wod-tracker
npm ci
npm run build

sudo rsync -a --delete .next/standalone/ /opt/garage-wod-tracker/
sudo rsync -a .next/static/ /opt/garage-wod-tracker/.next/static/
sudo chown -R root:root /opt/garage-wod-tracker

sudo cp deploy/garage-wod-tracker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now garage-wod-tracker
```

Forgetting the `.next/static` copy gives a page that loads with no styles and
no interactivity, and logs nothing — the server is fine, the browser is 404ing
on assets. It is the most common bad deploy of this app.

The database is created and migrated on first request. There is no migration
command to run.

## Creating the first account

The first account is the owner, and it is claimed through `/setup` — which only
works while the database holds no accounts **and** `SETUP_TOKEN` is set. A
standing token is an open invitation, so it is a door you open and close:

```bash
sudo systemctl edit garage-wod-tracker
#   [Service]
#   Environment=SETUP_TOKEN=<paste output of: openssl rand -hex 16>
sudo systemctl restart garage-wod-tracker
```

Visit `https://your-host/setup`, create the owner account, then remove the
token and restart. After that the owner adds everyone else from **Athletes**;
each new account gets a one-time password shown once on screen and must choose
its own at first sign-in.

## Reverse proxy and TLS

The service binds loopback and speaks plain HTTP. Session cookies are `Secure`
in production, so the app does not work over plain HTTP from a browser — TLS in
front is required, not optional.

```nginx
server {
    server_name wod.example.com;

    location / {
        proxy_pass http://127.0.0.1:3006;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        # The app throttles sign-ins per address. It trusts this header, so the
        # proxy must overwrite whatever the client sent rather than append.
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Terminate TLS here (certbot, or whatever the host already uses). Response
security headers — CSP, HSTS, nosniff, frame-ancestors — are set by the app in
`next.config.ts`, so the proxy does not need to add them.

## Upgrading

Upgrades are a rebuild and a file swap. The database migrates itself on the
next request, so the ordering is: back up, build, swap, restart.

```bash
cd ~/garage-wod-tracker
git pull

# 1. Back up first. Migrations run automatically and are not reversible.
sudo systemctl stop garage-wod-tracker
sudo cp /var/lib/garage-wod-tracker/training.db ~/training-$(date +%F).db

# 2. Build the new version.
npm ci
npm run build
npm test

# 3. Swap it in. --delete removes files the new version dropped; the database
#    is untouched because it lives in /var/lib, not /opt.
sudo rsync -a --delete .next/standalone/ /opt/garage-wod-tracker/
sudo rsync -a .next/static/ /opt/garage-wod-tracker/.next/static/
sudo chown -R root:root /opt/garage-wod-tracker

# 4. Start, and check it came back.
sudo systemctl start garage-wod-tracker
systemctl status garage-wod-tracker --no-pager
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3006/login
```

Stopping before the copy matters: `rsync --delete` over a running server pulls
chunks out from under it, and the requests in flight fail with
module-not-found errors that look like a build problem rather than a deploy one.

If the shipped unit file changed in the release, copy it again and
`daemon-reload`. Drop-ins under
`/etc/systemd/system/garage-wod-tracker.service.d/` survive that, which is why
the API key and any port override belong there.

### Rolling back

```bash
sudo systemctl stop garage-wod-tracker
git checkout <previous-tag>
npm ci && npm run build
sudo rsync -a --delete .next/standalone/ /opt/garage-wod-tracker/
sudo rsync -a .next/static/ /opt/garage-wod-tracker/.next/static/
sudo cp ~/training-<date>.db /var/lib/garage-wod-tracker/training.db
sudo chown garage-wod-tracker:garage-wod-tracker /var/lib/garage-wod-tracker/training.db
sudo systemctl start garage-wod-tracker
```

Restore the database only if the new version had already migrated it. A schema
from a newer version will not load under older code, and that is the one
failure a rollback cannot talk its way out of.

## Backups and restore

The whole application is one SQLite file. Back it up while the service is
stopped, or use `sqlite3 .backup`, which is safe against a running writer:

```bash
sudo -u garage-wod-tracker sqlite3 /var/lib/garage-wod-tracker/training.db \
  ".backup '/var/backups/training-$(date +%F).db'"
```

A plain `cp` of a running database can catch it mid-write and miss the WAL. The
unit closes SQLite on SIGTERM and checkpoints the WAL, so a copy taken while
the service is stopped is one complete file.

Nightly, via cron:

```cron
15 3 * * * sudo -u garage-wod-tracker sqlite3 /var/lib/garage-wod-tracker/training.db ".backup '/var/backups/training-$(date +\%F).db'" && find /var/backups -name 'training-*.db' -mtime +30 -delete
```

Restoring is a file copy back, with the service stopped and ownership fixed
afterwards.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Page loads unstyled, nothing clickable | `.next/static` was not copied. Re-run that rsync. |
| `EADDRINUSE` on start | Another service holds 3006. See the port table. |
| Sign-in rejects a known-good password | The app is being reached over plain HTTP; the session cookie is `Secure` and never comes back. |
| `/setup` says setup is closed | `SETUP_TOKEN` is unset, or an account already exists. |
| Build screen says generation is off | `ANTHROPIC_API_KEY` is unset. Everything else still works. |
| `SQLITE_CANTOPEN` | `DATA_DIR` is not writable by the service user, or `StateDirectory=` was overridden. |

```bash
systemctl status garage-wod-tracker --no-pager
journalctl -u garage-wod-tracker -n 100 --no-pager
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3006/login
```
