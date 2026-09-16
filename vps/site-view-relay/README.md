# Site View Relay

A WebSocket relay that pairs one company device with an admin's
Configurations → Site View tab, so the admin can browse and download the
device's photo/video folders **live** — nothing is uploaded or stored on
the VPS. The device only connects when woken (via `vps/site-sync-notifier`,
which now also watches `siteViewWakes/{employeeId}`), and disconnects on
its own after 5 minutes of no admin activity.

How it fits together:

```
Admin clicks a folder card (Configurations → Site View)
  -> writes siteViewWakes/{employeeId} in Firestore
  -> site-sync-notifier sees it, sends a silent FCM push
  -> the phone's SiteSyncMessagingService starts SiteViewSocketService
  -> that service opens a WebSocket to this relay and registers
  -> the admin's browser (already connected to this relay) gets notified
     the device is online, and starts sending list-folders / list-media /
     get-thumbnail / get-file commands, relayed straight through to the
     phone and back — nothing touches disk on the VPS.
```

## 1. Generate the two shared secrets

The device and the admin browser each present a secret when they connect,
so a stranger who finds this port can't register as a fake device or
eavesdrop as a fake admin.

```bash
openssl rand -hex 32   # run twice — one for DEVICE_SECRET, one for ADMIN_SECRET
```

## 2. Configure and deploy the relay

```bash
# On the VPS
mkdir -p /opt/site-view-relay
cd /opt/site-view-relay
# Copy this vps/site-view-relay/ folder's contents here, then:

npm install --production
cp .env.example .env
# Edit .env: set PORT (default 8082), DEVICE_SECRET, ADMIN_SECRET to the
# values you generated above.
```

## 3. Run it with PM2

```bash
npm install -g pm2   # skip if already installed

pm2 start index.js --name site-view-relay
pm2 save
pm2 startup           # persists across VPS reboots (prints/runs the needed command)
```

```bash
pm2 logs site-view-relay
pm2 restart site-view-relay
```

## 4. Put TLS in front of it (required — browsers block ws:// from an https:// page)

Pick a hostname (e.g. `site-view.ambivare.com`) and point its DNS A record
at this VPS. Then reverse-proxy WebSocket upgrades to the relay's port.

**Caddy** (`Caddyfile`):

```
site-view.ambivare.com {
    reverse_proxy localhost:8082
}
```

Caddy handles the WebSocket upgrade and TLS certificate automatically.

**nginx**, if that's what fronts this VPS instead:

```nginx
server {
    listen 443 ssl;
    server_name site-view.ambivare.com;

    ssl_certificate     /etc/letsencrypt/live/site-view.ambivare.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/site-view.ambivare.com/privkey.pem;

    location / {
        proxy_pass http://localhost:8082;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;   # keep long-lived sockets alive
    }
}
```

## 5. Wire the real hostname + secrets into the app

Three constants are placeholders until you've done steps 1 and 4 — update
all three to match, then rebuild the APK and redeploy the web dashboard:

| File | Constant |
|---|---|
| `android/app/src/main/java/com/avantelevators/app/SiteViewSocketService.java` | `RELAY_WS_URL`, `DEVICE_SECRET` |
| `src/composables/useSiteViewRelay.js` | `RELAY_WS_URL`, `ADMIN_SECRET` |

`RELAY_WS_URL` in both must be `wss://<your-hostname>/` (e.g.
`wss://site-view.ambivare.com/`). `DEVICE_SECRET`/`ADMIN_SECRET` must match
what you put in this service's `.env`.

## Verifying it works

1. `pm2 logs site-view-relay` should show the listening line with no errors.
2. In Configurations → Site Sync, confirm `pm2 logs site-sync-notifier`
   is also running (it dispatches the wake for both features).
3. In Configurations → Site View, click an employee card. The employee
   badge should go from "Waking device…" to "Connected" within a few
   seconds (as long as their phone has signal), then folders should load.
4. Click a folder, thumbnails should populate, and Download should save
   the original file through the browser.

## Updating

```bash
npm install --production   # only if package.json changed
pm2 restart site-view-relay
```
