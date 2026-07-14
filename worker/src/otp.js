/**
 * Admin OTP — send and verify.
 *
 * OTP storage: Cloudflare KV (env.OTP_KV) with 5-minute TTL.
 * SMTP config: read from Firestore `configurations` collection — same config
 *              the admin already saved in the Configurations tab. No duplicate secrets.
 * Email delivery: existing mailer API (env.MAILER_URL / env.MAILER_API_KEY).
 */

import { getAccessToken }       from './auth.js'
import { queryWhere, docToObj } from './firestore.js'

export async function handleSendOtp(request, env) {
  const { userId, email } = await request.json().catch(() => ({}))
  if (!userId) return jsonErr('userId required', 400)
  if (!email)  return jsonErr('No email address on this admin account. Add one in HR settings.', 400)

  // Read SMTP credentials from Firestore Configurations (already saved by admin)
  let emailConfig
  try {
    const token  = await getAccessToken(env)
    const docs   = await queryWhere(token, env.FIREBASE_PROJECT_ID, 'configurations', null, 1)
    emailConfig  = docs[0]?.email || null
  } catch (e) {
    return jsonErr(`Could not read email config from Firestore: ${e.message}`, 502)
  }

  if (!emailConfig?.smtpUser || !emailConfig?.smtpPass) {
    return jsonErr('Email not configured. Go to Configurations tab → Email Settings and save your SMTP credentials.', 500)
  }

  const otp = String(Math.floor(100_000 + Math.random() * 900_000))

  await env.OTP_KV.put(
    `otp:${userId}`,
    JSON.stringify({ otp, email, used: false }),
    { expirationTtl: 300 },
  )

  const fromEmail = emailConfig.fromEmail || emailConfig.smtpUser
  const fromName  = emailConfig.fromName  || 'Avant Elevators'
  const from      = `"${fromName}" <${fromEmail}>`

  const htmlBody = `
<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8fafc;border-radius:12px;">
  <h2 style="color:#1e1b33;margin:0 0 8px;">Admin Login OTP</h2>
  <p style="color:#64748b;margin:0 0 24px;">
    Use the code below to complete your Avant admin login.
    Valid for <strong>5 minutes</strong>.
  </p>
  <div style="background:#1e1b33;border-radius:12px;padding:24px;text-align:center;
              letter-spacing:12px;font-size:36px;font-weight:700;color:#a5b4fc;">
    ${otp}
  </div>
  <p style="color:#94a3b8;font-size:12px;margin-top:20px;">
    Do not share this OTP. If you did not attempt login, contact your administrator immediately.
  </p>
</div>`

  const mailerRes = await fetch(`${env.MAILER_URL}/send`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': env.MAILER_API_KEY },
    body:    JSON.stringify({
      credentials: { email: emailConfig.smtpUser, password: emailConfig.smtpPass },
      provider:    emailConfig.smtpProvider || 'custom',
      mail:        { from, to: email, subject: `${otp} — Your Avant Admin OTP`, html: htmlBody },
    }),
  })

  if (!mailerRes.ok) {
    const err = await mailerRes.text().catch(() => String(mailerRes.status))
    return jsonErr(`Email send failed: ${err}`, 502)
  }

  return json({ sent: true, emailSent: true, smsSent: false, maskedEmail: maskEmail(email), maskedPhone: '' })
}

export async function handleVerifyOtp(request, env) {
  const { userId, otp } = await request.json().catch(() => ({}))
  if (!userId || !otp) return json({ valid: false, reason: 'Missing fields.' })

  const raw = await env.OTP_KV.get(`otp:${userId}`)
  if (!raw) return json({ valid: false, reason: 'No OTP found. Please request a new one.' })

  const record = JSON.parse(raw)
  if (record.used) return json({ valid: false, reason: 'OTP already used.' })
  if (record.otp !== String(otp).trim()) return json({ valid: false, reason: 'Incorrect OTP.' })

  await env.OTP_KV.put(`otp:${userId}`, JSON.stringify({ ...record, used: true }), { expirationTtl: 60 })
  return json({ valid: true })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskEmail(email) {
  if (!email?.includes('@')) return '***'
  const [local, domain] = email.split('@')
  return local.slice(0, 2) + '***@' + domain
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

function jsonErr(msg, status) {
  return json({ error: msg }, status)
}
