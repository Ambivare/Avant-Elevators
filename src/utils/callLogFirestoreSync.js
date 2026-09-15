// Pushes device call-log entries (native, Android-only — see callLogSync.js)
// straight to Firestore's callLogs collection. Triggered from two places:
//   1. src/stores/auth.js — right after login/session-restore.
//   2. src/views/attendance/AttendanceView.vue — right after punch-out,
//      instead of a scheduled Cloud Function (Firestore doc writes are
//      cheap and this guarantees the day's calls land the moment the
//      employee's shift ends, with no extra infrastructure).
// Both call the same incremental sync below, watermarked per employee in
// localStorage, so calling it twice in a row is always safe/cheap.
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { Collections } from '@/firebase/collections'
import { isNative, getCallsSince, requestCallLogPermission, requestContactsPermission } from './callLogSync'

const LAST_SYNC_KEY_PREFIX = 'avant_call_log_last_sync_'
const DEFAULT_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000 // first-ever sync: last 30 days
const BATCH_SIZE = 400 // stay under Firestore's 500-write batch limit

function getLastSyncAt(employeeId) {
  try {
    const v = localStorage.getItem(LAST_SYNC_KEY_PREFIX + employeeId)
    return v ? Number(v) : null
  } catch { return null }
}

function setLastSyncAt(employeeId, epochMs) {
  try { localStorage.setItem(LAST_SYNC_KEY_PREFIX + employeeId, String(epochMs)) } catch { /* private mode etc. — non-fatal */ }
}

// deviceCallId (e.g. "device:123") is only unique within one device's own
// call-log provider — scoping it to the employee makes it a safe, stable
// Firestore doc id so re-syncing never creates duplicates.
function docIdFor(employeeId, deviceCallId) {
  return `${employeeId}_${String(deviceCallId).replace(/[^a-zA-Z0-9:_-]/g, '')}`
}

/**
 * Incrementally syncs this employee's device call log to Firestore.
 * No-ops silently on web, on missing args, or on permission denial —
 * this is a background enhancement, never something that should surface
 * an error to the user mid-login or mid-punch-out.
 */
export async function syncCallLogs(employeeId, employeeName) {
  if (!isNative() || !employeeId) return
  try {
    const granted = await requestCallLogPermission()
    if (!granted) return
    try { await requestContactsPermission() } catch { /* optional — denial just means bare numbers */ }

    const since = getLastSyncAt(employeeId) ?? (Date.now() - DEFAULT_LOOKBACK_MS)
    const { calls, permissionDenied } = await getCallsSince(since)
    if (permissionDenied) return
    if (!calls.length) { setLastSyncAt(employeeId, Date.now()); return }

    for (let i = 0; i < calls.length; i += BATCH_SIZE) {
      const batch = writeBatch(db)
      for (const c of calls.slice(i, i + BATCH_SIZE)) {
        const ref = doc(db, Collections.CALL_LOGS, docIdFor(employeeId, c.deviceCallId))
        batch.set(ref, {
          employeeId,
          employeeName: employeeName || null,
          phoneNumber: c.number || null,
          contactName: c.savedName || null,
          type: c.type || 'other',
          callTime: new Date(c.date),
          duration: c.duration || 0,
          deviceCallId: c.deviceCallId,
          syncedAt: serverTimestamp(),
        }, { merge: true })
      }
      await batch.commit()
    }
    setLastSyncAt(employeeId, Date.now())
  } catch (e) {
    console.warn('[Call Logs] Sync failed (will retry next trigger):', e?.message || e)
  }
}
