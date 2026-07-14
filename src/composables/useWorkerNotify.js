/**
 * Fire-and-forget notification dispatcher — replaces Firestore event triggers.
 *
 * Call after every Firestore write that should trigger a push notification.
 * Failures are silently swallowed; notifications are best-effort.
 *
 * Usage:
 *   import { notify } from '@/composables/useWorkerNotify'
 *
 *   // after creating a task:
 *   notify('task_created', { id: docId, assignedTo: 'John', title: 'Fix lift' })
 *
 *   // after updating a complaint (pass before + after):
 *   notify('complaint_assigned', after, before)
 */

const WORKER_URL    = import.meta.env.VITE_WORKER_URL    || ''
const WORKER_SECRET = import.meta.env.VITE_WORKER_SECRET || ''

/**
 * @param {string} type    - event type (see Worker notify.js switch cases)
 * @param {object} data    - document after the write (include id field)
 * @param {object} [before] - document before the write (for update events)
 */
export function notify(type, data = {}, before = {}) {
  if (!WORKER_URL) return

  fetch(`${WORKER_URL}/notify`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': WORKER_SECRET },
    body:    JSON.stringify({ type, data, before }),
  }).catch(() => {})  // silent — never block the UI
}

// ── Convenience wrappers ──────────────────────────────────────────────────────
// Import the one you need rather than the bare notify() if you prefer named calls.

export const notifyTaskCreated         = (d)    => notify('task_created',            d)
export const notifyTaskReassigned      = (d, b) => notify('task_reassigned',         d, b)
export const notifyTaskCompleted       = (d, b) => notify('task_completed',          d, b)

export const notifyLeadCreated         = (d)    => notify('lead_created',            d)
export const notifyLeadAssigned        = (d, b) => notify('lead_assigned',           d, b)
export const notifyLeadWon             = (d, b) => notify('lead_won',                d, b)

export const notifyComplaintCreated    = (d)    => notify('complaint_created',       d)
export const notifyComplaintAssigned   = (d, b) => notify('complaint_assigned',      d, b)
export const notifyComplaintResolved   = (d, b) => notify('complaint_resolved',      d, b)

export const notifyTicketCreated       = (d)    => notify('ticket_created',          d)

export const notifyInstallationCreated  = (d)    => notify('installation_created',    d)
export const notifyInstallationDone    = (d, b) => notify('installation_completed',  d, b)
export const notifyInstallationAssigned = (d, b) => notify('installation_reassigned', d, b)

export const notifyRepairCreated       = (d)    => notify('repair_created',          d)
export const notifyRepairDone          = (d, b) => notify('repair_completed',        d, b)
export const notifyRepairAssigned      = (d, b) => notify('repair_reassigned',       d, b)

export const notifyModernisationCreated = (d)    => notify('modernisation_created',  d)
export const notifyModernisationDone    = (d, b) => notify('modernisation_completed',d, b)
export const notifyModernisationAssigned = (d, b) => notify('modernisation_reassigned', d, b)

export const notifyProjectAssigned     = (d, b) => notify('project_assigned',        d, b)

export const notifyMaintenanceCreated  = (d)    => notify('maintenance_created',     d)

export const notifyAmcCreated          = (d)    => notify('amc_created',             d)
export const notifyAmcPayment          = (d, b) => notify('amc_payment',             d, b)

export const notifyAmcMonthlyLog       = (d)    => notify('amc_monthly_log_created', d)
export const notifyAmcMonthlyDone      = (d, b) => notify('amc_monthly_completed',   d, b)

export const notifyAttendanceCreated   = (d)    => notify('attendance_created',      d)
export const notifyAttendanceEdited    = (d, b) => notify('attendance_edited',       d, b)
export const notifyAttendanceCheckout  = (d, b) => notify('attendance_checkout',     d, b)

export const notifyQuotationCreated    = (d)    => notify('quotation_created',       d)
export const notifyProformaCreated     = (d)    => notify('proforma_created',        d)
export const notifyTaxInvoiceCreated   = (d)    => notify('tax_invoice_created',     d)
export const notifyInvoiceCreated      = (d)    => notify('invoice_created',         d)

export const notifyBomCreated          = (d)    => notify('bom_created',             d)

export const notifySalarySlipCreated   = (d)    => notify('salary_slip_created',     d)

export const notifyLeaveCreated        = (d)    => notify('leave_created',           d)
export const notifyLeaveDecision       = (d, b) => notify('leave_decision',          d, b)

export const notifyProjectCreated      = (d)    => notify('project_created',         d)
export const notifyProjectStatusChange = (d, b) => notify('project_status_changed',  d, b)

export const notifyPoCreated           = (d)    => notify('po_created',              d)

export const notifyReconnectRequest    = (d)    => notify('reconnect_request',       d)
export const notifySecurityAlert       = (d)    => notify('security_alert',          d)
