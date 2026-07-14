/**
 * Cloudflare Worker API client — replaces Firebase callable functions.
 *
 * Set VITE_WORKER_URL in your .env:
 *   VITE_WORKER_URL=https://avant-elevators.your-account.workers.dev
 *
 * VITE_WORKER_SECRET must match the WORKER_SECRET set via `wrangler secret put`.
 */

const WORKER_URL    = import.meta.env.VITE_WORKER_URL    || ''
const WORKER_SECRET = import.meta.env.VITE_WORKER_SECRET || ''

async function workerPost(path, body) {
  if (!WORKER_URL) throw new Error('VITE_WORKER_URL not configured.')
  const res = await fetch(`${WORKER_URL}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': WORKER_SECRET },
    body:    JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok && !data) throw new Error(`Worker error: HTTP ${res.status}`)
  return { data }
}

/** Send admin OTP email via Worker → mailer API. */
export function sendAdminOtpFn(payload) {
  return workerPost('/otp/send', payload)
}

/** Verify admin OTP via Worker → KV lookup. */
export function verifyAdminOtpFn(payload) {
  return workerPost('/otp/verify', payload)
}
