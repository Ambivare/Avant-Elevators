/**
 * Avant Elevators — Cloudflare Worker
 *
 * Replaces all Firebase Cloud Functions:
 *
 * HTTP endpoints (called from Vue client):
 *   POST /otp/send     — generate & email admin OTP (uses mailer API)
 *   POST /otp/verify   — validate OTP, stored in KV
 *   POST /notify       — send FCM push notification after a Firestore write
 *
 * Cron triggers (wrangler.toml [triggers].crons):
 *   Scheduled jobs: AMC expiry, installment reminders, overdue tasks, etc.
 *
 * Required secrets (wrangler secret put <NAME>):
 *   WORKER_SECRET         — shared key Vue app sends in X-API-Key header
 *   SA_EMAIL              — Firebase service account email
 *   SA_PRIVATE_KEY        — Firebase service account private key (PEM, \n as literal \\n)
 *   FIREBASE_PROJECT_ID   — e.g. avantelevators-dff70
 *   MAILER_URL            — https://x4m2x4kscj.execute-api.ap-south-1.amazonaws.com/v1
 *   MAILER_API_KEY        — your mailer API key
 *   OTP_SENDER_EMAIL      — Zoho (or other) email address for OTP sending
 *   OTP_SENDER_PASSWORD   — Zoho app password
 *   OTP_SMTP_PROVIDER     — "zoho" | "gmail" | "custom"
 *
 * KV namespace:
 *   OTP_KV — bound in wrangler.toml, stores OTPs with 5-min TTL
 */

import { handleSendOtp, handleVerifyOtp } from './otp.js'
import { handleNotify }                   from './notify.js'
import {
  runAmcExpiryReminder,
  runAmcInstallmentReminder,
  runMaintenanceReminder,
  runOverdueTasksReminder,
  runLeadFollowUpReminder,
  runInvoiceOverdueReminder,
  runPunchInReminder,
  runServiceScheduleReminder,
  runDailyPreventiveAlert,
} from './schedule.js'

export default {

  // ── HTTP requests ───────────────────────────────────────────────────────────
  async fetch(request, env, ctx) {
    const url    = new URL(request.url)
    const method = request.method.toUpperCase()

    // CORS pre-flight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin':  '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
        },
      })
    }

    if (method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 })
    }

    // Authenticate every request with the shared Worker secret
    const key = request.headers.get('X-API-Key') || ''
    if (!env.WORKER_SECRET || key !== env.WORKER_SECRET) {
      return new Response('Unauthorized', { status: 401 })
    }

    if (url.pathname === '/otp/send')   return handleSendOtp(request, env)
    if (url.pathname === '/otp/verify') return handleVerifyOtp(request, env)
    if (url.pathname === '/notify')     return handleNotify(request, env)

    return new Response('Not Found', { status: 404 })
  },

  // ── Cron triggers ───────────────────────────────────────────────────────────
  async scheduled(controller, env, ctx) {
    const { cron } = controller
    console.log('[cron] trigger:', cron)

    const run = (fn) => ctx.waitUntil(fn(env).catch(e => console.error('[cron] error:', e.message)))

    // cron strings must match wrangler.toml exactly
    if (cron === '0 2 * * *')   { run(runServiceScheduleReminder); return }
    if (cron === '30 2 * * *')  { run(runOverdueTasksReminder);    return }
    if (cron === '30 2 1 * *')  { run(runMaintenanceReminder);     return }
    if (cron === '0 3 * * *')   { run(runLeadFollowUpReminder);    return }
    if (cron === '30 3 * * *')  { run(runAmcExpiryReminder);       return }
    if (cron === '35 3 * * *')  { run(runAmcInstallmentReminder);  return }
    if (cron === '0 4 * * *')   {
      // Two jobs share the same cron slot
      run(runInvoiceOverdueReminder)
      run(runPunchInReminder)
      return
    }
    if (cron === '30 4 * * *')  { run(runDailyPreventiveAlert); return }

    console.warn('[cron] unrecognised cron expression:', cron)
  },
}
