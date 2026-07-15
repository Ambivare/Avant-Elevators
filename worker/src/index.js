/**
 * Avant Elevators — Cloudflare Worker
 *
 * Replaces all Firebase Cloud Functions:
 *
 * HTTP endpoints (called from Vue client):
 *   POST /notify       — send FCM push notification after a Firestore write
 *
 * Cron triggers (wrangler.toml [triggers].crons):
 *   Scheduled jobs: AMC expiry, installment reminders, overdue tasks, etc.
 *
 * Required secrets (wrangler secret put <NAME>):
 *   WORKER_SECRET         — shared key Vue app sends in X-API-Key header
 *   SA_EMAIL              — Firebase service account email
 *   SA_PRIVATE_KEY        — Firebase service account private key (PEM, \n as literal \\n)
 *   FIREBASE_PROJECT_ID   — e.g. avant-elevators
 *   MAILER_URL            — https://x4m2x4kscj.execute-api.ap-south-1.amazonaws.com/v1
 *   MAILER_API_KEY        — your mailer API key
 */

import { handleNotify } from './notify.js'
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

    if (url.pathname === '/notify') return handleNotify(request, env)

    return new Response('Not Found', { status: 404 })
  },

  // ── Cron triggers ───────────────────────────────────────────────────────────
  async scheduled(controller, env, ctx) {
    const { cron } = controller
    console.log('[cron] trigger:', cron)

    const run = (fn) => ctx.waitUntil(fn(env).catch(e => console.error('[cron] error:', e.message)))

    // cron strings must match wrangler.toml exactly.
    // Cloudflare's Free plan caps a worker at 5 cron triggers total, so several
    // same-day reminders share one trigger time here.
    if (cron === '0 2 * * *')   {
      run(runServiceScheduleReminder)
      run(runOverdueTasksReminder)
      run(runLeadFollowUpReminder)
      return
    }
    if (cron === '30 2 1 * *')  { run(runMaintenanceReminder); return }
    if (cron === '30 3 * * *')  {
      run(runAmcExpiryReminder)
      run(runAmcInstallmentReminder)
      return
    }
    if (cron === '0 4 * * *')   {
      run(runInvoiceOverdueReminder)
      run(runPunchInReminder)
      return
    }
    if (cron === '30 4 * * *')  { run(runDailyPreventiveAlert); return }

    console.warn('[cron] unrecognised cron expression:', cron)
  },
}
