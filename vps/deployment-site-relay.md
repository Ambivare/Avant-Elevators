# Deploying Site Sync / Site View to a VPS — From Scratch

This documents exactly how `vps/site-sync-notifier` and `vps/site-view-relay`
were deployed on the current VPS, including every mistake made along the way
and how each was actually fixed. If the VPS changes (migrated, rebuilt,
reimaged), follow this top to bottom on the new box.

**The one rule that matters most:** this VPS already runs other live sites
behind **nginx** (not Caddy). Every step below is written to add to that
setup without ever risking those other sites. Do not install Caddy here —
see "Why not Caddy" below; it cost us a production outage the first time.

---

## 0. Before you touch anything

Find out what's already running so you don't collide with it.

```bash
sudo ss -tlnp | grep -E ':80 |:443 '
```

On this VPS, that showed `nginx` (3 worker processes) already bound to both
ports, serving other real sites (an ERP API, mail, a VPS management panel).
**Whatever this prints on the new VPS is what you build around** — if it's
nginx, follow this doc as written. If it's something else (Apache, Caddy
already in place), the reverse-proxy section needs adapting; don't just
install a second web server on top of one that's already there.

### Why not Caddy

The first attempt at this deployment tried installing Caddy for its
automatic-HTTPS convenience. Caddy needs ports 80/443 to issue and serve
certificates. nginx was already holding both. Caddy failed to start
(`bind: address already in use`), and — worse — a botched follow-up attempt
to free the ports by stopping nginx, then bringing it back up with a broken
config, took down **every other site on the VPS** for several minutes.
**Lesson: never run `systemctl stop nginx` on a shared VPS to "make room" for
something else.** Everything below adds a new site to the nginx that's
already running instead.

---

## 1. Install Node.js and PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

---

## 2. Clone only the `vps/` folder

The main repo also contains the full Android app and web dashboard — you
don't need any of that on the VPS. Use a partial + sparse checkout so only
`vps/` ever touches disk.

```bash
cd /opt
git clone --filter=blob:none --no-checkout https://<YOUR_GITHUB_TOKEN>@github.com/Ambivare/Avant-Elevators.git avant-vps
cd avant-vps
git sparse-checkout init --cone
git sparse-checkout set vps
git checkout main   # or the working branch, if main doesn't have it yet
history -c          # clears the token out of shell history
```

You'll end up with `avant-vps/vps/site-sync-notifier/` and
`avant-vps/vps/site-view-relay/`.

---

## 3. Get the Firebase credential — read this carefully

`site-sync-notifier` needs a **Service Account key**, not
`google-services.json` (the Android app's own client config). These are two
completely different files from two different places in Firebase Console,
and mixing them up is an easy, silent mistake — it produced this exact crash
the first time:

```
FirebaseAppError: Service account object must contain a string "project_id" property.
```

The wrong file (`google-services.json`) has a `project_info.project_id`
nested field and no `private_key`. The **correct** file starts with
`"type": "service_account"` and contains an actual
`-----BEGIN PRIVATE KEY-----` block, with `project_id` at the top level.

Get the right one:

1. Firebase Console → the project → gear icon → **Project settings**
2. **Service Accounts** tab (not "General")
3. **Generate new private key** → confirm → a JSON file downloads

Upload it to the VPS (don't paste it through a mobile terminal's text
editor — that's how it gets corrupted):

```bash
scp service-account.json youruser@your-vps-ip:/opt/avant-vps/vps/site-sync-notifier/service-account.json
```

Verify it's actually the right shape before moving on:

```bash
cd /opt/avant-vps/vps/site-sync-notifier
python3 -c "import json; d=json.load(open('service-account.json')); print(d.get('type'), d.get('project_id'))"
```

Should print `service_account <your-project-id>`. If it prints something
else or errors, you have the wrong file — go back to step 3.

---

## 4. Deploy `site-sync-notifier`

```bash
cd /opt/avant-vps/vps/site-sync-notifier
npm install --production
cp .env.example .env
```

`.env` only needs one line, and the default already matches what you just
uploaded:

```
FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json
```

```bash
pm2 start index.js --name site-sync-notifier
pm2 logs site-sync-notifier --lines 20 --nostream
```

You want to see, with nothing red underneath:

```
[Wake Notifier] starting
[Wake Notifier] watching siteSyncWakes/*
[Wake Notifier] watching siteViewWakes/*
[Wake Notifier] ready
```

This service makes **outbound-only** connections (to Firestore and FCM) — it
needs no port opened, no firewall rule, no reverse proxy entry.

---

## 5. Deploy `site-view-relay`

Generate two secrets (device auth and admin auth — keep them out of any
committed file, only in this `.env`):

```bash
openssl rand -hex 32   # -> DEVICE_SECRET
openssl rand -hex 32   # -> ADMIN_SECRET
```

```bash
cd /opt/avant-vps/vps/site-view-relay
npm install --production
cp .env.example .env
```

Edit `.env`:

```
PORT=8082
DEVICE_SECRET=<paste the first secret>
ADMIN_SECRET=<paste the second secret>
```

**`PORT` here must match the `proxy_pass` port used in the nginx config in
step 7.** A mismatch here was the cause of one real outage-adjacent bug
during this deployment — the relay was happily running on 8443 while nginx
was configured to talk to 8082, producing a silent `502 Bad Gateway` with
nothing obviously wrong in either place. Match the two ports explicitly.

The relay binds to `127.0.0.1` only (hardcoded in `index.js`) — nginx is the
only thing that can ever reach it directly, even if the firewall were
misconfigured to expose the port.

```bash
pm2 start index.js --name site-view-relay
pm2 logs site-view-relay --lines 20 --nostream
```

You want just the listening line, nothing repeating below it:

```
[Site View Relay] listening on ws://localhost:8082 (put a TLS reverse proxy in front for wss://)
```

If you see a wall of repeating `EADDRINUSE` errors instead, something (often
a stray, non-PM2-managed process from an earlier manual `node index.js` run)
is already on that port — see Troubleshooting below.

---

## 6. Make both survive a reboot

```bash
pm2 save
pm2 startup
# pm2 prints one more command starting with "sudo env..." — copy-paste and
# run exactly that
```

---

## 7. Expose the relay through the existing nginx — without touching other sites

**Do this in two separate steps, in this order.** Doing it in one step (a
site file with SSL config pointing at a certificate that doesn't exist yet)
is the exact chicken-and-egg failure we hit — nginx refuses to reload
because it can't load a cert file that isn't there yet, and since nginx
won't start at all with *any* broken site enabled, it took every other site
on the VPS down with it.

### 7a. Create a plain HTTP-only site first (no SSL lines at all)

Pick the subdomain you're pointing at this relay (e.g.
`site-view.ambivare.com`) and make sure its DNS A record already points at
this VPS's IP before continuing:

```bash
dig +short site-view.ambivare.com   # must print this VPS's IP
```

```bash
sudo tee /etc/nginx/sites-available/site-view.ambivare.com > /dev/null <<'EOF'
server {
    listen 80;
    server_name site-view.ambivare.com;

    location / {
        proxy_pass http://localhost:8082;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/site-view.ambivare.com /etc/nginx/sites-enabled/
sudo nginx -t
```

**Only reload if `nginx -t` says "syntax is ok" / "test is successful."**
This step is safe on its own — it's plain HTTP, nothing references a
certificate yet, so it cannot break anything else even if this specific
site is wrong.

```bash
sudo systemctl reload nginx
```

### 7b. Let certbot add SSL to that already-working site

```bash
sudo apt install -y certbot python3-certbot-nginx   # skip if already installed
sudo certbot --nginx -d site-view.ambivare.com
```

Because nginx is already correctly serving this domain on port 80, certbot
can complete the HTTP-01 challenge and will edit the file itself — adding
`ssl_certificate`/`ssl_certificate_key` lines and an HTTP→HTTPS redirect —
then reload nginx on its own. This is the path that never fails with a
missing-certificate chicken-and-egg error, because the certificate exists
*before* nginx is ever asked to reference it.

### 7c. Confirm the WebSocket headers survived certbot's edit

certbot only adds SSL directives; it shouldn't touch the `location` block,
but confirm:

```bash
sudo cat /etc/nginx/sites-available/site-view.ambivare.com
```

The `location /` block must still have:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

If they're missing for any reason, add them back, then:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

**Never use `sudo certbot certonly --standalone`** for this — it needs to
bind port 80 itself, meaning nginx must be stopped first, which is exactly
the risky move step 0 warns against. The `--nginx` plugin above never
requires stopping nginx.

---

## 8. Verify end-to-end

```bash
pm2 status
```

Both `site-sync-notifier` and `site-view-relay` should show `online`.

```bash
curl -vI https://site-view.ambivare.com 2>&1 | grep -i "subject:\|HTTP/"
```

- `subject: CN=site-view.ambivare.com` confirms the certificate is correct.
- `426 Upgrade Required` (not `502 Bad Gateway`) is the **correct** response
  here — this endpoint only speaks WebSocket, so a plain HTTP request being
  rejected this way means nginx → TLS → relay are all connected properly.
  `502` means nginx can't reach the relay at all (check the port match from
  step 5, and `pm2 status`).

From the app itself: Configurations → Site Sync / Site View, wake a device,
confirm the card goes from "Waking device…" to "Connected" and — for Site
Sync — `pm2 logs site-sync-notifier` shows a `wake sent ->` line the moment
you click.

---

## 9. Updating after a code change

```bash
cd /opt/avant-vps
git pull

cd vps/site-sync-notifier && npm install --production && pm2 restart site-sync-notifier
cd ../site-view-relay && npm install --production && pm2 restart site-view-relay
```

(`npm install` only actually changes anything if `package.json` changed —
safe to run every time regardless.)

---

## Troubleshooting — real failures hit during this deployment

**`nginx.service failed to start` right after adding a new site**
`sudo nginx -t` will name the exact file/line. If it's a new site's
`ssl_certificate` line pointing at a file that doesn't exist, that site
broke nginx *for everyone* — remove it from `sites-enabled` immediately to
restore the other sites, then redo it via the safe two-step method in
section 7.

```bash
sudo rm /etc/nginx/sites-enabled/<the-broken-one>
sudo nginx -t && sudo systemctl start nginx
```

**PM2 shows a process as `errored` with 0% CPU / 0b memory**
It crash-looped past PM2's restart limit and gave up — it is **not**
running, and won't self-heal. Delete and start fresh after fixing the
underlying cause:

```bash
pm2 delete site-view-relay
cd /opt/avant-vps/vps/site-view-relay && pm2 start index.js --name site-view-relay
```

**`EADDRINUSE` in the relay's logs**
Something else already owns that port. Check for a stray process not
managed by PM2 (common cause: an earlier manual `node index.js` run that
was never killed):

```bash
sudo ss -tlnp | grep <port>
sudo kill <pid>
```

**`FirebaseAppError: Service account object must contain a string "project_id" property`**
Wrong file uploaded — see section 3. This is `google-services.json`, not a
Service Account key.

**`502 Bad Gateway` from nginx, but the relay's own logs look fine**
Port mismatch between the relay's `.env` `PORT` and nginx's `proxy_pass`
target. They must be identical.

**Editing files over a mobile SSH terminal app produces garbled text /
`nano`'s screen looks broken**
Mobile terminal apps often don't correctly render `nano`'s box-drawing
escape sequences, and stray keystrokes can trigger `nano` commands (like
Justify, which silently collapses multi-line text into one line). Skip
interactive editors entirely for this kind of work — write files with a
heredoc instead, which is immune to this:

```bash
sudo tee /path/to/file > /dev/null <<'EOF'
...file contents...
EOF
```

**Stuck inside a pager (`less`) after running `journalctl` or similar, with
"HELP -- Press RETURN for more" on screen**
Press `q` (possibly twice). Avoid it going forward by adding `--no-pager`
to `journalctl` calls.
