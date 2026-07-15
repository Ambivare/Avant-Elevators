/**
 * Avant Elevators — Firebase Cloud Functions  (v2)
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ NOTIFICATION MATRIX                                                     │
 * ├──────────────────────────────────┬──────────────────┬───────────────────┤
 * │ Event                            │ Recipient        │ Trigger           │
 * ├──────────────────────────────────┼──────────────────┼───────────────────┤
 * │ Task assigned                    │ Assignee         │ onCreate          │
 * │ Task reassigned                  │ New assignee     │ onUpdate          │
 * │ Task completed                   │ Admin            │ onUpdate          │
 * │ Task overdue                     │ Assignee + admin │ Daily 8:00 AM     │
 * │ Lead created                     │ Admin + sales    │ onCreate          │
 * │ Lead assigned to sales           │ Salesperson      │ onUpdate          │
 * │ Lead won / qualified             │ Admin            │ onUpdate          │
 * │ Lead follow-up due               │ Assignee + admin │ Daily 8:30 AM     │
 * │ QR Ticket submitted              │ Admin            │ onCreate          │
 * │ Complaint filed                  │ Admin + techs    │ onCreate          │
 * │ Complaint resolved               │ Admin            │ onUpdate          │
 * │ Complaint assigned to tech       │ Technician       │ onUpdate          │
 * │ Installation assigned            │ Technician       │ onCreate          │
 * │ Installation completed           │ Admin            │ onUpdate          │
 * │ Repair assigned                  │ Technician       │ onCreate          │
 * │ Repair completed                 │ Admin            │ onUpdate          │
 * │ Modernisation assigned           │ Technician       │ onCreate          │
 * │ Modernisation completed          │ Admin            │ onUpdate          │
 * │ AMC contract created             │ Admin            │ onCreate          │
 * │ AMC payment logged               │ Admin            │ onUpdate          │
 * │ AMC expiry (1/7/30 days)         │ Admin + sales    │ Daily 9:00 AM     │
 * │ AMC installment due (3/7 days)   │ Admin + sales    │ Daily 9:00 AM     │
 * │ AMC monthly maintenance due      │ Technician+admin │ 1st of month      │
 * │ Monthly maintenance summary      │ Admin            │ 1st of month      │
 * │ Monthly maintenance completed    │ Admin            │ onUpdate          │
 * │ Service/repair schedule due      │ Technician+admin │ Daily 8:00 AM     │
 * │ Attendance checked in            │ Admin            │ onCreate          │
 * │ Late check-in (after 10 AM)      │ Admin            │ onCreate          │
 * │ Attendance record edited (admin) │ Employee         │ onUpdate          │
 * │ Quotation created                │ Admin            │ onCreate          │
 * │ Invoice created                  │ Admin            │ onCreate          │
 * │ Invoice overdue (1/7 days)       │ Admin + sales    │ Daily 9:30 AM     │
 * │ BOM created                      │ Admin            │ onCreate          │
 * │ Salary slip generated            │ Employee         │ onCreate          │
 * │ Leave request filed              │ Admin + HR       │ onCreate          │
 * │ Leave approved / rejected        │ Employee         │ onUpdate          │
 * │ Project created                  │ Admin            │ onCreate          │
 * │ Project status changed           │ Admin            │ onUpdate          │
 * │ Purchase order created           │ Admin            │ onCreate          │
 * └──────────────────────────────────┴──────────────────┴───────────────────┘
 *
 * Deploy:
 *   cd functions && npm install
 *   firebase deploy --only functions
 *
 * Requires Firebase Blaze (pay-as-you-go) plan.
 */

const { onSchedule }        = require('firebase-functions/v2/scheduler')
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { initializeApp }     = require('firebase-admin/app')
const { getFirestore }      = require('firebase-admin/firestore')
const { getMessaging }      = require('firebase-admin/messaging')

initializeApp()

const db        = getFirestore()
const messaging = getMessaging()

const REGION = 'us-central1'

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** All FCM tokens for users with any of the given roles. */
async function tokensByRole(...roles) {
  const snap = await db.collection('fcmTokens').get()
  return snap.docs
    .filter(d => roles.includes(d.data().role))
    .map(d => d.data().token)
    .filter(Boolean)
}

/** FCM token for a specific Firestore userId. */
async function tokenByUserId(userId) {
  if (!userId) return null
  try {
    const snap = await db.collection('fcmTokens').doc(userId).get()
    return snap.exists ? snap.data().token || null : null
  } catch { return null }
}

/** All FCM tokens for a given display name (matches userName field). */
async function tokensByUserName(userName) {
  if (!userName) return []
  const snap = await db.collection('fcmTokens')
    .where('userName', '==', userName).get()
  return snap.docs.map(d => d.data().token).filter(Boolean)
}

/** All FCM tokens for any of the given display names. */
async function tokensByUserNames(names = []) {
  const unique = [...new Set(names.filter(Boolean))]
  if (!unique.length) return []
  const results = await Promise.all(unique.map(n => tokensByUserName(n)))
  return results.flat()
}

/**
 * Send FCM multicast. Deduplicates tokens and batches at 500.
 * @param {string[]} tokens
 * @param {{ title: string, body: string }} notification
 * @param {Object} data  — all values become strings
 */
async function send(tokens, notification, data = {}) {
  const clean = [...new Set(tokens.filter(Boolean))]
  if (!clean.length) return

  const strData = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v ?? '')])
  )

  for (let i = 0; i < clean.length; i += 500) {
    try {
      await messaging.sendEachForMulticast({
        tokens: clean.slice(i, i + 500),
        notification,
        data: strData,
        android: {
          priority: 'high',
          notification: { channelId: strData.channel || 'avant_general', sound: 'default' },
        },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      })
    } catch (e) {
      console.error('[FCM] sendEachForMulticast error:', e.message)
    }
  }
}

/** Shorthand: send to a role + optionally an extra name-based token list. */
async function sendToRoleAndUser(roles, extraNames, notification, data) {
  const [roleTokens, nameTokens] = await Promise.all([
    tokensByRole(...roles),
    tokensByUserNames(extraNames),
  ])
  await send([...roleTokens, ...nameTokens], notification, data)
}

/** Parse a Firestore Timestamp, Date, or ISO string to JS Date (null-safe). */
function toDate(ts) {
  if (!ts) return null
  if (ts.toDate) return ts.toDate()
  if (ts instanceof Date) return ts
  return new Date(ts)
}

/** Today as YYYY-MM-DD string in IST. */
function todayIST() {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
}

/** Add days to a YYYY-MM-DD string, return YYYY-MM-DD. */
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// ─────────────────────────────────────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────────────────────────────────────

exports.onTaskCreated = onDocumentCreated(
  { document: 'tasks/{id}', region: REGION },
  async (event) => {
    const task = event.data.data()
    if (!task.assignedTo) return
    const tokens = await tokensByUserName(task.assignedTo)
    await send(tokens,
      { title: 'New Task Assigned', body: task.title || task.description || 'You have a new task.' },
      { type: 'task_assigned', docId: event.params.id, channel: 'avant_assignments' }
    )
  }
)

exports.onTaskUpdated = onDocumentUpdated(
  { document: 'tasks/{id}', region: REGION },
  async (event) => {
    const before = event.data.before.data()
    const after  = event.data.after.data()
    const id     = event.params.id
    const done   = ['completed', 'done']

    // Reassigned
    if (after.assignedTo && after.assignedTo !== before.assignedTo) {
      const tokens = await tokensByUserName(after.assignedTo)
      await send(tokens,
        { title: 'Task Assigned to You', body: after.title || 'A task has been assigned to you.' },
        { type: 'task_assigned', docId: id, channel: 'avant_assignments' }
      )
    }

    // Completed
    if (!done.includes(before.status) && done.includes(after.status)) {
      const adminTokens = await tokensByRole('admin')
      await send(adminTokens,
        { title: 'Task Completed', body: `${after.title || 'Task'} marked complete by ${after.assignedTo || 'team'}.` },
        { type: 'task_completed', docId: id, channel: 'avant_updates' }
      )
    }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// LEADS / CRM
// ─────────────────────────────────────────────────────────────────────────────

exports.onLeadCreated = onDocumentCreated(
  { document: 'leads/{id}', region: REGION },
  async (event) => {
    const lead = event.data.data()
    const by   = lead.createdBy || lead.assignedTo || ''
    const names = lead.assignedTo ? [lead.assignedTo] : []
    await sendToRoleAndUser(['admin'], names,
      { title: '🆕 New Lead', body: `${lead.clientName || lead.name || 'New lead'}${lead.source ? ' via ' + lead.source : ''}${by ? ' · Added by ' + by : ''}` },
      { type: 'new_lead', docId: event.params.id, channel: 'avant_assignments' }
    )
  }
)

exports.onLeadUpdated = onDocumentUpdated(
  { document: 'leads/{id}', region: REGION },
  async (event) => {
    const before = event.data.before.data()
    const after  = event.data.after.data()
    const id     = event.params.id

    // Assigned to salesperson
    if (after.assignedTo && after.assignedTo !== before.assignedTo) {
      const tokens = await tokensByUserName(after.assignedTo)
      await send(tokens,
        { title: 'Lead Assigned to You', body: `${after.clientName || 'Lead'} has been assigned to you.` },
        { type: 'lead_assigned', docId: id, channel: 'avant_assignments' }
      )
    }

    // Follow-up date changed — remind admin
    if (after.followUpDate && after.followUpDate !== before.followUpDate) {
      const adminTokens = await tokensByRole('admin')
      await send(adminTokens,
        { title: 'Follow-up Scheduled', body: `${after.clientName || 'Lead'} follow-up set for ${after.followUpDate}.` },
        { type: 'lead_followup_set', docId: id, channel: 'avant_reminders' }
      )
    }

    // Won or Qualified
    const positiveStatuses = ['won', 'qualified', 'converted']
    if (!positiveStatuses.includes(before.status) && positiveStatuses.includes(after.status)) {
      const adminTokens = await tokensByRole('admin')
      await send(adminTokens,
        { title: `Lead ${after.status.charAt(0).toUpperCase() + after.status.slice(1)}! 🎉`, body: `${after.clientName || 'Lead'} has been marked as ${after.status}.` },
        { type: 'lead_won', docId: id, channel: 'avant_updates' }
      )
    }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// COMPLAINTS
// ─────────────────────────────────────────────────────────────────────────────

exports.onComplaintCreated = onDocumentCreated(
  { document: 'complaintActivities/{id}', region: REGION },
  async (event) => {
    const c = event.data.data()
    const tokens = await tokensByRole('admin', 'technician')
    await send(tokens,
      { title: '🚨 New Complaint', body: `${c.clientName || 'Client'} — ${c.issueType || c.type || 'Issue'} (${c.priority || 'normal'} priority)` },
      { type: 'new_complaint', docId: event.params.id, channel: 'avant_alerts' }
    )
  }
)

exports.onComplaintUpdated = onDocumentUpdated(
  { document: 'complaintActivities/{id}', region: REGION },
  async (event) => {
    const before = event.data.before.data()
    const after  = event.data.after.data()
    const id     = event.params.id

    // Assigned to technician
    if (after.assignedTo && after.assignedTo !== before.assignedTo) {
      const tokens = await tokensByUserName(after.assignedTo)
      await send(tokens,
        { title: 'Complaint Assigned to You', body: `${after.clientName || 'Client'} — ${after.issueType || 'Issue'}. Please attend promptly.` },
        { type: 'complaint_assigned', docId: id, channel: 'avant_assignments' }
      )
    }

    // Resolved
    const resolved = ['resolved', 'closed', 'done']
    if (!resolved.includes(before.status) && resolved.includes(after.status)) {
      const adminTokens = await tokensByRole('admin')
      await send(adminTokens,
        { title: 'Complaint Resolved ✓', body: `${after.clientName || 'Client'} complaint resolved by ${after.assignedTo || 'team'}.` },
        { type: 'complaint_resolved', docId: id, channel: 'avant_updates' }
      )
    }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// QR TICKETS (submitted by lift users via public web form)
// ─────────────────────────────────────────────────────────────────────────────

exports.onTicketCreated = onDocumentCreated(
  { document: 'tickets/{id}', region: REGION },
  async (event) => {
    const t = event.data.data()
    const adminTokens = await tokensByRole('admin')
    const ref = t.ticketRef || event.params.id.slice(0, 8).toUpperCase()
    const who = t.reporterName || 'Anonymous'
    const lift = t.liftId ? ` · Lift ${t.liftId}` : ''
    await send(adminTokens,
      { title: `🎫 New QR Ticket — ${ref}`, body: `${who}${lift} — ${t.issueType || 'Issue reported'}` },
      { type: 'new_ticket', docId: event.params.id, ticketRef: ref, channel: 'avant_alerts' }
    )
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// INSTALLATION ACTIVITIES
// ─────────────────────────────────────────────────────────────────────────────

exports.onInstallationCreated = onDocumentCreated(
  { document: 'installationActivities/{id}', region: REGION },
  async (event) => {
    const doc = event.data.data()
    const names = [doc.assignedTo, doc.assignedTechnician, doc.technicianName].filter(Boolean)
    const [techTokens, adminTokens] = await Promise.all([
      tokensByUserNames(names),
      tokensByRole('admin'),
    ])
    if (techTokens.length) {
      await send(techTokens,
        { title: '🔧 New Installation Assigned', body: `${doc.projectName || doc.clientName || 'Project'} — ${doc.liftType || 'Lift'} installation.` },
        { type: 'installation_assigned', docId: event.params.id, channel: 'avant_assignments' }
      )
    }
    await send(adminTokens,
      { title: 'New Installation Scheduled', body: `${doc.projectName || doc.clientName || 'Installation'} assigned to ${names[0] || 'technician'}.` },
      { type: 'installation_created', docId: event.params.id, channel: 'avant_updates' }
    )
  }
)

exports.onInstallationUpdated = onDocumentUpdated(
  { document: 'installationActivities/{id}', region: REGION },
  async (event) => {
    const before = event.data.before.data()
    const after  = event.data.after.data()
    const id     = event.params.id
    const done   = ['completed', 'done', 'finished']

    if (!done.includes(before.status) && done.includes(after.status)) {
      const adminTokens = await tokensByRole('admin')
      await send(adminTokens,
        { title: 'Installation Completed ✓', body: `${after.projectName || after.clientName || 'Installation'} marked complete.` },
        { type: 'installation_completed', docId: id, channel: 'avant_updates' }
      )
    }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// REPAIR ACTIVITIES
// ─────────────────────────────────────────────────────────────────────────────

exports.onRepairCreated = onDocumentCreated(
  { document: 'repairActivities/{id}', region: REGION },
  async (event) => {
    const doc = event.data.data()
    const names = [doc.assignedTo, doc.assignedTechnician, doc.technicianName].filter(Boolean)
    const [techTokens, adminTokens] = await Promise.all([
      tokensByUserNames(names),
      tokensByRole('admin'),
    ])
    if (techTokens.length) {
      await send(techTokens,
        { title: '🔨 New Repair Assigned', body: `${doc.projectName || doc.clientName || 'Site'} — ${doc.issueType || doc.type || 'Repair'}.` },
        { type: 'repair_assigned', docId: event.params.id, channel: 'avant_assignments' }
      )
    }
    await send(adminTokens,
      { title: 'New Repair Job Created', body: `${doc.projectName || doc.clientName || 'Repair'} logged.` },
      { type: 'repair_created', docId: event.params.id, channel: 'avant_updates' }
    )
  }
)

exports.onRepairUpdated = onDocumentUpdated(
  { document: 'repairActivities/{id}', region: REGION },
  async (event) => {
    const before = event.data.before.data()
    const after  = event.data.after.data()
    const id     = event.params.id

    if (!['completed','done'].includes(before.status) && ['completed','done'].includes(after.status)) {
      const adminTokens = await tokensByRole('admin')
      await send(adminTokens,
        { title: 'Repair Completed ✓', body: `${after.projectName || after.clientName || 'Repair'} completed by ${after.assignedTo || 'technician'}.` },
        { type: 'repair_completed', docId: id, channel: 'avant_updates' }
      )
    }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// MODERNISATION ACTIVITIES
// ─────────────────────────────────────────────────────────────────────────────

exports.onModernisationCreated = onDocumentCreated(
  { document: 'modernisationActivities/{id}', region: REGION },
  async (event) => {
    const doc = event.data.data()
    const names = [doc.assignedTo, doc.assignedTechnician].filter(Boolean)
    const [techTokens, adminTokens] = await Promise.all([
      tokensByUserNames(names),
      tokensByRole('admin'),
    ])
    if (techTokens.length) {
      await send(techTokens,
        { title: '⚙️ Modernisation Assigned', body: `${doc.projectName || doc.clientName || 'Project'} modernisation job assigned to you.` },
        { type: 'modernisation_assigned', docId: event.params.id, channel: 'avant_assignments' }
      )
    }
    await send(adminTokens,
      { title: 'Modernisation Scheduled', body: `${doc.projectName || doc.clientName || 'Modernisation'} assigned to ${names[0] || 'technician'}.` },
      { type: 'modernisation_created', docId: event.params.id, channel: 'avant_updates' }
    )
  }
)

exports.onModernisationUpdated = onDocumentUpdated(
  { document: 'modernisationActivities/{id}', region: REGION },
  async (event) => {
    const before = event.data.before.data()
    const after  = event.data.after.data()
    if (!['completed','done'].includes(before.status) && ['completed','done'].includes(after.status)) {
      const adminTokens = await tokensByRole('admin')
      await send(adminTokens,
        { title: 'Modernisation Complete ✓', body: `${after.projectName || after.clientName || 'Job'} modernisation completed.` },
        { type: 'modernisation_completed', docId: event.params.id, channel: 'avant_updates' }
      )
    }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED MAINTENANCE
// ─────────────────────────────────────────────────────────────────────────────

exports.onMaintenanceCreated = onDocumentCreated(
  { document: 'maintenance/{id}', region: REGION },
  async (event) => {
    const doc = event.data.data()
    const names = [doc.technicianName, doc.assignedTo, doc.assignedTechnician].filter(Boolean)
    const [techTokens, adminTokens] = await Promise.all([
      tokensByUserNames(names),
      tokensByRole('admin'),
    ])
    const dateStr = doc.scheduledDate ? ` on ${doc.scheduledDate}` : ''
    const project = doc.projectName || doc.clientName || 'Site'
    if (techTokens.length) {
      await send(techTokens,
        { title: '🔧 Maintenance Scheduled for You', body: `${project}${dateStr} — ${doc.maintenanceType || 'Routine'} maintenance.` },
        { type: 'job_scheduled', docId: event.params.id, collection: 'maintenance', channel: 'avant_assignments' }
      )
    }
    await send(adminTokens,
      { title: 'Maintenance Scheduled', body: `${project} — ${doc.maintenanceType || 'Maintenance'} scheduled${dateStr}.` },
      { type: 'maintenance_scheduled', docId: event.params.id, channel: 'avant_updates' }
    )
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// AMC CONTRACTS
// ─────────────────────────────────────────────────────────────────────────────

exports.onAMCCreated = onDocumentCreated(
  { document: 'amc/{id}', region: REGION },
  async (event) => {
    const amc = event.data.data()
    const adminTokens = await tokensByRole('admin')
    await send(adminTokens,
      { title: 'New AMC Contract', body: `${amc.clientName || 'Client'} — ${amc.contractNumber || ''} | Value: Rs.${(amc.totalWithGST || amc.contractValue || 0).toLocaleString('en-IN')}` },
      { type: 'amc_created', docId: event.params.id, channel: 'avant_updates' }
    )
  }
)

exports.onAMCUpdated = onDocumentUpdated(
  { document: 'amc/{id}', region: REGION },
  async (event) => {
    const before = event.data.before.data()
    const after  = event.data.after.data()
    const id     = event.params.id

    // Payment logged — paymentHistory array grew
    const prevLen = (before.paymentHistory || []).length
    const newLen  = (after.paymentHistory || []).length
    if (newLen > prevLen) {
      const latest      = after.paymentHistory[newLen - 1]
      const adminTokens = await tokensByRole('admin')
      await send(adminTokens,
        { title: 'AMC Payment Received 💰', body: `${after.clientName || 'Client'} — Rs.${Number(latest?.amount || 0).toLocaleString('en-IN')} via ${latest?.method || 'cash'}` },
        { type: 'amc_payment', docId: id, channel: 'avant_updates' }
      )
    }

    // Status changed
    if (before.status !== after.status) {
      const adminTokens = await tokensByRole('admin')
      const by = after.updatedBy || ''
      await send(adminTokens,
        { title: `AMC Status → ${after.status}`, body: `${after.clientName || after.contractNumber || 'Contract'} changed from ${before.status} to ${after.status}${by ? ' by ' + by : ''}.` },
        { type: 'amc_status', docId: id, channel: 'avant_updates' }
      )
    }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// AMC MONTHLY MAINTENANCE
// ─────────────────────────────────────────────────────────────────────────────

exports.onAMCMonthlyLogCreated = onDocumentCreated(
  { document: 'amcMonthlyMaintenance/{id}', region: REGION },
  async (event) => {
    const log = event.data.data()
    const adminTokens = await tokensByRole('admin')
    const location = [log.buildingName, log.wingName, log.liftNo ? 'Lift ' + log.liftNo : ''].filter(Boolean).join(' · ')
    await send(adminTokens,
      { title: 'Maintenance Logged ✓', body: `${log.clientName || 'Contract'} — ${log.monthKey || ''}${location ? ' | ' + location : ''} by ${log.technician || log.completedBy || 'Tech'}` },
      { type: 'amc_monthly_logged', docId: event.params.id, channel: 'avant_updates' }
    )
  }
)

exports.onAMCMonthlyUpdated = onDocumentUpdated(
  { document: 'amcMonthlyMaintenance/{id}', region: REGION },
  async (event) => {
    const before = event.data.before.data()
    const after  = event.data.after.data()
    if (!['completed','done'].includes(before.status) && ['completed','done'].includes(after.status)) {
      const adminTokens = await tokensByRole('admin')
      await send(adminTokens,
        { title: 'Monthly Maintenance Done ✓', body: `${after.projectName || after.clientName || 'Maintenance'} completed by ${after.technician || after.assignedTo || 'technician'}.` },
        { type: 'amc_monthly_completed', docId: event.params.id, channel: 'avant_updates' }
      )
    }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────────────────────────────────────

exports.onAttendanceCreated = onDocumentCreated(
  { document: 'attendance/{id}', region: REGION },
  async (event) => {
    const rec         = event.data.data()
    const adminTokens = await tokensByRole('admin')

    // Check-in time to detect late arrival
    let isLate = false
    let timeStr = '—'
    if (rec.checkInTime) {
      const d = toDate(rec.checkInTime)
      if (d) {
        const istH = (d.getUTCHours() + 5) % 24
        const istM = (d.getUTCMinutes() + 30) % 60
        const totalMin = istH * 60 + istM
        isLate = totalMin > 10 * 60 // after 10:00 AM IST
        timeStr = `${String(istH).padStart(2,'0')}:${String(istM).padStart(2,'0')}`
      }
    }

    if (isLate) {
      await send(adminTokens,
        { title: '⏰ Late Check-In', body: `${rec.employeeName || 'Employee'} checked in at ${timeStr} (late).` },
        { type: 'attendance_late', docId: event.params.id, employeeId: rec.employeeId || '', channel: 'avant_alerts' }
      )
    } else {
      await send(adminTokens,
        { title: 'Employee Checked In', body: `${rec.employeeName || 'Employee'} checked in at ${timeStr}.` },
        { type: 'attendance_checkin', docId: event.params.id, employeeId: rec.employeeId || '', channel: 'avant_general' }
      )
    }
  }
)

exports.onAttendanceUpdated = onDocumentUpdated(
  { document: 'attendance/{id}', region: REGION },
  async (event) => {
    const before = event.data.before.data()
    const after  = event.data.after.data()

    // Admin edited → notify the employee
    if (!before.adminEdited && after.adminEdited && after.employeeId) {
      const token = await tokenByUserId(after.employeeId)
      if (token) {
        await send([token],
          { title: 'Attendance Record Updated', body: `Your attendance for ${after.date || 'a recent date'} was updated by admin.` },
          { type: 'attendance_edited', docId: event.params.id, channel: 'avant_updates' }
        )
      }
    }

    // Check-out logged → notify admin
    if (!before.checkOutTime && after.checkOutTime && after.employeeName) {
      const adminTokens = await tokensByRole('admin')
      let timeStr = '—'
      const d = toDate(after.checkOutTime)
      if (d) {
        const istH = (d.getUTCHours() + 5) % 24
        const istM = (d.getUTCMinutes() + 30) % 60
        timeStr = `${String(istH).padStart(2,'0')}:${String(istM).padStart(2,'0')}`
      }
      await send(adminTokens,
        { title: 'Employee Checked Out', body: `${after.employeeName} checked out at ${timeStr}.` },
        { type: 'attendance_checkout', docId: event.params.id, channel: 'avant_general' }
      )
    }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// QUOTATIONS
// ─────────────────────────────────────────────────────────────────────────────

exports.onQuotationCreated = onDocumentCreated(
  { document: 'quotations/{id}', region: REGION },
  async (event) => {
    const q = event.data.data()
    const adminTokens = await tokensByRole('admin')
    await send(adminTokens,
      { title: 'New Quotation Created', body: `${q.clientName || 'Client'} — ${q.docNumber || q.quotationNumber || ''} | Rs.${(q.grandTotal || q.total || 0).toLocaleString('en-IN')}` },
      { type: 'quotation_created', docId: event.params.id, channel: 'avant_updates' }
    )
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// INVOICES (all three types)
// ─────────────────────────────────────────────────────────────────────────────

async function onInvoiceCreatedHandler(event, typeName) {
  const inv = event.data.data()
  const adminTokens = await tokensByRole('admin')
  await send(adminTokens,
    { title: `New ${typeName}`, body: `${inv.clientName || 'Client'} — ${inv.docNumber || inv.invoiceNumber || ''} | Rs.${(inv.grandTotal || inv.total || 0).toLocaleString('en-IN')}` },
    { type: 'invoice_created', docId: event.params.id, channel: 'avant_updates' }
  )
}

exports.onProformaCreated = onDocumentCreated(
  { document: 'proformaInvoices/{id}', region: REGION },
  async (event) => onInvoiceCreatedHandler(event, 'Proforma Invoice')
)

exports.onTaxInvoiceCreated = onDocumentCreated(
  { document: 'taxInvoices/{id}', region: REGION },
  async (event) => onInvoiceCreatedHandler(event, 'Tax Invoice')
)

exports.onInvoiceCreated = onDocumentCreated(
  { document: 'invoices/{id}', region: REGION },
  async (event) => onInvoiceCreatedHandler(event, 'Invoice')
)

// ─────────────────────────────────────────────────────────────────────────────
// BOM
// ─────────────────────────────────────────────────────────────────────────────

exports.onBOMCreated = onDocumentCreated(
  { document: 'bom/{id}', region: REGION },
  async (event) => {
    const bom = event.data.data()
    const adminTokens = await tokensByRole('admin')
    await send(adminTokens,
      { title: 'New BOM Created', body: `${bom.bomNumber || ''} — ${bom.clientName || bom.projectName || 'Project'} | Items: ${(bom.items || []).length}` },
      { type: 'bom_created', docId: event.params.id, channel: 'avant_updates' }
    )
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// SALARY SLIPS
// ─────────────────────────────────────────────────────────────────────────────

exports.onSalarySlipCreated = onDocumentCreated(
  { document: 'salarySlips/{id}', region: REGION },
  async (event) => {
    const slip = event.data.data()
    // Notify the employee by userId
    const empToken = slip.employeeId ? await tokenByUserId(slip.employeeId) : null
    if (empToken) {
      await send([empToken],
        { title: 'Salary Slip Generated 💵', body: `Your salary slip for ${slip.month || slip.period || 'the month'} is ready. Net Pay: Rs.${(slip.netPay || 0).toLocaleString('en-IN')}` },
        { type: 'salary_slip', docId: event.params.id, channel: 'avant_updates' }
      )
    }
    // Notify admin/HR too
    const hrTokens = await tokensByRole('admin', 'hr')
    await send(hrTokens,
      { title: 'Salary Slip Created', body: `${slip.employeeName || 'Employee'} — ${slip.month || slip.period || ''} | Rs.${(slip.netPay || 0).toLocaleString('en-IN')}` },
      { type: 'salary_slip_admin', docId: event.params.id, channel: 'avant_updates' }
    )
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE REQUESTS
// ─────────────────────────────────────────────────────────────────────────────

exports.onLeaveCreated = onDocumentCreated(
  { document: 'leaveRequests/{id}', region: REGION },
  async (event) => {
    const req = event.data.data()
    const adminTokens = await tokensByRole('admin', 'hr')
    await send(adminTokens,
      { title: 'Leave Request Submitted', body: `${req.employeeName || 'Employee'} — ${req.leaveType || 'Leave'} from ${req.startDate || ''} to ${req.endDate || req.startDate || ''}` },
      { type: 'leave_request', docId: event.params.id, channel: 'avant_alerts' }
    )
  }
)

exports.onLeaveUpdated = onDocumentUpdated(
  { document: 'leaveRequests/{id}', region: REGION },
  async (event) => {
    const before = event.data.before.data()
    const after  = event.data.after.data()
    const id     = event.params.id

    const decided = ['approved', 'rejected']
    if (!decided.includes(before.status) && decided.includes(after.status)) {
      const empToken = after.employeeId ? await tokenByUserId(after.employeeId) : null
      const nameTokens = after.employeeName ? await tokensByUserName(after.employeeName) : []
      const allTokens = [...(empToken ? [empToken] : []), ...nameTokens]
      const approved = after.status === 'approved'
      await send(allTokens,
        {
          title: approved ? 'Leave Approved ✓' : 'Leave Rejected ✗',
          body: `Your ${after.leaveType || 'leave'} request (${after.startDate || ''}) has been ${after.status}.`,
        },
        { type: 'leave_decision', docId: id, channel: approved ? 'avant_updates' : 'avant_alerts' }
      )
    }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTS
// ─────────────────────────────────────────────────────────────────────────────

exports.onProjectCreated = onDocumentCreated(
  { document: 'projects/{id}', region: REGION },
  async (event) => {
    const proj = event.data.data()
    const adminTokens = await tokensByRole('admin')
    await send(adminTokens,
      { title: 'New Project Added', body: `${proj.projectName || proj.name || 'New Project'} — ${proj.clientName || ''}` },
      { type: 'project_created', docId: event.params.id, channel: 'avant_updates' }
    )
  }
)

exports.onProjectUpdated = onDocumentUpdated(
  { document: 'projects/{id}', region: REGION },
  async (event) => {
    const before = event.data.before.data()
    const after  = event.data.after.data()
    if (before.status !== after.status) {
      const adminTokens = await tokensByRole('admin')
      await send(adminTokens,
        { title: `Project: ${after.status}`, body: `${after.projectName || after.name || 'Project'} status changed to ${after.status}.` },
        { type: 'project_status', docId: event.params.id, channel: 'avant_updates' }
      )
    }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// PURCHASE ORDERS
// ─────────────────────────────────────────────────────────────────────────────

exports.onPurchaseOrderCreated = onDocumentCreated(
  { document: 'purchaseOrders/{id}', region: REGION },
  async (event) => {
    const po = event.data.data()
    const adminTokens = await tokensByRole('admin')
    await send(adminTokens,
      { title: 'New Purchase Order', body: `PO ${po.poNumber || ''} — ${po.vendorName || po.vendor || 'Vendor'} | Rs.${(po.total || po.grandTotal || 0).toLocaleString('en-IN')}` },
      { type: 'po_created', docId: event.params.id, channel: 'avant_updates' }
    )
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED: AMC Expiry Reminder
// Daily 9:00 AM IST (03:30 UTC)
// ─────────────────────────────────────────────────────────────────────────────

exports.amcExpiryReminder = onSchedule(
  { schedule: '30 3 * * *', timeZone: 'Asia/Kolkata', region: REGION },
  async () => {
    const today   = new Date()
    const snap    = await db.collection('amc').where('status', '==', 'active').get()
    const tokens  = await tokensByRole('admin', 'sales')

    for (const docSnap of snap.docs) {
      const amc = docSnap.data()
      if (!amc.endDate) continue
      const end      = toDate(amc.endDate)
      const daysLeft = Math.ceil((end - today) / 86_400_000)
      if (![1, 7, 30].includes(daysLeft)) continue

      const label = daysLeft === 1 ? 'Tomorrow' : `In ${daysLeft} days`
      await send(tokens,
        { title: `⚠️ AMC Expiring ${label}`, body: `${amc.clientName || 'Client'} — ${amc.contractNumber || ''} expires ${label.toLowerCase()}` },
        { type: 'amc_expiry', docId: docSnap.id, daysLeft, channel: 'avant_reminders' }
      )
    }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED: AMC Installment Payment Due Reminder
// Daily 9:00 AM IST (03:30 UTC)
// ─────────────────────────────────────────────────────────────────────────────

const FREQ_TO_MONTHS = { monthly:1, 'bi-monthly':2, quarterly:3, '4-monthly':4, 'half-yearly':6, yearly:12 }

exports.amcInstallmentReminder = onSchedule(
  { schedule: '35 3 * * *', timeZone: 'Asia/Kolkata', region: REGION },
  async () => {
    const today  = todayIST()
    const in3    = addDays(today, 3)
    const in7    = addDays(today, 7)
    const snap   = await db.collection('amc')
      .where('paymentType', '==', 'installments')
      .where('status', '==', 'active')
      .get()

    if (snap.empty) return
    const tokens = await tokensByRole('admin', 'sales')

    for (const docSnap of snap.docs) {
      const c        = docSnap.data()
      const total    = c.totalWithGST || c.contractValue || 0
      const dur      = c.durationMonths || 12
      const freq     = FREQ_TO_MONTHS[c.frequency] || 3
      const count    = Math.max(1, Math.ceil(dur / freq))
      const amount   = Math.round(total / count)
      const startDate = c.startDate ? new Date(c.startDate + 'T00:00:00Z') : null
      const paid     = (c.paymentHistory || []).length

      for (let i = paid; i < count; i++) {
        if (!startDate) continue
        const d = new Date(startDate)
        d.setUTCMonth(d.getUTCMonth() + i * freq)
        const dueStr = d.toISOString().slice(0, 10)

        if (dueStr === in3 || dueStr === in7) {
          const label = dueStr === in3 ? '3 days' : '7 days'
          await send(tokens,
            { title: `💳 AMC Installment Due in ${label}`, body: `${c.clientName || 'Client'} — Installment ${i+1}/${count} of Rs.${amount.toLocaleString('en-IN')} due on ${dueStr}` },
            { type: 'amc_installment_due', docId: docSnap.id, installmentNo: i+1, dueDate: dueStr, channel: 'avant_reminders' }
          )
        }
      }
    }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED: Monthly AMC Maintenance Reminder
// 1st of each month 8:00 AM IST (02:30 UTC)
// ─────────────────────────────────────────────────────────────────────────────

exports.maintenanceReminder = onSchedule(
  { schedule: '30 2 1 * *', timeZone: 'Asia/Kolkata', region: REGION },
  async () => {
    const snap = await db.collection('amcMonthlyMaintenance')
      .where('status', '==', 'pending').get()
    if (snap.empty) return

    const byTech = {}
    snap.docs.forEach(d => {
      const tech = d.data().assignedTo || d.data().technician || '__unassigned__'
      ;(byTech[tech] = byTech[tech] || []).push(d.data())
    })

    for (const [techName, jobs] of Object.entries(byTech)) {
      if (techName === '__unassigned__') continue
      const tokens = await tokensByUserName(techName)
      const count  = jobs.length
      await send(tokens,
        { title: '🔧 Maintenance Jobs Due This Month', body: `You have ${count} AMC maintenance job${count > 1 ? 's' : ''} pending.` },
        { type: 'maintenance_due', count, channel: 'avant_reminders' }
      )
    }

    const adminTokens = await tokensByRole('admin')
    await send(adminTokens,
      { title: 'Monthly Maintenance Summary', body: `${snap.size} maintenance job${snap.size > 1 ? 's' : ''} pending this month.` },
      { type: 'maintenance_summary', count: snap.size, channel: 'avant_reminders' }
    )
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED: Overdue Tasks Reminder
// Daily 8:00 AM IST (02:30 UTC)
// ─────────────────────────────────────────────────────────────────────────────

exports.overdueTasksReminder = onSchedule(
  { schedule: '30 2 * * *', timeZone: 'Asia/Kolkata', region: REGION },
  async () => {
    const today = todayIST()
    let docs = []
    try {
      const snap = await db.collection('tasks')
        .where('dueDate', '<', today)
        .where('status', 'not-in', ['completed', 'done', 'cancelled']).get()
      docs = snap.docs
    } catch {
      const snap = await db.collection('tasks').where('dueDate', '<', today).get()
      docs = snap.docs.filter(d => !['completed','done','cancelled'].includes(d.data().status))
    }
    if (!docs.length) return

    const byUser = {}
    docs.forEach(d => {
      const u = d.data().assignedTo || ''
      ;(byUser[u] = byUser[u] || []).push(d.data())
    })

    for (const [userName, tasks] of Object.entries(byUser)) {
      if (!userName) continue
      const tokens = await tokensByUserName(userName)
      const count  = tasks.length
      await send(tokens,
        { title: `⚠️ ${count} Overdue Task${count > 1 ? 's' : ''}`, body: `You have ${count} overdue task${count > 1 ? 's' : ''} awaiting attention.` },
        { type: 'overdue_tasks', count, channel: 'avant_reminders' }
      )
    }

    // Daily overdue summary to admin
    const total = docs.length
    if (total > 0) {
      const adminTokens = await tokensByRole('admin')
      await send(adminTokens,
        { title: 'Overdue Tasks Summary', body: `${total} task${total > 1 ? 's are' : ' is'} overdue across all team members.` },
        { type: 'overdue_summary', count: total, channel: 'avant_reminders' }
      )
    }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED: Lead Follow-Up Reminders
// Daily 8:30 AM IST (03:00 UTC)
// ─────────────────────────────────────────────────────────────────────────────

exports.leadFollowUpReminder = onSchedule(
  { schedule: '0 3 * * *', timeZone: 'Asia/Kolkata', region: REGION },
  async () => {
    const today = todayIST()
    const snap  = await db.collection('leads')
      .where('followUpDate', '==', today)
      .where('status', 'not-in', ['won', 'lost', 'closed']).get()

    if (snap.empty) return

    const byUser = {}
    snap.docs.forEach(d => {
      const lead = d.data()
      const u = lead.assignedTo || '__admin__'
      ;(byUser[u] = byUser[u] || []).push({ id: d.id, ...lead })
    })

    for (const [userName, leads] of Object.entries(byUser)) {
      const count = leads.length
      const tokens = userName === '__admin__'
        ? await tokensByRole('admin', 'sales')
        : await tokensByUserName(userName)

      const names = leads.slice(0, 3).map(l => l.clientName || 'Lead').join(', ')
      await send(tokens,
        { title: `📞 Follow-Up Due Today (${count})`, body: `${names}${count > 3 ? ` and ${count-3} more` : ''}` },
        { type: 'followup_reminder', count, channel: 'avant_reminders' }
      )
    }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED: Invoice Overdue Reminder
// Daily 9:30 AM IST (04:00 UTC)
// ─────────────────────────────────────────────────────────────────────────────

exports.invoiceOverdueReminder = onSchedule(
  { schedule: '0 4 * * *', timeZone: 'Asia/Kolkata', region: REGION },
  async () => {
    const today   = todayIST()
    const tokens  = await tokensByRole('admin', 'sales')
    const collections = ['invoices', 'taxInvoices', 'proformaInvoices']

    for (const coll of collections) {
      let docs = []
      try {
        const snap = await db.collection(coll)
          .where('dueDate', '<', today)
          .where('status', 'not-in', ['paid', 'cancelled']).get()
        docs = snap.docs
      } catch {
        const snap = await db.collection(coll).where('dueDate', '<', today).get()
        docs = snap.docs.filter(d => !['paid','cancelled'].includes(d.data().status))
      }

      if (!docs.length) continue
      const total = docs.length
      const amount = docs.reduce((s, d) => s + (d.data().grandTotal || d.data().total || 0), 0)

      await send(tokens,
        { title: `⚠️ ${total} Overdue Invoice${total > 1 ? 's' : ''}`, body: `Total outstanding: Rs.${amount.toLocaleString('en-IN')} across ${total} invoice${total > 1 ? 's' : ''}.` },
        { type: 'invoice_overdue', count: total, amount, collection: coll, channel: 'avant_reminders' }
      )
    }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED: Punch-In Reminder
// Daily 9:30 AM IST (04:00 UTC) — remind employees who haven't checked in yet
// ─────────────────────────────────────────────────────────────────────────────

// ── Reconnect request — admin pings a user to reconnect their location ─────────
exports.onReconnectRequestV2 = onDocumentUpdated(
  { document: 'technicianLocations/{userId}', region: REGION },
  async (event) => {
    const before = event.data.before.data() || {}
    const after  = event.data.after.data()  || {}
    const newReq  = after.reconnectRequest
    const prevReq = before.reconnectRequest
    if (!newReq?.at) return
    // Only fire when `reconnectRequest.at` actually changed
    if (prevReq?.at && prevReq.at.isEqual && prevReq.at.isEqual(newReq.at)) return
    const userId = event.params.userId
    const token  = await tokenByUserId(userId)
    if (!token) return
    const requestedBy = newReq.by || 'Admin'
    const userName    = after.userName || userId
    await send(
      [token],
      { title: '📍 Reconnect Location', body: `${requestedBy} has requested you to reconnect your location tracking.` },
      { type: 'reconnect_request', route: '/tracking', channel: 'avant_general', userId }
    )
  }
)

exports.punchInReminder = onSchedule(
  { schedule: '0 4 * * *', timeZone: 'Asia/Kolkata', region: REGION },
  async () => {
    const today = todayIST()

    const [empSnap, attSnap] = await Promise.all([
      db.collection('employees').get(),
      db.collection('attendance').where('date', '==', today).get(),
    ])

    const checkedInIds = new Set(
      attSnap.docs.map(d => d.data().employeeId || d.data().userId).filter(Boolean)
    )
    const checkedInNames = new Set(
      attSnap.docs.map(d => d.data().employeeName).filter(Boolean)
    )

    for (const empDoc of empSnap.docs) {
      const emp = empDoc.data()
      if (emp.status === 'inactive') continue
      if (emp.role === 'admin') continue
      if (checkedInIds.has(empDoc.id)) continue
      if (checkedInNames.has(emp.fullName || emp.username)) continue

      const token = await tokenByUserId(empDoc.id)
      if (!token) continue

      await send([token],
        { title: '⏰ Punch-In Reminder', body: 'You haven\'t marked your attendance yet today. Please check in now.' },
        { type: 'punch_in_reminder', date: today, channel: 'avant_reminders' }
      )
    }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED: Service / Repair / Installation Schedule Reminders
// Daily 8:00 AM IST — jobs with scheduledDate = tomorrow or today
// ─────────────────────────────────────────────────────────────────────────────

exports.serviceScheduleReminder = onSchedule(
  { schedule: '0 2 * * *', timeZone: 'Asia/Kolkata', region: REGION },
  async () => {
    const today    = todayIST()
    const tomorrow = addDays(today, 1)
    const collMap  = {
      repairActivities:       'Repair',
      installationActivities: 'Installation',
      modernisationActivities:'Modernisation',
    }

    for (const [coll, label] of Object.entries(collMap)) {
      let docs = []
      try {
        const snap = await db.collection(coll)
          .where('scheduledDate', 'in', [today, tomorrow])
          .where('status', 'not-in', ['completed','done','cancelled']).get()
        docs = snap.docs
      } catch {
        const snap = await db.collection(coll)
          .where('scheduledDate', 'in', [today, tomorrow]).get()
        docs = snap.docs.filter(d => !['completed','done','cancelled'].includes(d.data().status))
      }

      for (const d of docs) {
        const job   = d.data()
        const when  = job.scheduledDate === today ? 'Today' : 'Tomorrow'
        const names = [job.assignedTo, job.assignedTechnician, job.technicianName].filter(Boolean)
        const [techTokens, adminTokens] = await Promise.all([
          tokensByUserNames(names),
          tokensByRole('admin'),
        ])
        const body = `${when}: ${job.projectName || job.clientName || 'Job'} — ${job.liftType || job.issueType || label}`
        await send([...techTokens, ...adminTokens],
          { title: `📅 ${label} Scheduled ${when}`, body },
          { type: 'job_scheduled', docId: d.id, collection: coll, channel: 'avant_reminders' }
        )
      }
    }
  }
)


// ─────────────────────────────────────────────────────────────────────────────
// SECURITY ALERT — Suspicious Activity Detected
// ─────────────────────────────────────────────────────────────────────────────
exports.onSuspiciousActivity = onDocumentCreated(
  { document: 'suspiciousActivity/{alertId}', region: REGION },
  async (event) => {
    const data = event.data.data()
    const tokens = await tokensByRole('admin')
    if (!tokens.length) return

    const deletes = data.deleteCount || 0
    const fails   = data.failedVerifyAttempts || 0
    const who     = data.attemptedUsername || 'Unknown user'

    await send(
      tokens,
      {
        title: '🚨 Suspicious Activity Detected',
        body:  `${fails} failed verification attempts after ${deletes} deletes. User: ${who}. Session has been locked.`,
      },
      {
        type:    'security_alert',
        alertId: event.params.alertId,
        channel: 'avant_alerts',
      }
    )
  }
)

