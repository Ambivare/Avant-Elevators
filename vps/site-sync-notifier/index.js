// Wake notifier for Avant Elevators' device-facing background features —
// standalone replacement for the Firebase Cloud Function that used to send
// these pushes (functions/index.js's former onSiteSyncWakeRequested).
// Watches two Firestore collections in real time and sends the matching
// silent, data-only FCM push:
//   - siteSyncWakes/{employeeId}  -> "site_media_sync_wake"  (Site Sync backlog upload)
//   - siteViewWakes/{employeeId}  -> "site_view_wake"        (Site View live browse)
// The device's SiteSyncMessagingService (Android) picks either up and starts
// the matching foreground service — same trigger shape as before, just
// running on the VPS instead of on Firebase's metered Functions runtime.
//
// Run with: pm2 start index.js --name site-sync-notifier
require('dotenv').config()

const path = require('path')
const admin = require('firebase-admin')

const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
if (!SERVICE_ACCOUNT_PATH) {
  console.error('[Wake Notifier] FIREBASE_SERVICE_ACCOUNT_PATH is not set — see .env.example')
  process.exit(1)
}

const serviceAccount = require(path.resolve(SERVICE_ACCOUNT_PATH))

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()
const messaging = admin.messaging()

function log(...args) {
  console.log(new Date().toISOString(), ...args)
}

async function tokenByEmployeeId(employeeId) {
  const snap = await db.collection('fcmTokens').doc(employeeId).get()
  return snap.exists ? (snap.data().token || null) : null
}

async function sendWake(label, wakeType, employeeId) {
  try {
    const token = await tokenByEmployeeId(employeeId)
    if (!token) {
      log(`[${label}] skip — no FCM token on file for employee ${employeeId}`)
      return
    }

    // The native service has no WebView/JS session to read the logged-in
    // employee's name from, so it rides along in the wake payload itself.
    const empSnap = await db.collection('employees').doc(employeeId).get()
    const emp = empSnap.exists ? empSnap.data() : {}

    await messaging.sendEachForMulticast({
      tokens: [token],
      // No `notification` key — this must stay data-only so Android invokes
      // onMessageReceived() in the app's own FirebaseMessagingService even
      // while the app is backgrounded/killed, instead of the OS just
      // showing a tray notification and never waking app code.
      data: {
        type: wakeType,
        employeeId,
        employeeName: emp.fullName || emp.username || '',
      },
      android: { priority: 'high' },
    })
    log(`[${label}] wake sent -> ${emp.fullName || emp.username || employeeId}`)
  } catch (e) {
    console.error(`[${label}] wake failed for ${employeeId}:`, e.message)
  }
}

function watchWakeCollection(collectionName, label, wakeType) {
  log(`[Wake Notifier] watching ${collectionName}/*`)
  return db.collection(collectionName).onSnapshot(
    (snapshot) => {
      for (const change of snapshot.docChanges()) {
        // Mirrors the old onDocumentWritten trigger: fires on both a fresh
        // wake request and a repeat one (re-clicking Wake Up / a folder).
        if (change.type === 'added' || change.type === 'modified') {
          sendWake(label, wakeType, change.doc.id)
        }
      }
    },
    (err) => {
      // A listener error (expired credentials, revoked service account key,
      // network partition) leaves this stream dead — exit so PM2 restarts
      // the whole process and re-establishes fresh listeners, rather than
      // silently running with one or both watches dead.
      console.error(`[Wake Notifier] ${collectionName} listener error, exiting for restart:`, err.message)
      process.exit(1)
    }
  )
}

log('[Wake Notifier] starting')

const unsubscribers = [
  watchWakeCollection('siteSyncWakes', 'Site Sync', 'site_media_sync_wake'),
  watchWakeCollection('siteViewWakes', 'Site View', 'site_view_wake'),
]

log('[Wake Notifier] ready')

function shutdown() {
  log('[Wake Notifier] shutting down')
  unsubscribers.forEach((unsub) => unsub())
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
