/**
 * Event-based notification dispatcher.
 *
 * Called from the Vue client after each Firestore write:
 *   POST /notify  { type: 'task_created', data: { ... } }
 *
 * Mirrors the Firebase Functions onCreate/onUpdate triggers.
 * All failures are swallowed — notifications are best-effort.
 */

import { getAccessToken }                          from './auth.js'
import { tokensByRole, tokenByUserId, tokensByUserName, tokensByUserNames } from './firestore.js'
import { send }                                    from './fcm.js'

export async function handleNotify(request, env) {
  let body
  try { body = await request.json() } catch { return ok() }

  const { type, data = {}, before = {} } = body

  try {
    const token = await getAccessToken(env)
    const pid   = env.FIREBASE_PROJECT_ID
    await dispatch(token, pid, type, data, before)
  } catch (e) {
    console.error('[notify] dispatch error:', e.message)
  }

  return ok()
}

// ── Token helpers bound to a request's access token ──────────────────────────

function makeFs(token, pid) {
  return {
    byRole:  (...roles)  => tokensByRole(token, pid, ...roles),
    byId:    (id)        => tokenByUserId(token, pid, id),
    byName:  (name)      => tokensByUserName(token, pid, name),
    byNames: (names)     => tokensByUserNames(token, pid, names),
    send:    (tokens, notification, data) => send(token, pid, tokens, notification, data),
  }
}

// ── Event dispatcher ──────────────────────────────────────────────────────────

async function dispatch(token, pid, type, d, b) {
  const fs = makeFs(token, pid)

  switch (type) {

    // ── Tasks ──────────────────────────────────────────────────────────────
    case 'task_created': {
      if (!d.assignedTo) return
      const tokens = await fs.byName(d.assignedTo)
      return fs.send(tokens,
        { title: 'New Task Assigned', body: d.title || d.description || 'You have a new task.' },
        { type, docId: d.id || '', channel: 'avant_assignments' })
    }

    case 'task_reassigned': {
      if (!d.assignedTo || d.assignedTo === b.assignedTo) return
      const tokens = await fs.byName(d.assignedTo)
      return fs.send(tokens,
        { title: 'Task Assigned to You', body: d.title || 'A task has been assigned to you.' },
        { type: 'task_assigned', docId: d.id || '', channel: 'avant_assignments' })
    }

    case 'task_completed': {
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'Task Completed', body: `${d.title || 'Task'} marked complete by ${d.assignedTo || 'team'}.` },
        { type, docId: d.id || '', channel: 'avant_updates' })
    }

    // ── Leads ──────────────────────────────────────────────────────────────
    case 'lead_created': {
      const names = d.assignedTo ? [d.assignedTo] : []
      const [admin, name] = await Promise.all([fs.byRole('admin'), fs.byNames(names)])
      return fs.send([...admin, ...name],
        { title: '🆕 New Lead', body: `${d.clientName || d.name || 'New lead'}${d.source ? ' via ' + d.source : ''}` },
        { type, docId: d.id || '', channel: 'avant_assignments' })
    }

    case 'lead_assigned': {
      if (!d.assignedTo || d.assignedTo === b.assignedTo) return
      const tokens = await fs.byName(d.assignedTo)
      return fs.send(tokens,
        { title: 'Lead Assigned to You', body: `${d.clientName || 'Lead'} has been assigned to you.` },
        { type, docId: d.id || '', channel: 'avant_assignments' })
    }

    case 'lead_won': {
      const positiveStatuses = ['won', 'qualified', 'converted']
      if (!positiveStatuses.includes(d.status) || positiveStatuses.includes(b.status)) return
      const tokens = await fs.byRole('admin')
      const s = d.status
      return fs.send(tokens,
        { title: `Lead ${s.charAt(0).toUpperCase() + s.slice(1)}! 🎉`, body: `${d.clientName || 'Lead'} has been marked as ${s}.` },
        { type, docId: d.id || '', channel: 'avant_updates' })
    }

    // ── Complaints ─────────────────────────────────────────────────────────
    case 'complaint_created': {
      const tokens = await fs.byRole('admin', 'technician')
      return fs.send(tokens,
        { title: '🚨 New Complaint', body: `${d.clientName || 'Client'} — ${d.issueType || d.type || 'Issue'} (${d.priority || 'normal'} priority)` },
        { type, docId: d.id || '', channel: 'avant_alerts' })
    }

    case 'complaint_assigned': {
      if (!d.assignedTo || d.assignedTo === b.assignedTo) return
      const tokens = await fs.byName(d.assignedTo)
      return fs.send(tokens,
        { title: 'Complaint Assigned to You', body: `${d.clientName || 'Client'} — ${d.issueType || 'Issue'}. Please attend promptly.` },
        { type, docId: d.id || '', channel: 'avant_assignments' })
    }

    case 'complaint_resolved': {
      const resolved = ['resolved', 'closed', 'done']
      if (!resolved.includes(d.status) || resolved.includes(b.status)) return
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'Complaint Resolved ✓', body: `${d.clientName || 'Client'} complaint resolved by ${d.assignedTo || 'team'}.` },
        { type, docId: d.id || '', channel: 'avant_updates' })
    }

    // ── QR Tickets ─────────────────────────────────────────────────────────
    case 'ticket_created': {
      const tokens = await fs.byRole('admin')
      const ref    = d.ticketRef || (d.id || '').slice(0, 8).toUpperCase()
      const lift   = d.liftId ? ` · Lift ${d.liftId}` : ''
      return fs.send(tokens,
        { title: `🎫 New QR Ticket — ${ref}`, body: `${d.reporterName || 'Anonymous'}${lift} — ${d.issueType || 'Issue reported'}` },
        { type, docId: d.id || '', ticketRef: ref, channel: 'avant_alerts' })
    }

    // ── Installation ────────────────────────────────────────────────────────
    case 'installation_created': {
      const names = [d.assignedTo, d.assignedTechnician, d.technicianName].filter(Boolean)
      const [tech, admin] = await Promise.all([fs.byNames(names), fs.byRole('admin')])
      if (tech.length) await fs.send(tech,
        { title: '🔧 Installation Assigned to You', body: `${d.projectName || d.clientName || 'Project'} — ${d.liftType || 'Lift'} installation. Report at site.` },
        { type: 'installation_assigned', docId: d.id || '', channel: 'avant_assignments' })
      return fs.send(admin,
        { title: 'New Installation Scheduled', body: `${d.projectName || d.clientName || 'Installation'} assigned to ${names[0] || 'technician'}.` },
        { type, docId: d.id || '', channel: 'avant_updates' })
    }

    case 'installation_reassigned': {
      const newNames = [d.assignedTo, d.assignedTechnician, d.technicianName].filter(Boolean)
      const oldNames = [b.assignedTo, b.assignedTechnician, b.technicianName].filter(Boolean)
      const added = newNames.filter(n => !oldNames.includes(n))
      if (!added.length) return
      const tech = await fs.byNames(added)
      return fs.send(tech,
        { title: '🔧 Installation Assigned to You', body: `${d.projectName || d.clientName || 'Project'} — ${d.liftType || 'Lift'} installation job has been assigned to you.` },
        { type: 'installation_assigned', docId: d.id || '', channel: 'avant_assignments' })
    }

    case 'installation_completed': {
      const done = ['completed', 'done', 'finished']
      if (!done.includes(d.status) || done.includes(b.status)) return
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'Installation Completed ✓', body: `${d.projectName || d.clientName || 'Installation'} marked complete.` },
        { type, docId: d.id || '', channel: 'avant_updates' })
    }

    // ── Repair ─────────────────────────────────────────────────────────────
    case 'repair_created': {
      const names = [d.assignedTo, d.assignedTechnician, d.technicianName].filter(Boolean)
      const [tech, admin] = await Promise.all([fs.byNames(names), fs.byRole('admin')])
      if (tech.length) await fs.send(tech,
        { title: '🔨 Repair Job Assigned to You', body: `${d.projectName || d.clientName || 'Site'} — ${d.issueType || d.type || 'Repair'}. Please attend promptly.` },
        { type: 'repair_assigned', docId: d.id || '', channel: 'avant_assignments' })
      return fs.send(admin,
        { title: 'New Repair Job Created', body: `${d.projectName || d.clientName || 'Repair'} logged.` },
        { type, docId: d.id || '', channel: 'avant_updates' })
    }

    case 'repair_reassigned': {
      const newNames = [d.assignedTo, d.assignedTechnician, d.technicianName].filter(Boolean)
      const oldNames = [b.assignedTo, b.assignedTechnician, b.technicianName].filter(Boolean)
      const added = newNames.filter(n => !oldNames.includes(n))
      if (!added.length) return
      const tech = await fs.byNames(added)
      return fs.send(tech,
        { title: '🔨 Repair Job Assigned to You', body: `${d.projectName || d.clientName || 'Site'} — ${d.issueType || d.type || 'Repair'} has been assigned to you.` },
        { type: 'repair_assigned', docId: d.id || '', channel: 'avant_assignments' })
    }

    case 'repair_completed': {
      const done = ['completed', 'done']
      if (!done.includes(d.status) || done.includes(b.status)) return
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'Repair Completed ✓', body: `${d.projectName || d.clientName || 'Repair'} completed by ${d.assignedTo || 'technician'}.` },
        { type, docId: d.id || '', channel: 'avant_updates' })
    }

    // ── Modernisation ──────────────────────────────────────────────────────
    case 'modernisation_created': {
      const names = [d.assignedTo, d.assignedTechnician].filter(Boolean)
      const [tech, admin] = await Promise.all([fs.byNames(names), fs.byRole('admin')])
      if (tech.length) await fs.send(tech,
        { title: '⚙️ Modernisation Assigned to You', body: `${d.projectName || d.clientName || 'Project'} modernisation job has been assigned to you.` },
        { type: 'modernisation_assigned', docId: d.id || '', channel: 'avant_assignments' })
      return fs.send(admin,
        { title: 'Modernisation Scheduled', body: `${d.projectName || d.clientName || 'Modernisation'} assigned to ${names[0] || 'technician'}.` },
        { type, docId: d.id || '', channel: 'avant_updates' })
    }

    case 'modernisation_reassigned': {
      const newNames = [d.assignedTo, d.assignedTechnician].filter(Boolean)
      const oldNames = [b.assignedTo, b.assignedTechnician].filter(Boolean)
      const added = newNames.filter(n => !oldNames.includes(n))
      if (!added.length) return
      const tech = await fs.byNames(added)
      return fs.send(tech,
        { title: '⚙️ Modernisation Assigned to You', body: `${d.projectName || d.clientName || 'Project'} modernisation job has been assigned to you.` },
        { type: 'modernisation_assigned', docId: d.id || '', channel: 'avant_assignments' })
    }

    case 'modernisation_completed': {
      const done = ['completed', 'done']
      if (!done.includes(d.status) || done.includes(b.status)) return
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'Modernisation Complete ✓', body: `${d.projectName || d.clientName || 'Job'} modernisation completed.` },
        { type, docId: d.id || '', channel: 'avant_updates' })
    }

    // ── Project Assignment ─────────────────────────────────────────────────
    case 'project_assigned': {
      const newTechs = [d.assignedTechnician, d.installedBy, ...(d.technicians || [])].filter(Boolean)
      const oldTechs = [b.assignedTechnician, b.installedBy, ...(b.technicians || [])].filter(Boolean)
      const added = newTechs.filter(n => !oldTechs.includes(n))
      if (!added.length) return
      const tech = await fs.byNames(added)
      return fs.send(tech,
        { title: '🏗️ Project Assigned to You', body: `${d.projectName || d.clientName || 'Project'} — ${d.projectType || d.type || 'Project'} has been assigned to you.` },
        { type: 'project_assigned', docId: d.id || '', channel: 'avant_assignments' })
    }

    // ── Maintenance ────────────────────────────────────────────────────────
    case 'maintenance_created': {
      const names = [d.technicianName, d.assignedTo, d.assignedTechnician].filter(Boolean)
      const dateStr = d.scheduledDate ? ` on ${d.scheduledDate}` : ''
      const project = d.projectName || d.clientName || 'Site'
      const [tech, admin] = await Promise.all([fs.byNames(names), fs.byRole('admin')])
      if (tech.length) await fs.send(tech,
        { title: '🔧 Maintenance Scheduled for You', body: `${project}${dateStr} — ${d.maintenanceType || 'Routine'} maintenance.` },
        { type: 'job_scheduled', docId: d.id || '', channel: 'avant_assignments' })
      return fs.send(admin,
        { title: 'Maintenance Scheduled', body: `${project} — ${d.maintenanceType || 'Maintenance'} scheduled${dateStr}.` },
        { type: 'maintenance_scheduled', docId: d.id || '', channel: 'avant_updates' })
    }

    // ── AMC ────────────────────────────────────────────────────────────────
    case 'amc_created': {
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'New AMC Contract', body: `${d.clientName || 'Client'} — ${d.contractNumber || ''} | Value: Rs.${Number(d.totalWithGST || d.contractValue || 0).toLocaleString('en-IN')}` },
        { type, docId: d.id || '', channel: 'avant_updates' })
    }

    case 'amc_payment': {
      const prevLen = (b.paymentHistory || []).length
      const newLen  = (d.paymentHistory || []).length
      if (newLen <= prevLen) return
      const latest = d.paymentHistory[newLen - 1]
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'AMC Payment Received 💰', body: `${d.clientName || 'Client'} — Rs.${Number(latest?.amount || 0).toLocaleString('en-IN')} via ${latest?.method || 'cash'}` },
        { type, docId: d.id || '', channel: 'avant_updates' })
    }

    // ── AMC Monthly Maintenance ────────────────────────────────────────────
    case 'amc_monthly_log_created': {
      const tokens = await fs.byRole('admin')
      const loc = [d.buildingName, d.wingName, d.liftNo ? 'Lift ' + d.liftNo : ''].filter(Boolean).join(' · ')
      return fs.send(tokens,
        { title: 'Maintenance Logged ✓', body: `${d.clientName || 'Contract'} — ${d.monthKey || ''}${loc ? ' | ' + loc : ''} by ${d.technician || d.completedBy || 'Tech'}` },
        { type, docId: d.id || '', channel: 'avant_updates' })
    }

    case 'amc_monthly_completed': {
      const done = ['completed', 'done']
      if (!done.includes(d.status) || done.includes(b.status)) return
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'Monthly Maintenance Done ✓', body: `${d.projectName || d.clientName || 'Maintenance'} completed by ${d.technician || d.assignedTo || 'technician'}.` },
        { type, docId: d.id || '', channel: 'avant_updates' })
    }

    // ── Attendance ─────────────────────────────────────────────────────────
    case 'attendance_created': {
      const tokens = await fs.byRole('admin')
      let timeStr = '—'; let isLate = false
      if (d.checkInTime) {
        const t = d.checkInTime instanceof Date ? d.checkInTime : new Date(d.checkInTime)
        if (!isNaN(t)) {
          const istH = (t.getUTCHours() + 5) % 24
          const istM = (t.getUTCMinutes() + 30) % 60
          isLate  = istH * 60 + istM > 10 * 60
          timeStr = `${String(istH).padStart(2,'0')}:${String(istM).padStart(2,'0')}`
        }
      }
      if (isLate) {
        return fs.send(tokens,
          { title: '⏰ Late Check-In', body: `${d.employeeName || 'Employee'} checked in at ${timeStr} (late).` },
          { type: 'attendance_late', docId: d.id || '', employeeId: d.employeeId || '', channel: 'avant_alerts' })
      }
      return fs.send(tokens,
        { title: 'Employee Checked In', body: `${d.employeeName || 'Employee'} checked in at ${timeStr}.` },
        { type: 'attendance_checkin', docId: d.id || '', employeeId: d.employeeId || '', channel: 'avant_general' })
    }

    case 'attendance_edited': {
      if (!b.adminEdited && d.adminEdited && d.employeeId) {
        const token = await fs.byId(d.employeeId)
        if (token) return fs.send([token],
          { title: 'Attendance Record Updated', body: `Your attendance for ${d.date || 'a recent date'} was updated by admin.` },
          { type, docId: d.id || '', channel: 'avant_updates' })
      }
      break
    }

    case 'attendance_checkout': {
      if (b.checkOutTime || !d.checkOutTime) return
      const tokens = await fs.byRole('admin')
      let timeStr = '—'
      const t = d.checkOutTime instanceof Date ? d.checkOutTime : new Date(d.checkOutTime)
      if (!isNaN(t)) {
        const istH = (t.getUTCHours() + 5) % 24
        const istM = (t.getUTCMinutes() + 30) % 60
        timeStr = `${String(istH).padStart(2,'0')}:${String(istM).padStart(2,'0')}`
      }
      return fs.send(tokens,
        { title: 'Employee Checked Out', body: `${d.employeeName || 'Employee'} checked out at ${timeStr}.` },
        { type, docId: d.id || '', channel: 'avant_general' })
    }

    // ── Quotations & Invoices ──────────────────────────────────────────────
    case 'quotation_created': {
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'New Quotation Created', body: `${d.clientName || 'Client'} — ${d.docNumber || ''} | Rs.${Number(d.grandTotal || d.total || 0).toLocaleString('en-IN')}` },
        { type, docId: d.id || '', channel: 'avant_updates' })
    }

    case 'proforma_created':
    case 'tax_invoice_created':
    case 'invoice_created': {
      const label  = type === 'proforma_created' ? 'Proforma Invoice' : type === 'tax_invoice_created' ? 'Tax Invoice' : 'Invoice'
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: `New ${label}`, body: `${d.clientName || 'Client'} — ${d.docNumber || ''} | Rs.${Number(d.grandTotal || d.total || 0).toLocaleString('en-IN')}` },
        { type: 'invoice_created', docId: d.id || '', channel: 'avant_updates' })
    }

    // ── BOM ────────────────────────────────────────────────────────────────
    case 'bom_created': {
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'New BOM Created', body: `${d.bomNumber || ''} — ${d.clientName || d.projectName || 'Project'} | Items: ${(d.items || []).length}` },
        { type, docId: d.id || '', channel: 'avant_updates' })
    }

    // ── Salary Slips ───────────────────────────────────────────────────────
    case 'salary_slip_created': {
      const empToken = d.employeeId ? await fs.byId(d.employeeId) : null
      if (empToken) await fs.send([empToken],
        { title: 'Salary Slip Generated 💵', body: `Your salary slip for ${d.month || d.period || 'the month'} is ready. Net Pay: Rs.${Number(d.netPay || 0).toLocaleString('en-IN')}` },
        { type: 'salary_slip', docId: d.id || '', channel: 'avant_updates' })
      const hrTokens = await fs.byRole('admin', 'hr')
      return fs.send(hrTokens,
        { title: 'Salary Slip Created', body: `${d.employeeName || 'Employee'} — ${d.month || d.period || ''} | Rs.${Number(d.netPay || 0).toLocaleString('en-IN')}` },
        { type: 'salary_slip_admin', docId: d.id || '', channel: 'avant_updates' })
    }

    // ── Leave Requests ─────────────────────────────────────────────────────
    case 'leave_created': {
      const tokens = await fs.byRole('admin', 'hr')
      return fs.send(tokens,
        { title: 'Leave Request Submitted', body: `${d.employeeName || 'Employee'} — ${d.leaveType || 'Leave'} from ${d.startDate || ''} to ${d.endDate || d.startDate || ''}` },
        { type, docId: d.id || '', channel: 'avant_alerts' })
    }

    case 'leave_decision': {
      const decided = ['approved', 'rejected']
      if (!decided.includes(d.status) || decided.includes(b.status)) return
      const empToken   = d.employeeId ? await fs.byId(d.employeeId) : null
      const nameTokens = d.employeeName ? await fs.byName(d.employeeName) : []
      const all        = [...(empToken ? [empToken] : []), ...nameTokens]
      const approved   = d.status === 'approved'
      return fs.send(all,
        {
          title: approved ? 'Leave Approved ✓' : 'Leave Rejected ✗',
          body:  `Your ${d.leaveType || 'leave'} request (${d.startDate || ''}) has been ${d.status}.`,
        },
        { type, docId: d.id || '', channel: approved ? 'avant_updates' : 'avant_alerts' })
    }

    // ── Projects ───────────────────────────────────────────────────────────
    case 'project_created': {
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'New Project Added', body: `${d.projectName || d.name || 'New Project'} — ${d.clientName || ''}` },
        { type, docId: d.id || '', channel: 'avant_updates' })
    }

    case 'project_status_changed': {
      if (d.status === b.status) return
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: `Project: ${d.status}`, body: `${d.projectName || d.name || 'Project'} status changed to ${d.status}.` },
        { type: 'project_status', docId: d.id || '', channel: 'avant_updates' })
    }

    // ── Purchase Orders ────────────────────────────────────────────────────
    case 'po_created': {
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: 'New Purchase Order', body: `PO ${d.poNumber || ''} — ${d.vendorName || d.vendor || 'Vendor'} | Rs.${Number(d.total || d.grandTotal || 0).toLocaleString('en-IN')}` },
        { type, docId: d.id || '', channel: 'avant_updates' })
    }

    // ── Reconnect request ─────────────────────────────────────────────────
    case 'reconnect_request': {
      if (!d.userId) return
      const token = await fs.byId(d.userId)
      if (!token) return
      return fs.send([token],
        { title: '📍 Reconnect Location', body: `${d.requestedBy || 'Admin'} has requested you to reconnect your location tracking.` },
        { type, route: '/tracking', channel: 'avant_general', userId: d.userId })
    }

    // ── Security alert ─────────────────────────────────────────────────────
    case 'security_alert': {
      const tokens = await fs.byRole('admin')
      return fs.send(tokens,
        { title: '🚨 Suspicious Activity Detected', body: `${d.failedVerifyAttempts || 0} failed verifications after ${d.deleteCount || 0} deletes. User: ${d.attemptedUsername || 'Unknown'}.` },
        { type, alertId: d.alertId || '', channel: 'avant_alerts' })
    }

    default:
      console.warn('[notify] unknown event type:', type)
  }
}

function ok() {
  return new Response(JSON.stringify({ ok: true }), {
    status:  200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
