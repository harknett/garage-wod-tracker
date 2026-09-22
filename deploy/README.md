# Deploying Garage WOD Tracker

One Node process behind a reverse proxy, run by systemd as its own user.

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
| _reserved_ | 3004-3005 |
| garage-wod-tracker | 3006 |

3004 and 3005 are held for `headache_diary` and `the_eights`, which have no
unit yet. Change a port with a drop-in rather than by editing the shipped unit:

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
| `/var/lib/garage-wod-tracker` | Created by `StateDirectory=` at 0700 on first start. |

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin garage-wod-tracker
```

## Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | 3000 | The unit sets 3006 — see the port table. |
| `HOSTNAME` | all interfaces | The unit sets 127.0.0.1. The standalone server honours this; `next start` does not. |
| `DATA_DIR` | `./data` | The unit points this at `/var/lib/garage-wod-tracker`. |

## Build and install

`output: "standalone"` emits a server that runs without `node_modules`, which
is why `/opt` can be mounted read-only. The static assets are not copied into
it by Next, so they are copied by hand:

```bash
npm ci
npm run build

sudo rsync -a --delete .next/standalone/ /opt/garage-wod-tracker/
sudo rsync -a .next/static/ /opt/garage-wod-tracker/.next/static/
sudo rsync -a public/ /opt/garage-wod-tracker/public/   # if present
sudo chown -R root:root /opt/garage-wod-tracker

sudo cp deploy/garage-wod-tracker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now garage-wod-tracker
```

Forgetting the `.next/static` copy gives a page that loads with no styles and
no interactivity, and logs nothing — the server is fine, the browser is
404ing on assets.

## Smoke test

```bash
systemctl status garage-wod-tracker --no-pager
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3006/
journalctl -u garage-wod-tracker -n 50 --no-pager
```

## Reverse proxy

```nginx
location / {
    proxy_pass http://127.0.0.1:3006;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```
