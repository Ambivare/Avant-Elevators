# Site Sync Notifier

Standalone Node service that replaces the Firebase Cloud Function
`onSiteSyncWakeRequested`. It watches `siteSyncWakes/{employeeId}` in
Firestore in real time and sends the silent FCM push that wakes a
company device's native background photo sync (see the main app's
`SiteSyncMessagingService.java`). Everything else in this project's
notification system (tasks, leads, complaints, AMC, attendance, etc.)
is unaffected — that all still runs on Firebase Functions as before.

## 1. Get a Firebase service account key

1. Firebase Console → the **avant-elevators** project → gear icon →
   **Project settings** → **Service accounts** tab.
2. Click **Generate new private key** → confirm. A JSON file downloads.
3. This file is a full admin credential for the Firebase project — treat
   it like a root password. Never commit it to git.

## 2. Upload it to the VPS

```bash
scp service-account.json youruser@your-vps-ip:/opt/site-sync-notifier/service-account.json
```

(Create the directory first if it doesn't exist: `mkdir -p /opt/site-sync-notifier`.)

## 3. Deploy the service

```bash
# On the VPS
cd /opt/site-sync-notifier
# Copy this vps/site-sync-notifier/ folder's contents here (git clone,
# scp, or however you move code to this VPS today), then:

npm install --production

cp .env.example .env
# Edit .env if the service account file isn't named/located exactly as
# the example assumes:
#   FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json
```

## 4. Run it with PM2

```bash
npm install -g pm2   # skip if already installed on this VPS

pm2 start index.js --name site-sync-notifier
pm2 save             # persists the process list
pm2 startup          # prints (and can auto-run) the command to restart
                      # PM2's saved processes on VPS reboot
```

Useful commands afterward:

```bash
pm2 logs site-sync-notifier     # tail logs
pm2 restart site-sync-notifier  # after pulling code changes
pm2 stop site-sync-notifier
pm2 status                      # confirm it's "online"
```

## Verifying it works

1. `pm2 logs site-sync-notifier` should show:
   ```
   [Site Sync Notifier] starting — watching siteSyncWakes/*
   [Site Sync Notifier] ready
   ```
2. In the Avant Elevators app, toggle "Site Media Sync" on for an
   employee (HR form) or press "Wake Up & Sync" on their card
   (Configurations → Site Sync). The log should immediately show:
   ```
   [wake sent] <employee name>
   ```
3. If you see `no FCM token on file for employee ...`, that employee's
   device hasn't logged in / registered a push token yet — not a bug in
   this service.

## Updating

Pull new code, then:

```bash
npm install --production   # only if package.json changed
pm2 restart site-sync-notifier
```
