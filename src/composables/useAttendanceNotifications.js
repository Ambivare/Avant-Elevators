/**
 * Schedules daily local notifications for attendance reminders:
 *   - 09:00 AM  — Punch In reminder
 *   - 18:00 PM  — Punch Out reminder
 *
 * Uses @capacitor/local-notifications (no FCM, works offline).
 * Safe to call multiple times: cancels previous schedules before re-scheduling.
 * Only active on the native Android build; silently skips on web.
 */

import { Capacitor } from '@capacitor/core'

const PUNCH_IN_ID  = 9001
const PUNCH_OUT_ID = 9002

function isNative() {
  return Capacitor.isNativePlatform()
}

/**
 * Returns the next Date for a given hour/minute (today if still in the future,
 * tomorrow otherwise) — always ≥ 60 s from now so scheduling never fires immediately.
 */
function nextOccurrence(hour, minute) {
  const now   = new Date()
  const target = new Date()
  target.setHours(hour, minute, 0, 0)
  if (target.getTime() - now.getTime() < 60_000) {
    target.setDate(target.getDate() + 1)
  }
  return target
}

export async function scheduleAttendanceNotifications() {
  if (!isNative()) return

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')

    // Request permission first (Android 13+)
    const perm = await LocalNotifications.requestPermissions()
    if (perm.display !== 'granted') {
      console.warn('[AttendanceNotif] Permission not granted — skipping schedule')
      return
    }

    // Cancel any previously scheduled attendance reminders to avoid duplicates
    await LocalNotifications.cancel({ notifications: [
      { id: PUNCH_IN_ID },
      { id: PUNCH_OUT_ID },
    ] }).catch(() => {})

    const punchInAt  = nextOccurrence(9, 0)   // 09:00 AM
    const punchOutAt = nextOccurrence(18, 0)   // 06:00 PM

    await LocalNotifications.schedule({
      notifications: [
        {
          id:         PUNCH_IN_ID,
          title:      'Punch In Reminder',
          body:       "Don't forget to mark your attendance for today!",
          channelId:  'avant_attendance',
          smallIcon:  'ic_stat_notification',
          iconColor:  '#dc2626',
          sound:      'default',
          schedule: {
            at:       punchInAt,
            repeats:  true,
            every:    'day',
          },
          extra: { type: 'punch_in_reminder' },
        },
        {
          id:         PUNCH_OUT_ID,
          title:      'Punch Out Reminder',
          body:       'Time to punch out — end your work day.',
          channelId:  'avant_attendance',
          smallIcon:  'ic_stat_notification',
          iconColor:  '#dc2626',
          sound:      'default',
          schedule: {
            at:       punchOutAt,
            repeats:  true,
            every:    'day',
          },
          extra: { type: 'attendance_checkout' },
        },
      ],
    })

    console.log('[AttendanceNotif] Scheduled: punch-in at 09:00, punch-out at 18:00 (daily)')
  } catch (e) {
    console.warn('[AttendanceNotif] Schedule failed:', e)
  }
}

export async function cancelAttendanceNotifications() {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [
      { id: PUNCH_IN_ID },
      { id: PUNCH_OUT_ID },
    ] })
  } catch { /* ignore */ }
}
