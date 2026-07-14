<template>
  <div class="page-container">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Leave Management</h1>
        <p class="page-subtitle">Transparent leave management for a balanced team.</p>
      </div>
      <div class="header-actions">
        <button class="btn-secondary btn-sm" @click="exportPDF">
          <FileDown :size="16" /> Export PDF
        </button>
        <button class="btn-primary" @click="openRequestModal">
          <Plus :size="16" /> Request Leave
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-nav">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
        <span class="tab-count">{{ getTabCount(tab.key) }}</span>
      </button>
    </div>

    <!-- Calendar Summary -->
    <div class="calendar-section glass">
      <div class="calendar-header">
        <button class="cal-nav-btn" @click="prevMonth">
          <ChevronLeft :size="16" />
        </button>
        <h3 class="cal-title">{{ calendarMonthLabel }}</h3>
        <button class="cal-nav-btn" @click="nextMonth">
          <ChevronRight :size="16" />
        </button>
      </div>
      <div class="cal-grid">
        <div class="cal-day-header" v-for="d in dayNames" :key="d">{{ d }}</div>
        <div
          v-for="cell in calendarCells"
          :key="cell.key"
          class="cal-cell"
          :class="{
            'cal-cell-other': !cell.inMonth,
            'cal-cell-today': cell.isToday,
          }"
        >
          <span class="cal-date-num">{{ cell.day }}</span>
          <div class="cal-markers">
            <span
              v-for="(leave, i) in cell.leaves"
              :key="i"
              class="cal-marker"
              :class="`leave-${leave.type}`"
              :title="`${leave.employeeName}: ${leave.leaveType}`"
            ></span>
          </div>
        </div>
      </div>
      <div class="cal-legend">
        <span v-for="lt in leaveTypeColors" :key="lt.key" class="legend-item">
          <span class="legend-dot" :class="`leave-${lt.key}`"></span>
          {{ lt.label }}
        </span>
      </div>
    </div>

    <!-- Table -->
    <div class="glass table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th v-if="isAdmin">Employee</th>
            <th>Leave Type</th>
            <th>From – To</th>
            <th>Days</th>
            <th>Status</th>
            <th>Reason</th>
            <th v-if="isAdmin">Approver</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredLeaves.length === 0">
            <td :colspan="isAdmin ? 8 : 7">
              <div class="empty-state">
                <CalendarOff :size="40" class="empty-icon" />
                <p>No leave requests found</p>
              </div>
            </td>
          </tr>
          <tr v-for="leave in filteredLeaves" :key="leave.id" style="cursor:pointer;" @click="openView(leave)">
            <td v-if="isAdmin">
              <div class="assignee-cell">
                <div class="avatar-sm">{{ getInitials(getEmployeeName(leave.employeeId)) }}</div>
                <span>{{ getEmployeeName(leave.employeeId) }}</span>
              </div>
            </td>
            <td>
              <span class="leave-type-badge" :class="`leave-type-${leave.leaveType?.toLowerCase()}`">
                {{ leave.leaveType }}
              </span>
            </td>
            <td>
              <div class="date-range">
                <span>{{ formatDate(leave.startDate) }}</span>
                <span class="date-arrow">→</span>
                <span>{{ formatDate(leave.endDate) }}</span>
              </div>
            </td>
            <td>
              <span class="days-badge">{{ leave.days }} day{{ leave.days !== 1 ? 's' : '' }}</span>
            </td>
            <td>
              <span class="badge" :class="getStatusBadge(leave.status)">{{ leave.status }}</span>
            </td>
            <td>
              <span class="reason-text" :title="leave.reason">{{ truncate(leave.reason, 40) }}</span>
            </td>
            <td v-if="isAdmin">
              <span class="text-muted-sm">{{ leave.approverName || '—' }}</span>
            </td>
            <td @click.stop>
              <div class="action-btns">
                <template v-if="isAdmin && leave.status === 'Pending'">
                  <button class="btn-success btn-sm icon-btn" @click="openApproveModal(leave, 'approve')" title="Approve">
                    <Check :size="14" />
                  </button>
                  <button class="btn-danger btn-sm icon-btn" @click="openApproveModal(leave, 'reject')" title="Reject">
                    <XCircle :size="14" />
                  </button>
                </template>
                <button
                  class="btn-danger btn-sm icon-btn"
                  @click="confirmDeleteLeave(leave)"
                  title="Delete"
                  v-if="canDeleteLeave(leave)"
                >
                  <Trash2 :size="14" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Leave Detail View Modal -->
    <AppModal v-model="showViewModal" :title="viewTarget ? getEmployeeName(viewTarget.employeeId) + ' — Leave Details' : 'Leave Details'" width="500px">
      <div v-if="viewTarget" style="display:flex;flex-direction:column;gap:14px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <span class="leave-type-badge" :class="`leave-type-${viewTarget.leaveType?.toLowerCase()}`">{{ viewTarget.leaveType }}</span>
          <span class="badge" :class="getStatusBadge(viewTarget.status)">{{ viewTarget.status }}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="vd-field"><div class="vd-label">From</div><div class="vd-val">{{ formatDate(viewTarget.startDate) }}</div></div>
          <div class="vd-field"><div class="vd-label">To</div><div class="vd-val">{{ formatDate(viewTarget.endDate) }}</div></div>
          <div class="vd-field"><div class="vd-label">Duration</div><div class="vd-val">{{ viewTarget.days }} day{{ viewTarget.days !== 1 ? 's' : '' }}</div></div>
          <div class="vd-field"><div class="vd-label">Approved By</div><div class="vd-val">{{ viewTarget.approverName || '—' }}</div></div>
          <div v-if="viewTarget.reason" class="vd-field" style="grid-column:1/-1;">
            <div class="vd-label">Reason</div>
            <div class="vd-val" style="white-space:pre-wrap;line-height:1.5;">{{ viewTarget.reason }}</div>
          </div>
          <div v-if="viewTarget.approvalRemarks" class="vd-field" style="grid-column:1/-1;">
            <div class="vd-label">Approval Remarks</div>
            <div class="vd-val" style="white-space:pre-wrap;line-height:1.5;">{{ viewTarget.approvalRemarks }}</div>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showViewModal = false">Close</button>
        <button v-if="isAdmin && viewTarget?.status === 'Pending'" class="btn-primary"
          @click="openApproveModal(viewTarget,'approve'); showViewModal = false">
          <Check :size="13"/> Approve / Reject
        </button>
      </template>
    </AppModal>

    <!-- Request Leave Modal -->
    <AppModal
      v-model="showRequestModal"
      title="Request Leave"
      subtitle="Submit a new leave request"
      width="580px"
    >
      <div class="form-grid">
        <div class="form-group">
          <label class="label">Leave Type <span class="required">*</span></label>
          <select v-model="form.leaveType" class="input" required>
            <option value="">Select type</option>
            <option value="Casual">Casual Leave</option>
            <option value="Sick">Sick Leave</option>
            <option value="Annual">Annual Leave</option>
            <option value="Unpaid">Unpaid Leave</option>
          </select>
        </div>
        <div class="form-group" v-if="isAdmin">
          <label class="label">Employee <span class="required">*</span></label>
          <select v-model="form.employeeId" class="input" required>
            <option value="">Select employee</option>
            <option v-for="emp in employees" :key="emp.id" :value="emp.id">{{ emp.fullName }}</option>
          </select>
        </div>
        <div class="form-group" v-else>
          <label class="label">Requesting As</label>
          <div class="input employee-display">
            <div class="avatar-sm" style="width:22px;height:22px;font-size:9px;flex-shrink:0;">{{ getInitials(authStore.user?.fullName || authStore.user?.username) }}</div>
            <span>{{ authStore.user?.fullName || authStore.user?.username || 'You' }}</span>
          </div>
        </div>
        <div class="form-group">
          <label class="label">Start Date <span class="required">*</span></label>
          <input v-model="form.startDate" type="date" class="input" @change="calcDays" required />
        </div>
        <div class="form-group">
          <label class="label">End Date <span class="required">*</span></label>
          <input v-model="form.endDate" type="date" class="input" @change="calcDays" required />
        </div>
        <div class="form-group">
          <label class="label">Number of Days</label>
          <input :value="form.days" type="number" class="input" readonly />
        </div>
        <div class="form-group" style="grid-column: 1 / -1">
          <label class="label">Reason <span class="required">*</span></label>
          <textarea v-model="form.reason" class="input" rows="3" placeholder="Reason for leave..." required />
        </div>
        <div class="form-group" style="grid-column: 1 / -1">
          <label class="label">Attachment Note</label>
          <input v-model="form.attachmentNote" type="text" class="input" placeholder="e.g. Medical certificate attached" />
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showRequestModal = false">Cancel</button>
        <button class="btn-primary" @click="submitLeave" :disabled="saving">
          <Loader2 v-if="saving" :size="16" class="spin" />
          Submit Request
        </button>
      </template>
    </AppModal>

    <!-- Approve/Reject Modal -->
    <AppModal
      v-model="showApproveModal"
      :title="approvalAction === 'approve' ? 'Approve Leave' : 'Reject Leave'"
      width="480px"
    >
      <div class="approval-info" v-if="selectedLeave">
        <div class="info-row">
          <span class="info-label">Employee</span>
          <span class="info-value">{{ getEmployeeName(selectedLeave.employeeId) }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Leave Type</span>
          <span class="info-value">{{ selectedLeave.leaveType }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Duration</span>
          <span class="info-value">{{ formatDate(selectedLeave.startDate) }} – {{ formatDate(selectedLeave.endDate) }} ({{ selectedLeave.days }} days)</span>
        </div>
        <div class="divider"></div>
        <div class="form-group">
          <label class="label">Remarks</label>
          <textarea v-model="approvalRemarks" class="input" rows="3" :placeholder="approvalAction === 'approve' ? 'Approval remarks (optional)' : 'Reason for rejection...'" />
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showApproveModal = false">Cancel</button>
        <button
          :class="approvalAction === 'approve' ? 'btn-success' : 'btn-danger'"
          @click="processApproval"
          :disabled="saving"
        >
          <Loader2 v-if="saving" :size="16" class="spin" />
          {{ approvalAction === 'approve' ? 'Approve' : 'Reject' }}
        </button>
      </template>
    </AppModal>

    <!-- Delete Confirm -->
    <ConfirmDialog
      v-model="showDeleteDialog"
      title="Delete Leave Request"
      message="Are you sure you want to delete this leave request?"
      confirmLabel="Delete"
      :danger="true"
      @confirm="deleteLeave"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  Plus, FileDown, ChevronLeft, ChevronRight, Check, XCircle,
  Trash2, Loader2, CalendarOff
} from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { getAll, create, update, remove } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { useUIStore } from '@/stores/ui'
import { useActivityStore } from '@/stores/activity'
import { usePDF } from '@/composables/usePDF'
import { useAuthStore } from '@/stores/auth'

const uiStore = useUIStore()
const activity = useActivityStore()
const { exportTablePDF } = usePDF()
const authStore = useAuthStore()

const leaves = ref([])
const employees = ref([])
const loading = ref(false)
const saving = ref(false)

const activeTab = ref('all')
const showRequestModal = ref(false)
const showApproveModal = ref(false)
const showDeleteDialog = ref(false)
const showViewModal = ref(false)
const viewTarget = ref(null)
const selectedLeave = ref(null)
function openView(leave) { viewTarget.value = leave; showViewModal.value = true }
const leaveToDelete = ref(null)
const approvalAction = ref('approve')
const approvalRemarks = ref('')

// Calendar state
const calYear = ref(new Date().getFullYear())
const calMonth = ref(new Date().getMonth())

const defaultForm = {
  leaveType: '',
  employeeId: '',
  startDate: '',
  endDate: '',
  days: 0,
  reason: '',
  attachmentNote: '',
}
const form = ref({ ...defaultForm })

const isAdmin = computed(() => authStore.role === 'admin' || authStore.can('canApproveLeave'))
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const leaveTypeColors = [
  { key: 'casual', label: 'Casual' },
  { key: 'sick', label: 'Sick' },
  { key: 'annual', label: 'Annual' },
  { key: 'unpaid', label: 'Unpaid' },
]

const tabs = computed(() => {
  if (isAdmin.value) {
    return [
      { key: 'all', label: 'All Requests' },
      { key: 'pending', label: 'Pending Approval' },
      { key: 'approved', label: 'Approved' },
      { key: 'rejected', label: 'Rejected' },
    ]
  }
  return [{ key: 'mine', label: 'My Requests' }]
})

function getTabLeaves(tabKey) {
  const uid = authStore.user?.id || authStore.user?.uid || authStore.user?.username
  switch (tabKey) {
    case 'all': return leaves.value
    case 'pending': return leaves.value.filter(l => l.status === 'Pending')
    case 'approved': return leaves.value.filter(l => l.status === 'Approved')
    case 'rejected': return leaves.value.filter(l => l.status === 'Rejected')
    case 'mine': return leaves.value.filter(l => l.createdBy === uid || l.employeeId === uid)
    default: return leaves.value
  }
}

const filteredLeaves = computed(() => getTabLeaves(activeTab.value))

function getTabCount(tabKey) {
  return getTabLeaves(tabKey).length
}

// Calendar
const calendarMonthLabel = computed(() => {
  return new Date(calYear.value, calMonth.value, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
})

const calendarCells = computed(() => {
  const year = calYear.value
  const month = calMonth.value
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date().toISOString().slice(0, 10)
  const cells = []

  // Previous month padding
  const prevDays = new Date(year, month, 0).getDate()
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevDays - i
    cells.push({ key: `prev-${d}`, day: d, inMonth: false, isToday: false, leaves: [] })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayLeaves = leaves.value.filter(l => {
      if (!l.startDate || !l.endDate) return false
      return l.startDate <= dateStr && l.endDate >= dateStr && l.status === 'Approved'
    }).map(l => ({
      type: l.leaveType?.toLowerCase() || 'casual',
      leaveType: l.leaveType,
      employeeName: getEmployeeName(l.employeeId),
    }))
    cells.push({ key: `cur-${d}`, day: d, inMonth: true, isToday: dateStr === today, leaves: dayLeaves })
  }

  // Next month padding to complete grid (6 rows)
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    cells.push({ key: `next-${d}`, day: d, inMonth: false, isToday: false, leaves: [] })
  }
  return cells
})

function prevMonth() {
  if (calMonth.value === 0) { calMonth.value = 11; calYear.value-- }
  else calMonth.value--
}

function nextMonth() {
  if (calMonth.value === 11) { calMonth.value = 0; calYear.value++ }
  else calMonth.value++
}

function getEmployeeName(id) {
  if (!id) return '—'
  const emp = employees.value.find(e => e.id === id)
  return emp?.fullName || id
}

function getInitials(name) {
  if (!name || name === '—') return '?'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function formatDate(d) {
  if (!d) return '—'
  const dt = new Date(d + 'T00:00:00')
  if (isNaN(dt.getTime())) return '—'
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${dt.getFullYear()}`
}

function truncate(str, len) {
  if (!str) return '—'
  return str.length > len ? str.slice(0, len) + '…' : str
}

function getStatusBadge(status) {
  switch (status) {
    case 'Approved': return 'badge-active'
    case 'Rejected': return 'badge-danger'
    case 'Pending': return 'badge-warning'
    default: return 'badge-info'
  }
}

function canDeleteLeave(leave) {
  if (isAdmin.value) return true
  const uid = authStore.user?.id || authStore.user?.uid || authStore.user?.username
  return leave.createdBy === uid && leave.status === 'Pending'
}

function calcDays() {
  if (form.value.startDate && form.value.endDate) {
    const start = new Date(form.value.startDate)
    const end = new Date(form.value.endDate)
    const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
    form.value.days = diff > 0 ? diff : 0
  }
}

function openRequestModal() {
  form.value = { ...defaultForm }
  if (!isAdmin.value) {
    form.value.employeeId = authStore.user?.id || authStore.user?.uid || ''
  }
  showRequestModal.value = true
}

async function submitLeave() {
  // For non-admin, auto-fill employeeId if missing
  if (!isAdmin.value && !form.value.employeeId) {
    form.value.employeeId = authStore.user?.id || authStore.user?.username || 'self'
  }
  if (!form.value.leaveType || !form.value.startDate || !form.value.endDate || !form.value.reason) {
    uiStore.error('Please fill all required fields')
    return
  }
  saving.value = true
  try {
    const payload = {
      ...form.value,
      status: 'Pending',
      createdBy: authStore.user?.id || authStore.user?.username || 'unknown',
      employeeName: authStore.user?.fullName || authStore.user?.username || '',
      createdAt: new Date().toISOString(),
    }
    const id = await create(Collections.LEAVE, payload)
    leaves.value.push({ id, ...payload })
    activity.log({ action: 'created', module: 'leave', tab: 'Leave', summary: `Submitted leave request: ${payload.leaveType} (${payload.startDate} to ${payload.endDate})`, details: { leaveType: payload.leaveType, startDate: payload.startDate, endDate: payload.endDate, days: payload.days, employeeName: payload.employeeName } })
    uiStore.success('Leave request submitted')
    showRequestModal.value = false
  } catch {
    uiStore.error('Failed to submit leave request')
  } finally {
    saving.value = false
  }
}

function openApproveModal(leave, action) {
  selectedLeave.value = leave
  approvalAction.value = action
  approvalRemarks.value = ''
  showApproveModal.value = true
}

async function processApproval() {
  if (!selectedLeave.value) return
  saving.value = true
  try {
    const newStatus = approvalAction.value === 'approve' ? 'Approved' : 'Rejected'
    const payload = {
      status: newStatus,
      approverName: authStore.user?.fullName || authStore.user?.username || 'Admin',
      approverRemarks: approvalRemarks.value,
      processedAt: new Date().toISOString(),
    }
    await update(Collections.LEAVE, selectedLeave.value.id, payload)
    const idx = leaves.value.findIndex(l => l.id === selectedLeave.value.id)
    if (idx !== -1) leaves.value[idx] = { ...leaves.value[idx], ...payload }
    const leaveAction = approvalAction.value === 'approve' ? 'approved' : 'rejected'
    activity.log({ action: leaveAction, module: 'leave', tab: 'Leave', summary: `${newStatus} leave for ${selectedLeave.value.employeeName || selectedLeave.value.employeeId}`, details: { employeeName: selectedLeave.value.employeeName, leaveType: selectedLeave.value.leaveType, startDate: selectedLeave.value.startDate, endDate: selectedLeave.value.endDate, remarks: approvalRemarks.value } })
    uiStore.success(`Leave ${newStatus.toLowerCase()} successfully`)
    showApproveModal.value = false
  } catch {
    uiStore.error('Failed to process leave')
  } finally {
    saving.value = false
  }
}

function confirmDeleteLeave(leave) {
  leaveToDelete.value = leave
  showDeleteDialog.value = true
}

async function deleteLeave() {
  if (!leaveToDelete.value) return
  try {
    await remove(Collections.LEAVE, leaveToDelete.value.id)
    leaves.value = leaves.value.filter(l => l.id !== leaveToDelete.value.id)
    activity.log({ action: 'deleted', module: 'leave', tab: 'Leave', summary: `Deleted leave request for ${leaveToDelete.value.employeeName || leaveToDelete.value.employeeId}`, details: { employeeName: leaveToDelete.value.employeeName, leaveType: leaveToDelete.value.leaveType, startDate: leaveToDelete.value.startDate, endDate: leaveToDelete.value.endDate } })
    uiStore.success('Leave request deleted')
  } catch {
    uiStore.error('Failed to delete leave request')
  } finally {
    leaveToDelete.value = null
  }
}

async function exportPDF() {
  await exportTablePDF({
    title: 'Leave Report',
    subtitle: activeTab.value !== 'all' ? `Tab: ${activeTab.value}` : '',
    columns: ['Employee', 'Leave Type', 'From', 'To', 'Days', 'Status', 'Reason'],
    rows: filteredLeaves.value.map(l => [
      getEmployeeName(l.employeeId),
      l.leaveType || '—',
      formatDate(l.startDate),
      formatDate(l.endDate),
      l.days || '—',
      l.status || '—',
      l.reason || '—',
    ]),
    filename: `leave-report-${new Date().toISOString().slice(0, 7)}`,
    orientation: 'landscape',
    accentColor: [6, 182, 212],
    ui: { success: uiStore.success, error: uiStore.error },
  })
}

onMounted(async () => {
  loading.value = true
  try {
    const [l, e] = await Promise.all([
      getAll(Collections.LEAVE),
      getAll(Collections.EMPLOYEES),
    ])
    leaves.value = l
    employees.value = e
    if (!isAdmin.value) activeTab.value = 'mine'
  } catch {
    uiStore.error('Failed to load leave data')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-container { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
.page-subtitle { font-size: 13px; color:var(--ct-muted); margin-top: 4px; }
.header-actions { display: flex; align-items: center; gap: 10px; }

.tabs-nav { display: flex; gap: 4px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.tab-btn { padding: 8px 16px; font-size: 13px; color:var(--ct-muted); background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
.tab-btn.active { color: #6366f1; border-bottom-color: #6366f1; }
.tab-count { background: rgba(99,102,241,0.15); color: #6366f1; font-size: 11px; padding: 1px 7px; border-radius: 10px; }

/* Calendar */
.calendar-section { padding: 20px; border-radius: 14px; }
.calendar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.cal-title { font-size: 15px; font-weight: 600; color:var(--ct-primary); }
.cal-nav-btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); color:var(--ct-sub); width: 30px; height: 30px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
.cal-nav-btn:hover { background: rgba(255,255,255,0.1); color:var(--ct-primary); }

.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.cal-day-header { text-align: center; font-size: 11px; font-weight: 600; color:var(--ct-muted); padding: 6px 4px; text-transform: uppercase; letter-spacing: 0.5px; }
.cal-cell { padding: 6px 4px; min-height: 52px; border-radius: 6px; background: rgba(255,255,255,0.02); border: 1px solid transparent; transition: all 0.15s; }
.cal-cell-other { opacity: 0.3; }
.cal-cell-today { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.08); }
.cal-date-num { font-size: 12px; color:var(--ct-sub); display: block; text-align: center; margin-bottom: 3px; }
.cal-cell-today .cal-date-num { color: #818cf8; font-weight: 600; }
.cal-markers { display: flex; flex-wrap: wrap; gap: 2px; justify-content: center; }
.cal-marker { width: 8px; height: 8px; border-radius: 50%; }
.leave-casual { background: #6366f1; }
.leave-sick { background: #ef4444; }
.leave-annual { background: #22c55e; }
.leave-unpaid { background: #f97316; }

.cal-legend { display: flex; gap: 16px; margin-top: 12px; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color:var(--ct-muted); }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

/* Table */
.data-table { width: 100%; border-collapse: collapse; }
.data-table th { font-size: 12px; color:var(--ct-muted); font-weight: 500; padding: 10px 14px; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.06); text-align: left; }
.data-table td { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 13px; color:var(--ct-secondary); vertical-align: middle; }
.data-table tr:last-child td { border-bottom: none; }

.assignee-cell { display: flex; align-items: center; gap: 8px; }
.avatar-sm { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: white; flex-shrink: 0; }

.leave-type-badge { font-size: 11px; font-weight: 500; padding: 3px 8px; border-radius: 6px; }
.leave-type-casual { background: rgba(99,102,241,0.15); color: #818cf8; }
.leave-type-sick { background: rgba(239,68,68,0.15); color: #f87171; }
.leave-type-annual { background: rgba(34,197,94,0.15); color: #4ade80; }
.leave-type-unpaid { background: rgba(249,115,22,0.15); color: #fb923c; }

.date-range { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.date-arrow { color:var(--ct-muted); }

.days-badge { background: rgba(148,163,184,0.1); color:var(--ct-sub); font-size: 12px; padding: 2px 8px; border-radius: 6px; }
.reason-text { font-size: 12px; color:var(--ct-muted); }
.text-muted-sm { font-size: 12px; color:var(--ct-muted); }

.action-btns { display: flex; gap: 6px; }
.icon-btn { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; padding: 0; }

.empty-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px; color:var(--ct-muted); }
.empty-icon { opacity: 0.35; }

/* Approval modal */
.approval-info { display: flex; flex-direction: column; gap: 14px; }
.info-row { display: flex; justify-content: space-between; align-items: center; }
.info-label { font-size: 13px; color:var(--ct-muted); }
.info-value { font-size: 13px; color:var(--ct-primary); font-weight: 500; }
.divider { height: 1px; background: rgba(255,255,255,0.07); }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.required { color: #ef4444; }

.employee-display { display: flex; align-items: center; gap: 8px; cursor: default; }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Light theme ── */
[data-theme="light"] .cal-title { color: #1e293b; }
[data-theme="light"] .cal-nav-btn {
  background: rgba(0,0,0,0.06);
  border-color: rgba(0,0,0,0.12);
  color:var(--ct-muted);
}
[data-theme="light"] .cal-nav-btn:hover { background: rgba(0,0,0,0.1); color: #1e293b; }
[data-theme="light"] .cal-day-header { color:var(--ct-muted); }
[data-theme="light"] .cal-cell {
  background: rgba(255,255,255,0.6);
  border-color: rgba(0,0,0,0.05);
}
[data-theme="light"] .cal-cell-today {
  border-color: rgba(99,102,241,0.45);
  background: rgba(99,102,241,0.08);
}
[data-theme="light"] .cal-date-num { color:var(--ct-muted); }
[data-theme="light"] .cal-cell-today .cal-date-num { color: #4f46e5; }
[data-theme="light"] .legend-item { color:var(--ct-muted); }
[data-theme="light"] .data-table th {
  color:var(--ct-muted);
  background: rgba(0,0,0,0.03);
  border-bottom-color: rgba(0,0,0,0.08);
}
[data-theme="light"] .data-table td {
  color: #1e293b;
  border-bottom-color: rgba(0,0,0,0.05);
}
[data-theme="light"] .info-value { color: #1e293b; }
[data-theme="light"] .divider { background: rgba(0,0,0,0.08); }
</style>
