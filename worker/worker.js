/**
 * Avant Elevators — Cloudflare Worker (single-file bundle for dashboard upload)
 *
 * Paste this entire file into the Cloudflare Workers editor.
 *
 * Required Environment Variables (Dashboard → Worker → Settings → Variables):
 *   WORKER_SECRET       — any random string (same value in VITE_WORKER_SECRET in .env)
 *   SA_EMAIL            — Firebase service account email
 *   SA_PRIVATE_KEY      — Firebase service account private_key (keep the \n chars)
 *   FIREBASE_PROJECT_ID — avantelevators-dff70
 *   MAILER_URL          — https://x4m2x4kscj.execute-api.ap-south-1.amazonaws.com/v1
 *   MAILER_API_KEY      — Ambivare@9822091922
 *
 * SMTP credentials for OTP are read from Firestore `configurations` automatically.
 *
 * KV Namespace binding:
 *   Binding name: OTP_KV  (create a new KV namespace, bind it with this name)
 *
 * Cron triggers (add in Worker → Triggers → Cron Triggers):
 *   0 2 * * *    — service schedule reminder (8:00 AM IST)
 *   30 2 * * *   — overdue tasks (8:00 AM IST)
 *   30 2 1 * *   — monthly maintenance (8:00 AM IST, 1st of month)
 *   0 3 * * *    — lead follow-up (8:30 AM IST)
 *   30 3 * * *   — AMC expiry (9:00 AM IST)
 *   35 3 * * *   — AMC installment (9:05 AM IST)
 *   0 4 * * *    — invoice overdue + punch-in reminder (9:30 AM IST)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH — Service account JWT → OAuth2 access token
// ═══════════════════════════════════════════════════════════════════════════════

let _cachedToken = null
let _cacheExpiry  = 0

async function getAccessToken(env) {
  if (_cachedToken && Date.now() < _cacheExpiry) return _cachedToken

  const cryptoKey = await importPrivateKey(env.SA_PRIVATE_KEY)
  const now = Math.floor(Date.now() / 1000)

  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    iss:   env.SA_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }))

  const toSign = `${header}.${payload}`
  const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(toSign))
  const jwt    = `${toSign}.${b64urlBuf(sigBuf)}`

  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const json = await res.json()
  if (!json.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(json)}`)

  _cachedToken = json.access_token
  _cacheExpiry  = Date.now() + ((json.expires_in || 3600) - 300) * 1000
  return _cachedToken
}

async function importPrivateKey(pem) {
  const clean  = pem.replace(/\\n/g, '\n').replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s+/g, '')
  const binary = Uint8Array.from(atob(clean), c => c.charCodeAt(0))
  return crypto.subtle.importKey('pkcs8', binary, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
}

function b64url(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlBuf(buf) {
  let raw = ''
  new Uint8Array(buf).forEach(b => raw += String.fromCharCode(b))
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// ═══════════════════════════════════════════════════════════════════════════════
// FIRESTORE REST CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

function fsBase(pid) {
  return `https://firestore.googleapis.com/v1/projects/${pid}/databases/(default)/documents`
}

async function runQuery(token, pid, structuredQuery) {
  const res = await fetch(`${fsBase(pid)}:runQuery`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ structuredQuery }),
  })
  if (!res.ok) return []
  const rows = await res.json()
  return (Array.isArray(rows) ? rows : []).filter(r => r.document)
    .map(r => ({ _id: r.document.name.split('/').pop(), ...fsDocToObj(r.document) }))
}

async function fsGetDoc(token, pid, col, id) {
  const res = await fetch(`${fsBase(pid)}/${col}/${id}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  const doc = await res.json()
  return { _id: id, ...fsDocToObj(doc) }
}

async function fsQueryEqual(token, pid, col, field, value, limit) {
  const q = { from: [{ collectionId: col }], where: fsFieldEq(field, value) }
  if (limit) q.limit = limit
  return runQuery(token, pid, q)
}

async function fsQueryWhere(token, pid, col, where, limit) {
  const q = { from: [{ collectionId: col }] }
  if (where) q.where = where
  if (limit)  q.limit = limit
  return runQuery(token, pid, q)
}

async function fsGetAll(token, pid, col) {
  return runQuery(token, pid, { from: [{ collectionId: col }] })
}

async function tokensByRole(token, pid, ...roles) {
  const lists = await Promise.all(roles.map(r => fsQueryEqual(token, pid, 'fcmTokens', 'role', r)))
  return [...new Set(lists.flat().map(d => d.token).filter(Boolean))]
}
async function tokenByUserId(token, pid, uid) {
  if (!uid) return null
  const doc = await fsGetDoc(token, pid, 'fcmTokens', uid)
  return doc?.token || null
}
async function tokensByUserName(token, pid, name) {
  if (!name) return []
  const docs = await fsQueryEqual(token, pid, 'fcmTokens', 'userName', name)
  return docs.map(d => d.token).filter(Boolean)
}
async function tokensByUserNames(token, pid, names = []) {
  const unique = [...new Set(names.filter(Boolean))]
  if (!unique.length) return []
  const lists = await Promise.all(unique.map(n => tokensByUserName(token, pid, n)))
  return [...new Set(lists.flat())]
}

function fsFieldEq(path, value) {
  return { fieldFilter: { field: { fieldPath: path }, op: 'EQUAL', value: fsVal(value) } }
}
function fsVal(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number')  return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  if (v instanceof Date)      return { timestampValue: v.toISOString() }
  return { stringValue: String(v) }
}
function fsDocToObj(doc) {
  if (!doc?.fields) return {}
  const parse = f => {
    if (!f) return null
    if ('nullValue'      in f) return null
    if ('booleanValue'   in f) return f.booleanValue
    if ('integerValue'   in f) return Number(f.integerValue)
    if ('doubleValue'    in f) return f.doubleValue
    if ('timestampValue' in f) return new Date(f.timestampValue)
    if ('stringValue'    in f) return f.stringValue
    if ('mapValue'       in f) return fsDocToObj({ fields: f.mapValue.fields || {} })
    if ('arrayValue'     in f) return (f.arrayValue.values || []).map(parse)
    return null
  }
  return Object.fromEntries(Object.entries(doc.fields).map(([k, v]) => [k, parse(v)]))
}

// ═══════════════════════════════════════════════════════════════════════════════
// FCM HTTP v1 API
// ═══════════════════════════════════════════════════════════════════════════════

async function fcmSend(token, pid, tokens, notification, data = {}) {
  const clean   = [...new Set(tokens.filter(Boolean))]
  if (!clean.length) return
  const strData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? '')]))
  const chan    = strData.channel || 'avant_general'
  const url     = `https://fcm.googleapis.com/v1/projects/${pid}/messages:send`
  await Promise.all(clean.map(t =>
    fetch(url, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message: { token: t, notification, data: strData, android: { priority: 'high', notification: { channel_id: chan, sound: 'default' } }, apns: { payload: { aps: { sound: 'default', badge: 1 } } } } }),
    }).catch(() => {})
  ))
}

// ═══════════════════════════════════════════════════════════════════════════════
// OTP — send & verify
// ═══════════════════════════════════════════════════════════════════════════════

async function handleSendOtp(request, env) {
  const { userId, email } = await request.json().catch(() => ({}))
  if (!userId) return jsonErr('userId required', 400)
  if (!email)  return jsonErr('No email address on this admin account. Add one in HR settings.', 400)

  let emailConfig
  try {
    const t = await getAccessToken(env)
    const docs = await fsQueryWhere(t, env.FIREBASE_PROJECT_ID, 'configurations', null, 1)
    emailConfig = docs[0]?.email || null
  } catch (e) {
    return jsonErr(`Could not read email config from Firestore: ${e.message}`, 502)
  }
  if (!emailConfig?.smtpUser || !emailConfig?.smtpPass) {
    return jsonErr('Email not configured. Go to Configurations tab → Email Settings and save your SMTP credentials.', 500)
  }

  const otp = String(Math.floor(100_000 + Math.random() * 900_000))
  await env.OTP_KV.put(`otp:${userId}`, JSON.stringify({ otp, email, used: false }), { expirationTtl: 300 })

  const fromEmail = emailConfig.fromEmail || emailConfig.smtpUser
  const fromName  = emailConfig.fromName  || 'Avant Elevators'
  const html = `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8fafc;border-radius:12px;"><h2 style="color:#1e1b33;margin:0 0 8px;">Admin Login OTP</h2><p style="color:#64748b;margin:0 0 24px;">Use the code below to complete your Avant admin login. Valid for <strong>5 minutes</strong>.</p><div style="background:#1e1b33;border-radius:12px;padding:24px;text-align:center;letter-spacing:12px;font-size:36px;font-weight:700;color:#a5b4fc;">${otp}</div><p style="color:#94a3b8;font-size:12px;margin-top:20px;">Do not share this OTP. If you did not attempt login, contact your administrator immediately.</p></div>`

  const mr = await fetch(`${env.MAILER_URL}/send`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': env.MAILER_API_KEY },
    body:    JSON.stringify({ credentials: { email: emailConfig.smtpUser, password: emailConfig.smtpPass }, provider: emailConfig.smtpProvider || 'custom', mail: { from: `"${fromName}" <${fromEmail}>`, to: email, subject: `${otp} — Your Avant Admin OTP`, html } }),
  })
  if (!mr.ok) return jsonErr(`Email send failed: ${await mr.text().catch(() => mr.status)}`, 502)

  return ok({ sent: true, emailSent: true, smsSent: false, maskedEmail: maskEmail(email), maskedPhone: '' })
}

async function handleVerifyOtp(request, env) {
  const { userId, otp } = await request.json().catch(() => ({}))
  if (!userId || !otp) return ok({ valid: false, reason: 'Missing fields.' })
  const raw = await env.OTP_KV.get(`otp:${userId}`)
  if (!raw) return ok({ valid: false, reason: 'No OTP found. Please request a new one.' })
  const rec = JSON.parse(raw)
  if (rec.used) return ok({ valid: false, reason: 'OTP already used.' })
  if (rec.otp !== String(otp).trim()) return ok({ valid: false, reason: 'Incorrect OTP.' })
  await env.OTP_KV.put(`otp:${userId}`, JSON.stringify({ ...rec, used: true }), { expirationTtl: 60 })
  return ok({ valid: true })
}

function maskEmail(e) {
  if (!e?.includes('@')) return '***'
  const [l, d] = e.split('@')
  return l.slice(0, 2) + '***@' + d
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT NOTIFICATIONS — POST /notify { type, data, before }
// ═══════════════════════════════════════════════════════════════════════════════

async function handleNotify(request, env) {
  let body
  try { body = await request.json() } catch { return ok({ ok: true }) }
  const { type, data: d = {}, before: b = {} } = body
  try {
    const t   = await getAccessToken(env)
    const pid = env.FIREBASE_PROJECT_ID
    await dispatchNotify(t, pid, type, d, b)
  } catch (e) { console.error('[notify]', e.message) }
  return ok({ ok: true })
}

async function dispatchNotify(t, pid, type, d, b) {
  const byRole  = (...roles)  => tokensByRole(t, pid, ...roles)
  const byId    = (id)        => tokenByUserId(t, pid, id)
  const byName  = (n)         => tokensByUserName(t, pid, n)
  const byNames = (ns)        => tokensByUserNames(t, pid, ns)
  const send    = (tks, n, data) => fcmSend(t, pid, tks, n, data)

  switch (type) {
    case 'task_created': {
      if (!d.assignedTo) return
      return send(await byName(d.assignedTo), { title: 'New Task Assigned', body: d.title || 'You have a new task.' }, { type, docId: d.id||'', channel: 'avant_assignments' })
    }
    case 'task_reassigned': {
      if (!d.assignedTo || d.assignedTo === b.assignedTo) return
      return send(await byName(d.assignedTo), { title: 'Task Assigned to You', body: d.title || 'A task has been assigned to you.' }, { type: 'task_assigned', docId: d.id||'', channel: 'avant_assignments' })
    }
    case 'task_completed': {
      return send(await byRole('admin'), { title: 'Task Completed', body: `${d.title||'Task'} marked complete by ${d.assignedTo||'team'}.` }, { type, docId: d.id||'', channel: 'avant_updates' })
    }
    case 'lead_created': {
      const [adm, nm] = await Promise.all([byRole('admin'), byNames(d.assignedTo ? [d.assignedTo] : [])])
      return send([...adm,...nm], { title: '🆕 New Lead', body: `${d.clientName||d.name||'New lead'}${d.source?' via '+d.source:''}` }, { type, docId: d.id||'', channel: 'avant_assignments' })
    }
    case 'lead_assigned': {
      if (!d.assignedTo || d.assignedTo === b.assignedTo) return
      return send(await byName(d.assignedTo), { title: 'Lead Assigned to You', body: `${d.clientName||'Lead'} has been assigned to you.` }, { type, docId: d.id||'', channel: 'avant_assignments' })
    }
    case 'lead_won': {
      const pos = ['won','qualified','converted']
      if (!pos.includes(d.status) || pos.includes(b.status)) return
      return send(await byRole('admin'), { title: `Lead ${d.status.charAt(0).toUpperCase()+d.status.slice(1)}! 🎉`, body: `${d.clientName||'Lead'} marked as ${d.status}.` }, { type, docId: d.id||'', channel: 'avant_updates' })
    }
    case 'complaint_created': {
      return send(await byRole('admin','technician'), { title: '🚨 New Complaint', body: `${d.clientName||'Client'} — ${d.issueType||'Issue'} (${d.priority||'normal'} priority)` }, { type, docId: d.id||'', channel: 'avant_alerts' })
    }
    case 'complaint_assigned': {
      if (!d.assignedTo || d.assignedTo === b.assignedTo) return
      return send(await byName(d.assignedTo), { title: 'Complaint Assigned to You', body: `${d.clientName||'Client'} — ${d.issueType||'Issue'}.` }, { type, docId: d.id||'', channel: 'avant_assignments' })
    }
    case 'complaint_resolved': {
      const res = ['resolved','closed','done']
      if (!res.includes(d.status) || res.includes(b.status)) return
      return send(await byRole('admin'), { title: 'Complaint Resolved ✓', body: `${d.clientName||'Client'} resolved by ${d.assignedTo||'team'}.` }, { type, docId: d.id||'', channel: 'avant_updates' })
    }
    case 'ticket_created': {
      const ref = d.ticketRef||(d.id||'').slice(0,8).toUpperCase()
      return send(await byRole('admin'), { title: `🎫 New QR Ticket — ${ref}`, body: `${d.reporterName||'Anonymous'}${d.liftId?' · Lift '+d.liftId:''} — ${d.issueType||'Issue reported'}` }, { type, docId: d.id||'', ticketRef: ref, channel: 'avant_alerts' })
    }
    case 'installation_created': {
      const names = [d.assignedTo,d.assignedTechnician,d.technicianName].filter(Boolean)
      const [tech,adm] = await Promise.all([byNames(names),byRole('admin')])
      if (tech.length) await send(tech, { title: '🔧 New Installation Assigned', body: `${d.projectName||d.clientName||'Project'} — ${d.liftType||'Lift'} installation.` }, { type: 'installation_assigned', docId: d.id||'', channel: 'avant_assignments' })
      return send(adm, { title: 'New Installation Scheduled', body: `${d.projectName||d.clientName||'Installation'} assigned.` }, { type, docId: d.id||'', channel: 'avant_updates' })
    }
    case 'installation_completed': {
      const done = ['completed','done','finished']
      if (!done.includes(d.status)||done.includes(b.status)) return
      return send(await byRole('admin'), { title: 'Installation Completed ✓', body: `${d.projectName||d.clientName||'Installation'} marked complete.` }, { type, docId: d.id||'', channel: 'avant_updates' })
    }
    case 'repair_created': {
      const names = [d.assignedTo,d.assignedTechnician,d.technicianName].filter(Boolean)
      const [tech,adm] = await Promise.all([byNames(names),byRole('admin')])
      if (tech.length) await send(tech, { title: '🔨 New Repair Assigned', body: `${d.projectName||d.clientName||'Site'} — ${d.issueType||'Repair'}.` }, { type: 'repair_assigned', docId: d.id||'', channel: 'avant_assignments' })
      return send(adm, { title: 'New Repair Job Created', body: `${d.projectName||d.clientName||'Repair'} logged.` }, { type, docId: d.id||'', channel: 'avant_updates' })
    }
    case 'repair_completed': {
      if (!['completed','done'].includes(d.status)||['completed','done'].includes(b.status)) return
      return send(await byRole('admin'), { title: 'Repair Completed ✓', body: `${d.projectName||d.clientName||'Repair'} completed.` }, { type, docId: d.id||'', channel: 'avant_updates' })
    }
    case 'modernisation_created': {
      const names = [d.assignedTo,d.assignedTechnician].filter(Boolean)
      const [tech,adm] = await Promise.all([byNames(names),byRole('admin')])
      if (tech.length) await send(tech, { title: '⚙️ Modernisation Assigned', body: `${d.projectName||d.clientName||'Project'} assigned.` }, { type: 'modernisation_assigned', docId: d.id||'', channel: 'avant_assignments' })
      return send(adm, { title: 'Modernisation Scheduled', body: `${d.projectName||d.clientName||'Modernisation'} scheduled.` }, { type, docId: d.id||'', channel: 'avant_updates' })
    }
    case 'modernisation_completed': {
      if (!['completed','done'].includes(d.status)||['completed','done'].includes(b.status)) return
      return send(await byRole('admin'), { title: 'Modernisation Complete ✓', body: `${d.projectName||d.clientName||'Job'} completed.` }, { type, docId: d.id||'', channel: 'avant_updates' })
    }
    case 'maintenance_created': {
      const names = [d.technicianName,d.assignedTo,d.assignedTechnician].filter(Boolean)
      const dateStr = d.scheduledDate ? ` on ${d.scheduledDate}` : ''
      const proj = d.projectName||d.clientName||'Site'
      const [tech,adm] = await Promise.all([byNames(names),byRole('admin')])
      if (tech.length) await send(tech, { title: '🔧 Maintenance Scheduled for You', body: `${proj}${dateStr}.` }, { type: 'job_scheduled', docId: d.id||'', channel: 'avant_assignments' })
      return send(adm, { title: 'Maintenance Scheduled', body: `${proj} scheduled${dateStr}.` }, { type, docId: d.id||'', channel: 'avant_updates' })
    }
    case 'amc_created': {
      return send(await byRole('admin'), { title: 'New AMC Contract', body: `${d.clientName||'Client'} — ${d.contractNumber||''} | Rs.${Number(d.totalWithGST||d.contractValue||0).toLocaleString('en-IN')}` }, { type, docId: d.id||'', channel: 'avant_updates' })
    }
    case 'amc_payment': {
      const newLen = (d.paymentHistory||[]).length
      if (newLen <= (b.paymentHistory||[]).length) return
      const latest = d.paymentHistory[newLen-1]
      return send(await byRole('admin'), { title: 'AMC Payment Received 💰', body: `${d.clientName||'Client'} — Rs.${Number(latest?.amount||0).toLocaleString('en-IN')} via ${latest?.method||'cash'}` }, { type, docId: d.id||'', channel: 'avant_updates' })
    }
    case 'amc_monthly_log_created': {
      const loc = [d.buildingName,d.wingName,d.liftNo?'Lift '+d.liftNo:''].filter(Boolean).join(' · ')
      return send(await byRole('admin'), { title: 'Maintenance Logged ✓', body: `${d.clientName||'Contract'} — ${d.monthKey||''}${loc?' | '+loc:''} by ${d.technician||d.completedBy||'Tech'}` }, { type, docId: d.id||'', channel: 'avant_updates' })
    }
    case 'amc_monthly_completed': {
      if (!['completed','done'].includes(d.status)||['completed','done'].includes(b.status)) return
      return send(await byRole('admin'), { title: 'Monthly Maintenance Done ✓', body: `${d.projectName||d.clientName||'Maintenance'} completed.` }, { type, docId: d.id||'', channel: 'avant_updates' })
    }
    case 'attendance_created': {
      const adm = await byRole('admin')
      let timeStr = '—'; let isLate = false
      if (d.checkInTime) {
        const ts = d.checkInTime instanceof Date ? d.checkInTime : new Date(d.checkInTime)
        if (!isNaN(ts)) { const h=(ts.getUTCHours()+5)%24,m=(ts.getUTCMinutes()+30)%60; isLate=h*60+m>600; timeStr=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` }
      }
      return isLate
        ? send(adm, { title: '⏰ Late Check-In', body: `${d.employeeName||'Employee'} checked in at ${timeStr} (late).` }, { type: 'attendance_late', docId: d.id||'', channel: 'avant_alerts' })
        : send(adm, { title: 'Employee Checked In', body: `${d.employeeName||'Employee'} checked in at ${timeStr}.` }, { type: 'attendance_checkin', docId: d.id||'', channel: 'avant_general' })
    }
    case 'attendance_edited': {
      if (!b.adminEdited && d.adminEdited && d.employeeId) {
        const tk = await byId(d.employeeId)
        if (tk) return send([tk], { title: 'Attendance Record Updated', body: `Your attendance for ${d.date||'a recent date'} was updated by admin.` }, { type, docId: d.id||'', channel: 'avant_updates' })
      }
      break
    }
    case 'attendance_checkout': {
      if (b.checkOutTime || !d.checkOutTime) return
      const adm = await byRole('admin')
      const ts  = d.checkOutTime instanceof Date ? d.checkOutTime : new Date(d.checkOutTime)
      const timeStr = isNaN(ts) ? '—' : `${String((ts.getUTCHours()+5)%24).padStart(2,'0')}:${String((ts.getUTCMinutes()+30)%60).padStart(2,'0')}`
      return send(adm, { title: 'Employee Checked Out', body: `${d.employeeName||'Employee'} checked out at ${timeStr}.` }, { type, docId: d.id||'', channel: 'avant_general' })
    }
    case 'quotation_created': {
      return send(await byRole('admin'), { title: 'New Quotation Created', body: `${d.clientName||'Client'} — ${d.docNumber||''} | Rs.${Number(d.grandTotal||d.total||0).toLocaleString('en-IN')}` }, { type, docId: d.id||'', channel: 'avant_updates' })
    }
    case 'proforma_created':
    case 'tax_invoice_created':
    case 'invoice_created': {
      const lbl = type==='proforma_created'?'Proforma Invoice':type==='tax_invoice_created'?'Tax Invoice':'Invoice'
      return send(await byRole('admin'), { title: `New ${lbl}`, body: `${d.clientName||'Client'} — ${d.docNumber||''} | Rs.${Number(d.grandTotal||d.total||0).toLocaleString('en-IN')}` }, { type: 'invoice_created', docId: d.id||'', channel: 'avant_updates' })
    }
    case 'bom_created': {
      return send(await byRole('admin'), { title: 'New BOM Created', body: `${d.bomNumber||''} — ${d.clientName||d.projectName||'Project'} | Items: ${(d.items||[]).length}` }, { type, docId: d.id||'', channel: 'avant_updates' })
    }
    case 'salary_slip_created': {
      const empTk = d.employeeId ? await byId(d.employeeId) : null
      if (empTk) await send([empTk], { title: 'Salary Slip Generated 💵', body: `Your salary slip for ${d.month||d.period||'the month'} is ready. Net Pay: Rs.${Number(d.netPay||0).toLocaleString('en-IN')}` }, { type: 'salary_slip', docId: d.id||'', channel: 'avant_updates' })
      return send(await byRole('admin','hr'), { title: 'Salary Slip Created', body: `${d.employeeName||'Employee'} — ${d.month||d.period||''} | Rs.${Number(d.netPay||0).toLocaleString('en-IN')}` }, { type: 'salary_slip_admin', docId: d.id||'', channel: 'avant_updates' })
    }
    case 'leave_created': {
      return send(await byRole('admin','hr'), { title: 'Leave Request Submitted', body: `${d.employeeName||'Employee'} — ${d.leaveType||'Leave'} from ${d.startDate||''} to ${d.endDate||d.startDate||''}` }, { type, docId: d.id||'', channel: 'avant_alerts' })
    }
    case 'leave_decision': {
      if (!['approved','rejected'].includes(d.status)||['approved','rejected'].includes(b.status)) return
      const empTk   = d.employeeId ? await byId(d.employeeId) : null
      const nameTks = d.employeeName ? await byName(d.employeeName) : []
      const approved = d.status === 'approved'
      return send([...(empTk?[empTk]:[]),...nameTks], { title: approved?'Leave Approved ✓':'Leave Rejected ✗', body: `Your ${d.leaveType||'leave'} request (${d.startDate||''}) has been ${d.status}.` }, { type, docId: d.id||'', channel: approved?'avant_updates':'avant_alerts' })
    }
    case 'project_created': {
      return send(await byRole('admin'), { title: 'New Project Added', body: `${d.projectName||d.name||'New Project'} — ${d.clientName||''}` }, { type, docId: d.id||'', channel: 'avant_updates' })
    }
    case 'project_status_changed': {
      if (d.status === b.status) return
      return send(await byRole('admin'), { title: `Project: ${d.status}`, body: `${d.projectName||d.name||'Project'} status changed to ${d.status}.` }, { type: 'project_status', docId: d.id||'', channel: 'avant_updates' })
    }
    case 'po_created': {
      return send(await byRole('admin'), { title: 'New Purchase Order', body: `PO ${d.poNumber||''} — ${d.vendorName||d.vendor||'Vendor'} | Rs.${Number(d.total||d.grandTotal||0).toLocaleString('en-IN')}` }, { type, docId: d.id||'', channel: 'avant_updates' })
    }
    case 'reconnect_request': {
      if (!d.userId) return
      const tk = await byId(d.userId)
      if (tk) return send([tk], { title: '📍 Reconnect Location', body: `${d.requestedBy||'Admin'} has requested you to reconnect your location tracking.` }, { type, route: '/tracking', channel: 'avant_general', userId: d.userId })
      break
    }
    case 'security_alert': {
      return send(await byRole('admin'), { title: '🚨 Suspicious Activity Detected', body: `${d.failedVerifyAttempts||0} failed verifications after ${d.deleteCount||0} deletes. User: ${d.attemptedUsername||'Unknown'}.` }, { type, alertId: d.alertId||'', channel: 'avant_alerts' })
    }
    default:
      console.warn('[notify] unknown type:', type)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULED JOBS
// ═══════════════════════════════════════════════════════════════════════════════

function todayIST() { return new Date(Date.now()+5.5*3600_000).toISOString().slice(0,10) }
function addDays(s,n) { const d=new Date(s+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10) }
function toDate(v) { if(!v)return null; if(v instanceof Date)return v; if(v.toDate)return v.toDate(); return new Date(v) }

const FREQ_MONTHS = { monthly:1,'bi-monthly':2,quarterly:3,'4-monthly':4,'half-yearly':6,yearly:12 }

async function runAmcExpiryReminder(env) {
  const t=await getAccessToken(env); const pid=env.FIREBASE_PROJECT_ID
  const today=new Date(); const docs=await fsQueryEqual(t,pid,'amc','status','active'); const tokens=await tokensByRole(t,pid,'admin','sales')
  for(const amc of docs){if(!amc.endDate)continue;const end=toDate(amc.endDate);if(!end)continue;const dL=Math.ceil((end-today)/86400000);if(![1,7,30].includes(dL))continue;const lbl=dL===1?'Tomorrow':`In ${dL} days`;await fcmSend(t,pid,tokens,{title:`⚠️ AMC Expiring ${lbl}`,body:`${amc.clientName||'Client'} — ${amc.contractNumber||''} expires ${lbl.toLowerCase()}`},{type:'amc_expiry',docId:amc._id||'',daysLeft:String(dL),channel:'avant_reminders'})}
}

async function runAmcInstallmentReminder(env) {
  const t=await getAccessToken(env); const pid=env.FIREBASE_PROJECT_ID
  const today=todayIST(); const in3=addDays(today,3); const in7=addDays(today,7)
  const docs=await fsQueryWhere(t,pid,'amc',{compositeFilter:{op:'AND',filters:[{fieldFilter:{field:{fieldPath:'paymentType'},op:'EQUAL',value:{stringValue:'installments'}}},{fieldFilter:{field:{fieldPath:'status'},op:'EQUAL',value:{stringValue:'active'}}}]}})
  if(!docs.length)return; const tokens=await tokensByRole(t,pid,'admin','sales')
  for(const c of docs){const total=c.totalWithGST||c.contractValue||0;const dur=c.durationMonths||12;const freq=FREQ_MONTHS[c.frequency]||3;const count=Math.max(1,Math.ceil(dur/freq));const amount=Math.round(total/count);const sd=c.startDate?new Date(c.startDate+'T00:00:00Z'):null;const paid=(c.paymentHistory||[]).length;for(let i=paid;i<count;i++){if(!sd)continue;const d=new Date(sd);d.setUTCMonth(d.getUTCMonth()+i*freq);const due=d.toISOString().slice(0,10);if(due!==in3&&due!==in7)continue;const lbl=due===in3?'3 days':'7 days';await fcmSend(t,pid,tokens,{title:`💳 AMC Installment Due in ${lbl}`,body:`${c.clientName||'Client'} — Installment ${i+1}/${count} of Rs.${amount.toLocaleString('en-IN')} due on ${due}`},{type:'amc_installment_due',docId:c._id||'',installmentNo:String(i+1),dueDate:due,channel:'avant_reminders'})}}
}

async function runMaintenanceReminder(env) {
  const t=await getAccessToken(env); const pid=env.FIREBASE_PROJECT_ID
  const docs=await fsQueryEqual(t,pid,'amcMonthlyMaintenance','status','pending'); if(!docs.length)return
  const byTech={}; docs.forEach(d=>{const tech=d.assignedTo||d.technician||'__';(byTech[tech]=byTech[tech]||[]).push(d)})
  for(const[tn,jobs]of Object.entries(byTech)){if(tn==='__')continue;const tks=await tokensByUserName(t,pid,tn);await fcmSend(t,pid,tks,{title:'🔧 Maintenance Jobs Due This Month',body:`You have ${jobs.length} AMC maintenance job${jobs.length>1?'s':''} pending.`},{type:'maintenance_due',count:String(jobs.length),channel:'avant_reminders'})}
  await fcmSend(t,pid,await tokensByRole(t,pid,'admin'),{title:'Monthly Maintenance Summary',body:`${docs.length} maintenance job${docs.length>1?'s':''} pending this month.`},{type:'maintenance_summary',count:String(docs.length),channel:'avant_reminders'})
}

async function runOverdueTasksReminder(env) {
  const t=await getAccessToken(env); const pid=env.FIREBASE_PROJECT_ID; const today=todayIST()
  const all=await fsQueryWhere(t,pid,'tasks',{fieldFilter:{field:{fieldPath:'dueDate'},op:'LESS_THAN',value:{stringValue:today}}})
  const docs=all.filter(d=>!['completed','done','cancelled'].includes(d.status)); if(!docs.length)return
  const byUser={}; docs.forEach(d=>{const u=d.assignedTo||'';(byUser[u]=byUser[u]||[]).push(d)})
  for(const[u,tasks]of Object.entries(byUser)){if(!u)continue;const tks=await tokensByUserName(t,pid,u);await fcmSend(t,pid,tks,{title:`⚠️ ${tasks.length} Overdue Task${tasks.length>1?'s':''}`,body:`You have ${tasks.length} overdue task${tasks.length>1?'s':''} awaiting attention.`},{type:'overdue_tasks',count:String(tasks.length),channel:'avant_reminders'})}
  await fcmSend(t,pid,await tokensByRole(t,pid,'admin'),{title:'Overdue Tasks Summary',body:`${docs.length} task${docs.length>1?'s are':' is'} overdue.`},{type:'overdue_summary',count:String(docs.length),channel:'avant_reminders'})
}

async function runLeadFollowUpReminder(env) {
  const t=await getAccessToken(env); const pid=env.FIREBASE_PROJECT_ID; const today=todayIST()
  const docs=(await fsQueryEqual(t,pid,'leads','followUpDate',today)).filter(d=>!['won','lost','closed'].includes(d.status)); if(!docs.length)return
  const byUser={}; docs.forEach(d=>{const u=d.assignedTo||'__admin__';(byUser[u]=byUser[u]||[]).push(d)})
  for(const[u,leads]of Object.entries(byUser)){const tks=u==='__admin__'?await tokensByRole(t,pid,'admin','sales'):await tokensByUserName(t,pid,u);const names=leads.slice(0,3).map(l=>l.clientName||'Lead').join(', ');await fcmSend(t,pid,tks,{title:`📞 Follow-Up Due Today (${leads.length})`,body:`${names}${leads.length>3?` and ${leads.length-3} more`:''}`},{type:'followup_reminder',count:String(leads.length),channel:'avant_reminders'})}
}

async function runInvoiceOverdueReminder(env) {
  const t=await getAccessToken(env); const pid=env.FIREBASE_PROJECT_ID; const today=todayIST(); const tks=await tokensByRole(t,pid,'admin','sales')
  for(const col of['invoices','taxInvoices','proformaInvoices']){const all=await fsQueryWhere(t,pid,col,{fieldFilter:{field:{fieldPath:'dueDate'},op:'LESS_THAN',value:{stringValue:today}}});const docs=all.filter(d=>!['paid','cancelled'].includes(d.status));if(!docs.length)continue;const amt=docs.reduce((s,d)=>s+(d.grandTotal||d.total||0),0);await fcmSend(t,pid,tks,{title:`⚠️ ${docs.length} Overdue Invoice${docs.length>1?'s':''}`,body:`Total outstanding: Rs.${amt.toLocaleString('en-IN')} across ${docs.length} invoice${docs.length>1?'s':''}.`},{type:'invoice_overdue',count:String(docs.length),amount:String(amt),collection:col,channel:'avant_reminders'})}
}

async function runPunchInReminder(env) {
  const t=await getAccessToken(env); const pid=env.FIREBASE_PROJECT_ID; const today=todayIST()
  const[emps,att]=await Promise.all([fsGetAll(t,pid,'employees'),fsQueryEqual(t,pid,'attendance','date',today)])
  const cIds=new Set(att.map(d=>d.employeeId||d.userId).filter(Boolean)); const cNames=new Set(att.map(d=>d.employeeName).filter(Boolean))
  for(const emp of emps){if(emp.status==='inactive'||emp.role==='admin'||cIds.has(emp._id)||cNames.has(emp.fullName||emp.username))continue;const tk=await tokenByUserId(t,pid,emp._id);if(tk)await fcmSend(t,pid,[tk],{title:'⏰ Punch-In Reminder',body:"You haven't marked your attendance yet today."},{type:'punch_in_reminder',date:today,channel:'avant_reminders'})}
}

async function runServiceScheduleReminder(env) {
  const t=await getAccessToken(env); const pid=env.FIREBASE_PROJECT_ID; const today=todayIST(); const tomorrow=addDays(today,1)
  const cols={repairActivities:'Repair',installationActivities:'Installation',modernisationActivities:'Modernisation'}
  for(const[col,lbl]of Object.entries(cols)){const all=await fsQueryWhere(t,pid,col,{fieldFilter:{field:{fieldPath:'scheduledDate'},op:'IN',value:{arrayValue:{values:[{stringValue:today},{stringValue:tomorrow}]}}}});for(const job of all.filter(d=>!['completed','done','cancelled'].includes(d.status))){const when=job.scheduledDate===today?'Today':'Tomorrow';const names=[job.assignedTo,job.assignedTechnician,job.technicianName].filter(Boolean);const[tks,adm]=await Promise.all([tokensByUserNames(t,pid,names),tokensByRole(t,pid,'admin')]);await fcmSend(t,pid,[...tks,...adm],{title:`📅 ${lbl} Scheduled ${when}`,body:`${when}: ${job.projectName||job.clientName||'Job'} — ${job.liftType||job.issueType||lbl}`},{type:'job_scheduled',docId:job._id||'',collection:col,channel:'avant_reminders'})}}
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function ok(data = { ok: true }, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
function jsonErr(msg, status) { return ok({ error: msg }, status) }

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN WORKER EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-API-Key' } })
    }
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

    const key = request.headers.get('X-API-Key') || ''
    if (!env.WORKER_SECRET || key !== env.WORKER_SECRET) return new Response('Unauthorized', { status: 401 })

    if (url.pathname === '/otp/send')   return handleSendOtp(request, env)
    if (url.pathname === '/otp/verify') return handleVerifyOtp(request, env)
    if (url.pathname === '/notify')     return handleNotify(request, env)

    return new Response('Not Found', { status: 404 })
  },

  async scheduled(controller, env, ctx) {
    const run = fn => ctx.waitUntil(fn(env).catch(e => console.error('[cron]', e.message)))
    switch (controller.cron) {
      case '0 2 * * *':  return run(runServiceScheduleReminder)
      case '30 2 * * *': return run(runOverdueTasksReminder)
      case '30 2 1 * *': return run(runMaintenanceReminder)
      case '0 3 * * *':  return run(runLeadFollowUpReminder)
      case '30 3 * * *': return run(runAmcExpiryReminder)
      case '35 3 * * *': return run(runAmcInstallmentReminder)
      case '0 4 * * *':  run(runInvoiceOverdueReminder); return run(runPunchInReminder)
    }
  },
}
