// Site Sync's "wake" notifier — standalone replacement for the Firebase
// Cloud Function (functions/index.js's former onSiteSyncWakeRequested).
// Watches siteSyncWakes/{employeeId} in Firestore in real time and sends a
// silent, data-only FCM push to that employee's device, which the native
// SiteSyncMessagingService (Android) picks up to start the background photo
// upload — same trigger, same payload shape, just running on the VPS
// instead of on Firebase's metered Functions runtime.
//
// Run with: pm2 start index.js --name site-sync-notifier
require('dotenv').config()

const path = require('path')
const admin = require('firebase-admin')

const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
if (!SERVICE_ACCOUNT_PATH) {
  console.error('[Site Sync Notifier] FIREBASE_SERVICE_ACCOUNT_PATH is not set — see .env.example')
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

async function handleWake(employeeId) {
  try {
    const token = await tokenByEmployeeId(employeeId)
    if (!token) {
      log(`[skip] no FCM token on file for employee ${employeeId}`)
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
        type: 'site_media_sync_wake',
        employeeId,
        employeeName: emp.fullName || emp.username || '',
      },
      android: { priority: 'high' },
    })
    log(`[wake sent] ${emp.fullName || emp.username || employeeId}`)
  } catch (e) {
    console.error(`[Site Sync Notifier] wake failed for ${employeeId}:`, e.message)
  }
}

log('[Site Sync Notifier] starting — watching siteSyncWakes/*')

const unsubscribe = db.collection('siteSyncWakes').onSnapshot(
  (snapshot) => {
    for (const change of snapshot.docChanges()) {
      // Mirrors the old onDocumentWritten trigger: fires on both a fresh
      // wake request and a repeat one (re-pressing "Wake Up & Sync").
      if (change.type === 'added' || change.type === 'modified') {
        handleWake(change.doc.id)
      }
    }
  },
  (err) => {
    // A listener error (expired credentials, revoked service account key,
    // network partition) leaves this stream dead — exit so PM2 restarts the
    // whole process and re-establishes a fresh listener, rather than
    // silently running with no active watch.
    console.error('[Site Sync Notifier] Firestore listener error, exiting for restart:', err.message)
    process.exit(1)
  }
)

log('[Site Sync Notifier] ready')

function shutdown() {
  log('[Site Sync Notifier] shutting down')
  unsubscribe()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
