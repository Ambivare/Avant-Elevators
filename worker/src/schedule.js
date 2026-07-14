/**
 * Scheduled job handlers — mirror of the Firebase Functions onSchedule triggers.
 * Called by the Workers cron scheduler; each job receives env for Firestore + FCM access.
 */

import { getAccessToken }                          from './auth.js'
import { queryEqual, queryWhere, getAll, getDoc }  from './firestore.js'
import { tokensByRole, tokenByUserId, tokensByUserName, tokensByUserNames } from './firestore.js'
import { send }                                    from './fcm.js'

// ── IST date helpers ─────────────────────────────────────────────────────────

function todayIST() {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function toDate(val) {
  if (!val) return null
  if (val instanceof Date) return val
  if (val.toDate) return val.toDate()
  return new Date(val)
}

// ── AMC Expiry Reminder — daily 9:00 AM IST ──────────────────────────────────

export async function runAmcExpiryReminder(env) {
  const token = await getAccessToken(env)
  const pid   = env.FIREBASE_PROJECT_ID
  const today = new Date()
  const docs  = await queryEqual(token, pid, 'amc', 'status', 'active')
  const tokens = await tokensByRole(token, pid, 'admin', 'sales')

  for (const amc of docs) {
    if (!amc.endDate) continue
    const end      = toDate(amc.endDate)
    if (!end) continue
    const daysLeft = Math.ceil((end - today) / 86_400_000)
    if (![1, 7, 30].includes(daysLeft)) continue
    const label = daysLeft === 1 ? 'Tomorrow' : `In ${daysLeft} days`
    await send(token, pid, tokens,
      { title: `⚠️ AMC Expiring ${label}`, body: `${amc.clientName || 'Client'} — ${amc.contractNumber || ''} expires ${label.toLowerCase()}` },
      { type: 'amc_expiry', docId: amc._id || '', daysLeft: String(daysLeft), channel: 'avant_reminders' })
  }
}

// ── AMC Installment Reminder — daily 9:05 AM IST ─────────────────────────────

const FREQ_MONTHS = { monthly: 1, 'bi-monthly': 2, quarterly: 3, '4-monthly': 4, 'half-yearly': 6, yearly: 12 }

export async function runAmcInstallmentReminder(env) {
  const token = await getAccessToken(env)
  const pid   = env.FIREBASE_PROJECT_ID
  const today = todayIST()
  const in3   = addDays(today, 3)
  const in7   = addDays(today, 7)

  // Query: paymentType == 'installments' AND status == 'active'
  const docs = await queryWhere(token, pid, 'amc', {
    compositeFilter: {
      op: 'AND',
      filters: [
        { fieldFilter: { field: { fieldPath: 'paymentType' }, op: 'EQUAL', value: { stringValue: 'installments' } } },
        { fieldFilter: { field: { fieldPath: 'status' },      op: 'EQUAL', value: { stringValue: 'active' } } },
      ],
    },
  })
  if (!docs.length) return

  const tokens = await tokensByRole(token, pid, 'admin', 'sales')

  for (const c of docs) {
    const total     = c.totalWithGST || c.contractValue || 0
    const dur       = c.durationMonths || 12
    const freq      = FREQ_MONTHS[c.frequency] || 3
    const count     = Math.max(1, Math.ceil(dur / freq))
    const amount    = Math.round(total / count)
    const startDate = c.startDate ? new Date(c.startDate + 'T00:00:00Z') : null
    const paid      = (c.paymentHistory || []).length

    for (let i = paid; i < count; i++) {
      if (!startDate) continue
      const d = new Date(startDate)
      d.setUTCMonth(d.getUTCMonth() + i * freq)
      const dueStr = d.toISOString().slice(0, 10)
      if (dueStr !== in3 && dueStr !== in7) continue
      const label = dueStr === in3 ? '3 days' : '7 days'
      await send(token, pid, tokens,
        { title: `💳 AMC Installment Due in ${label}`, body: `${c.clientName || 'Client'} — Installment ${i+1}/${count} of Rs.${amount.toLocaleString('en-IN')} due on ${dueStr}` },
        { type: 'amc_installment_due', docId: c._id || '', installmentNo: String(i+1), dueDate: dueStr, channel: 'avant_reminders' })
    }
  }
}

// ── Monthly Maintenance Reminder — 1st of month 8:00 AM IST ─────────────────

export async function runMaintenanceReminder(env) {
  const token = await getAccessToken(env)
  const pid   = env.FIREBASE_PROJECT_ID
  const docs  = await queryEqual(token, pid, 'amcMonthlyMaintenance', 'status', 'pending')
  if (!docs.length) return

  const byTech = {}
  docs.forEach(d => {
    const tech = d.assignedTo || d.technician || '__unassigned__'
    ;(byTech[tech] = byTech[tech] || []).push(d)
  })

  for (const [techName, jobs] of Object.entries(byTech)) {
    if (techName === '__unassigned__') continue
    const tkns  = await tokensByUserName(token, pid, techName)
    const count = jobs.length
    await send(token, pid, tkns,
      { title: '🔧 Maintenance Jobs Due This Month', body: `You have ${count} AMC maintenance job${count > 1 ? 's' : ''} pending.` },
      { type: 'maintenance_due', count: String(count), channel: 'avant_reminders' })
  }

  const adminTokens = await tokensByRole(token, pid, 'admin')
  await send(token, pid, adminTokens,
    { title: 'Monthly Maintenance Summary', body: `${docs.length} maintenance job${docs.length > 1 ? 's' : ''} pending this month.` },
    { type: 'maintenance_summary', count: String(docs.length), channel: 'avant_reminders' })
}

// ── Overdue Tasks Reminder — daily 8:00 AM IST ──────────────────────────────

export async function runOverdueTasksReminder(env) {
  const token = await getAccessToken(env)
  const pid   = env.FIREBASE_PROJECT_ID
  const today = todayIST()

  const docs = await queryWhere(token, pid, 'tasks', {
    fieldFilter: { field: { fieldPath: 'dueDate' }, op: 'LESS_THAN', value: { stringValue: today } },
  })
  const active = docs.filter(d => !['completed','done','cancelled'].includes(d.status))
  if (!active.length) return

  const byUser = {}
  active.forEach(d => { const u = d.assignedTo || ''; (byUser[u] = byUser[u] || []).push(d) })

  for (const [userName, tasks] of Object.entries(byUser)) {
    if (!userName) continue
    const tkns  = await tokensByUserName(token, pid, userName)
    const count = tasks.length
    await send(token, pid, tkns,
      { title: `⚠️ ${count} Overdue Task${count > 1 ? 's' : ''}`, body: `You have ${count} overdue task${count > 1 ? 's' : ''} awaiting attention.` },
      { type: 'overdue_tasks', count: String(count), channel: 'avant_reminders' })
  }

  const total       = active.length
  const adminTokens = await tokensByRole(token, pid, 'admin')
  await send(token, pid, adminTokens,
    { title: 'Overdue Tasks Summary', body: `${total} task${total > 1 ? 's are' : ' is'} overdue across all team members.` },
    { type: 'overdue_summary', count: String(total), channel: 'avant_reminders' })
}

// ── Lead Follow-Up Reminder — daily 8:30 AM IST ─────────────────────────────

export async function runLeadFollowUpReminder(env) {
  const token = await getAccessToken(env)
  const pid   = env.FIREBASE_PROJECT_ID
  const today = todayIST()

  const docs = await queryWhere(token, pid, 'leads', {
    compositeFilter: {
      op: 'AND',
      filters: [
        { fieldFilter: { field: { fieldPath: 'followUpDate' }, op: 'EQUAL', value: { stringValue: today } } },
        { fieldFilter: { field: { fieldPath: 'status' }, op: 'NOT_EQUAL', value: { stringValue: 'won' } } },
      ],
    },
  })
  const active = docs.filter(d => !['won','lost','closed'].includes(d.status))
  if (!active.length) return

  const byUser = {}
  active.forEach(d => { const u = d.assignedTo || '__admin__'; (byUser[u] = byUser[u] || []).push(d) })

  for (const [userName, leads] of Object.entries(byUser)) {
    const count  = leads.length
    const tkns   = userName === '__admin__'
      ? await tokensByRole(token, pid, 'admin', 'sales')
      : await tokensByUserName(token, pid, userName)
    const names  = leads.slice(0, 3).map(l => l.clientName || 'Lead').join(', ')
    await send(token, pid, tkns,
      { title: `📞 Follow-Up Due Today (${count})`, body: `${names}${count > 3 ? ` and ${count-3} more` : ''}` },
      { type: 'followup_reminder', count: String(count), channel: 'avant_reminders' })
  }
}

// ── Invoice Overdue Reminder — daily 9:30 AM IST ────────────────────────────

export async function runInvoiceOverdueReminder(env) {
  const token  = await getAccessToken(env)
  const pid    = env.FIREBASE_PROJECT_ID
  const today  = todayIST()
  const tokens = await tokensByRole(token, pid, 'admin', 'sales')

  for (const coll of ['invoices', 'taxInvoices', 'proformaInvoices']) {
    const docs = await queryWhere(token, pid, coll, {
      fieldFilter: { field: { fieldPath: 'dueDate' }, op: 'LESS_THAN', value: { stringValue: today } },
    })
    const overdue = docs.filter(d => !['paid','cancelled'].includes(d.status))
    if (!overdue.length) continue
    const total  = overdue.length
    const amount = overdue.reduce((s, d) => s + (d.grandTotal || d.total || 0), 0)
    await send(token, pid, tokens,
      { title: `⚠️ ${total} Overdue Invoice${total > 1 ? 's' : ''}`, body: `Total outstanding: Rs.${amount.toLocaleString('en-IN')} across ${total} invoice${total > 1 ? 's' : ''}.` },
      { type: 'invoice_overdue', count: String(total), amount: String(amount), collection: coll, channel: 'avant_reminders' })
  }
}

// ── Punch-In Reminder — daily 9:30 AM IST ───────────────────────────────────

export async function runPunchInReminder(env) {
  const token = await getAccessToken(env)
  const pid   = env.FIREBASE_PROJECT_ID
  const today = todayIST()

  const [employees, attDocs] = await Promise.all([
    getAll(token, pid, 'employees'),
    queryEqual(token, pid, 'attendance', 'date', today),
  ])

  const checkedInIds   = new Set(attDocs.map(d => d.employeeId || d.userId).filter(Boolean))
  const checkedInNames = new Set(attDocs.map(d => d.employeeName).filter(Boolean))

  for (const emp of employees) {
    if (emp.status === 'inactive') continue
    if (emp.role === 'admin') continue
    if (checkedInIds.has(emp._id)) continue
    if (checkedInNames.has(emp.fullName || emp.username)) continue
    const tkn = await tokenByUserId(token, pid, emp._id)
    if (!tkn) continue
    await send(token, pid, [tkn],
      { title: '⏰ Punch-In Reminder', body: "You haven't marked your attendance yet today. Please check in now." },
      { type: 'punch_in_reminder', date: today, channel: 'avant_reminders' })
  }
}

// ── Service Schedule Reminder — daily 8:00 AM IST ───────────────────────────

export async function runServiceScheduleReminder(env) {
  const token    = await getAccessToken(env)
  const pid      = env.FIREBASE_PROJECT_ID
  const today    = todayIST()
  const tomorrow = addDays(today, 1)

  const collMap = {
    repairActivities:        'Repair',
    installationActivities:  'Installation',
    modernisationActivities: 'Modernisation',
  }

  for (const [coll, label] of Object.entries(collMap)) {
    const docs = await queryWhere(token, pid, coll, {
      compositeFilter: {
        op: 'AND',
        filters: [
          { fieldFilter: { field: { fieldPath: 'scheduledDate' }, op: 'IN', value: { arrayValue: { values: [{ stringValue: today }, { stringValue: tomorrow }] } } } },
        ],
      },
    })
    const active = docs.filter(d => !['completed','done','cancelled'].includes(d.status))

    for (const job of active) {
      const when  = job.scheduledDate === today ? 'Today' : 'Tomorrow'
      const names = [job.assignedTo, job.assignedTechnician, job.technicianName].filter(Boolean)
      const [techTokens, adminTokens] = await Promise.all([
        tokensByUserNames(token, pid, names),
        tokensByRole(token, pid, 'admin'),
      ])
      const body = `${when}: ${job.projectName || job.clientName || 'Job'} — ${job.liftType || job.issueType || label}`
      await send(token, pid, [...techTokens, ...adminTokens],
        { title: `📅 ${label} Scheduled ${when}`, body },
        { type: 'job_scheduled', docId: job._id || '', collection: coll, channel: 'avant_reminders' })
    }
  }
}

// ── Daily Preventive Maintenance Alert — daily 10:00 AM IST ────────────────
// Sends per-contract notifications to assigned technicians for any AMC whose
// monthly maintenance hasn't been logged yet for the current month.

export async function runDailyPreventiveAlert(env) {
  const token      = await getAccessToken(env)
  const pid        = env.FIREBASE_PROJECT_ID
  const now        = new Date(Date.now() + 5.5 * 3600_000)  // IST
  const monthKey   = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

  const [allAmc, logsThisMonth] = await Promise.all([
    queryWhere(token, pid, 'amc', {
      fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } },
    }),
    queryWhere(token, pid, 'amcMonthlyMaintenance', {
      fieldFilter: { field: { fieldPath: 'monthKey' }, op: 'EQUAL', value: { stringValue: monthKey } },
    }),
  ])

  const doneIds = new Set(logsThisMonth.map(l => l.contractId).filter(Boolean))

  for (const amc of allAmc) {
    if (doneIds.has(amc._id)) continue   // already logged this month

    const techNames = [amc.technician, ...(amc.technicians || [])].filter(Boolean)
    if (!techNames.length) continue

    const techTokens = await tokensByUserNames(token, pid, techNames)
    if (!techTokens.length) continue

    const client  = amc.clientName || 'Client'
    const contractNo = amc.contractNumber || ''
    const freq    = amc.frequency || 'monthly'

    await send(token, pid, techTokens,
      {
        title: `🔧 Preventive Maintenance Due — ${client}`,
        body:  `${contractNo ? contractNo + ' · ' : ''}${freq} maintenance pending for ${client}. Please log your visit today.`,
      },
      { type: 'preventive_maintenance_due', docId: amc._id || '', monthKey, channel: 'avant_reminders' })
  }
}
