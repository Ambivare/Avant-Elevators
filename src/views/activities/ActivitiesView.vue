<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <Activity :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          Activity Log
        </h1>
        <p class="page-sub">Every action, every change — the complete system-wide audit trail.</p>
      </div>
      <button v-if="section === 'log'" class="btn-secondary" @click="loadActivities" :disabled="activityLoading">
        <Loader2 v-if="activityLoading" :size="14" style="animation:spin 1s linear infinite;" />
        <RefreshCw v-else :size="14" />
        Refresh
      </button>
    </div>

    <!-- Sub-tabs -->
    <div class="act-tabs">
      <button class="act-tab" :class="{ active: section === 'log' }" @click="section = 'log'">
        <Activity :size="15" /> Activity Log
      </button>
      <button class="act-tab" :class="{ active: section === 'project' }" @click="section = 'project'">
        <FolderKanban :size="15" /> Project Activities
      </button>
    </div>

    <template v-if="section === 'log'">
    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card"><div class="stat-val accent">{{ activityStore.activities.length }}</div><div class="stat-lbl">Total</div></div>
      <div class="stat-card"><div class="stat-val green">{{ todayCount }}</div><div class="stat-lbl">Today</div></div>
      <div class="stat-card"><div class="stat-val yellow">{{ uniqueUsers.length }}</div><div class="stat-lbl">Users</div></div>
      <div class="stat-card"><div class="stat-val purple">{{ uniqueModules.length }}</div><div class="stat-lbl">Modules</div></div>
    </div>

    <!-- Filters -->
    <div class="filters-bar">
      <div class="search-box" style="flex:2;min-width:200px;">
        <Search :size="14" class="search-icon" />
        <input v-model="search" class="input" placeholder="Search activities, users, modules…" />
      </div>
      <select v-model="moduleFilter" class="input filter-sel">
        <option value="">All Modules</option>
        <option v-for="m in uniqueModules" :key="m" :value="m">{{ moduleLabel(m) }}</option>
      </select>
      <select v-model="actionFilter" class="input filter-sel">
        <option value="">All Actions</option>
        <option v-for="a in uniqueActions" :key="a" :value="a">{{ a }}</option>
      </select>
      <select v-model="userFilter" class="input filter-sel">
        <option value="">All Users</option>
        <option v-for="u in uniqueUsers" :key="u" :value="u">{{ u }}</option>
      </select>
      <input v-model="dateFrom" class="input" type="date" style="width:140px;" title="From date" />
      <input v-model="dateTo" class="input" type="date" style="width:140px;" title="To date" />
    </div>

    <!-- Activity Cards -->
    <div v-if="activityLoading" style="text-align:center;padding:60px;color:var(--ct-muted);">
      <Loader2 :size="28" style="animation:spin 1s linear infinite;" />
      <div style="margin-top:12px;font-size:13px;">Loading activities…</div>
    </div>
    <div v-else-if="pagedActivities.length === 0" class="empty-state">
      <Activity :size="40" />
      <p>No activities found</p>
    </div>
    <div v-else class="activity-list">
      <div
        v-for="act in pagedActivities"
        :key="act.id || act.timestamp"
        class="activity-card"
        :class="{ expanded: expandedId === act.id }"
        @click="toggle(act.id)"
      >
        <!-- Card header row -->
        <div class="card-row">
          <div :class="['action-badge', actionClass(act.action)]">
            <component :is="actionIcon(act.action)" :size="12" />
            {{ act.action }}
          </div>
          <div class="card-summary">
            {{ act.summary || act.action }}
          </div>
          <div class="card-meta">
            <div class="user-chip">
              <div class="user-av">{{ initials(act.user) }}</div>
              <div>
                <div class="user-name">{{ act.user || '—' }}</div>
                <div class="user-role">{{ act.role || '' }}</div>
              </div>
            </div>
            <div class="card-time">{{ fmtTime(act.timestamp) }}</div>
            <div class="card-module-tag">
              <span class="mod-badge">{{ moduleLabel(act.module) }}</span>
              <span v-if="act.tab" class="tab-label"> › {{ act.tab }}</span>
            </div>
            <span v-if="act.undone" class="undone-badge">Undone</span>
            <button v-else-if="canUndo(act)" class="undo-btn" @click.stop="startUndo(act)" title="Undo this action (admin only)">
              <RotateCcw :size="11" /> Undo
            </button>
            <ChevronDown :size="14" class="expand-icon" :class="{ rotated: expandedId === act.id }" />
          </div>
        </div>

        <!-- Expanded details -->
        <transition name="expand">
          <div v-if="expandedId === act.id" class="card-details" @click.stop>
            <div class="details-grid">
              <template v-for="(val, key) in cleanDetails(act.details)" :key="key">
                <div class="detail-key">{{ humanKey(key) }}</div>
                <div class="detail-val">{{ val }}</div>
              </template>
            </div>
            <div class="details-meta-row">
              <span><strong>User:</strong> {{ act.user }} ({{ act.role }})</span>
              <span v-if="act.userId"><strong>ID:</strong> {{ act.userId }}</span>
              <span><strong>Time:</strong> {{ fmtTimeFull(act.timestamp) }}</span>
              <span v-if="act.tab"><strong>Tab:</strong> {{ act.tab }}</span>
              <span v-if="act.undone" style="color:#f87171;"><strong>Undone by</strong> {{ act.undoneBy }} at {{ act.undoneAt ? fmtTimeFull(act.undoneAt) : '—' }}</span>
              <span v-else-if="act.undoable && act.undoExpiresAt" :style="undoExpired(act) ? 'color:var(--ct-muted)' : 'color:#fbbf24'">
                {{ undoExpired(act) ? 'Undo window closed' : 'Undo available · ' + undoRemaining(act) }}
              </span>
            </div>
          </div>
        </transition>
      </div>
    </div>

    <!-- Undo Confirmation Modal -->
    <Teleport to="body">
      <div v-if="undoTarget" class="undo-backdrop" @click="cancelUndo">
        <div class="undo-modal" @click.stop>
          <div class="undo-modal-header">
            <RotateCcw :size="18" style="color:#fbbf24;" />
            <span>Undo Action</span>
          </div>
          <div class="undo-modal-body">
            <p class="undo-summary">{{ undoTarget.summary }}</p>
            <p class="undo-hint">This will reverse the action and restore the previous state. Enter your admin password to confirm.</p>
            <div style="position:relative;">
              <input
                v-model="undoPassword"
                ref="undoPasswordRef"
                type="password"
                class="input"
                placeholder="Admin password"
                style="width:100%;"
                @keyup.enter="confirmUndo"
                @keyup.esc="cancelUndo"
              />
            </div>
            <div v-if="undoError" class="undo-error">{{ undoError }}</div>
          </div>
          <div class="undo-modal-footer">
            <button class="btn-danger" @click="confirmUndo" :disabled="undoLoading || !undoPassword">
              <Loader2 v-if="undoLoading" :size="13" style="animation:spin 1s linear infinite;" />
              <RotateCcw v-else :size="13" />
              Confirm Undo
            </button>
            <button class="btn-secondary" @click="cancelUndo" :disabled="undoLoading">Cancel</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Pagination -->
    <div class="table-footer" v-if="filtered.length > pageSize">
      <span class="table-count">{{ (page-1)*pageSize+1 }}–{{ Math.min(page*pageSize, filtered.length) }} of {{ filtered.length }}</span>
      <div class="pagination">
        <button class="page-btn" :disabled="page<=1" @click="page--"><ChevronLeft :size="14"/></button>
        <span class="page-num">{{ page }} / {{ totalPages }}</span>
        <button class="page-btn" :disabled="page>=totalPages" @click="page++"><ChevronRight :size="14"/></button>
      </div>
    </div>
    </template>

    <!-- ══════════════════ Project Activities ══════════════════ -->
    <template v-else>
      <div class="proj-search-bar">
        <div class="search-box" style="flex:1;min-width:220px;position:relative;">
          <Search :size="14" class="search-icon" />
          <input
            v-model="projectSearch"
            class="input"
            placeholder="Search project by name, client or city…"
            @focus="showProjectDropdown = true"
            @blur="delayCloseProjectDropdown"
          />
          <div v-if="showProjectDropdown && filteredProjectsForSearch.length" class="proj-dd">
            <div
              v-for="p in filteredProjectsForSearch"
              :key="p.id"
              class="proj-dd-item"
              :class="{ active: selectedProjectId === p.id }"
              @mousedown.prevent="selectProject(p)"
            >
              <div class="proj-dd-name">{{ p.projectName }}</div>
              <div class="proj-dd-sub">{{ p.clientName || '—' }} · {{ p.city || p.address || '—' }}</div>
            </div>
          </div>
        </div>
        <button
          class="btn-primary"
          :disabled="!selectedProjectId || pdfGenerating || projectDataLoading"
          @click="downloadProjectReport"
        >
          <Loader2 v-if="pdfGenerating" :size="14" style="animation:spin 1s linear infinite;" />
          <FileDown v-else :size="14" />
          {{ pdfGenerating ? 'Generating…' : 'Download PDF Report' }}
        </button>
      </div>

      <div v-if="!selectedProjectId" class="empty-state">
        <FolderKanban :size="40" />
        <p>Search and select a project above to see everything linked to it.</p>
      </div>

      <div v-else-if="projectDataLoading" style="text-align:center;padding:60px;color:var(--ct-muted);">
        <Loader2 :size="28" style="animation:spin 1s linear infinite;" />
        <div style="margin-top:12px;font-size:13px;">Loading project activities…</div>
      </div>

      <div v-else>
        <!-- Project summary card -->
        <div class="proj-summary-card">
          <div class="proj-summary-main">
            <div class="proj-summary-name">{{ selectedProject.projectName }}</div>
            <div class="proj-summary-sub">{{ selectedProject.clientName || '—' }} · {{ selectedProject.address || selectedProject.city || '—' }}</div>
          </div>
          <div class="proj-summary-stats">
            <div v-for="s in projectStatSummary" :key="s.label" class="proj-summary-stat">
              <div class="proj-summary-stat-val">{{ s.count }}</div>
              <div class="proj-summary-stat-lbl">{{ s.label }}</div>
            </div>
          </div>
        </div>

        <!-- Record sections -->
        <div v-for="group in projectRecordGroups" :key="group.key" class="proj-section">
          <div class="proj-section-head">
            <component :is="group.icon" :size="16" :style="{ color: group.color }" />
            <span class="proj-section-title">{{ group.label }}</span>
            <span class="proj-section-count">{{ group.records.length }}</span>
          </div>
          <div v-if="!group.records.length" class="proj-section-empty">No {{ group.label.toLowerCase() }} for this project.</div>
          <div v-else class="proj-record-list">
            <div
              v-for="rec in group.records"
              :key="rec.id"
              class="proj-record-card"
              :class="{ expanded: expandedRecordId === rec.id }"
              @click="expandedRecordId = expandedRecordId === rec.id ? null : rec.id"
            >
              <div class="proj-record-row">
                <span class="status-pill" :class="statusPillClass(rec.status)">{{ formatStatusLabel(rec.status) }}</span>
                <div class="proj-record-title">{{ rec.title }}</div>
                <div class="proj-record-meta">
                  <span v-if="rec.person">{{ rec.person }}</span>
                  <span class="proj-record-date">{{ fmtDateShort(rec.date) }}</span>
                </div>
                <ChevronDown :size="14" class="expand-icon" :class="{ rotated: expandedRecordId === rec.id }" />
              </div>
              <transition name="expand">
                <div v-if="expandedRecordId === rec.id" class="proj-record-details" @click.stop>
                  <div class="details-grid">
                    <template v-for="(val, key) in rec.details" :key="key">
                      <div class="detail-key">{{ key }}</div>
                      <div class="detail-val">{{ val }}</div>
                    </template>
                  </div>
                  <!-- Nested AMC visits -->
                  <div v-if="rec.visits && rec.visits.length" class="proj-nested-visits">
                    <div class="proj-nested-head">Maintenance Visits ({{ rec.visits.length }})</div>
                    <div v-for="v in rec.visits" :key="v.id" class="proj-nested-row">
                      <span>{{ v.monthKey || '—' }}</span>
                      <span>{{ fmtDateShort(v.date) }}</span>
                      <span>{{ v.technician || '—' }}</span>
                      <span class="proj-nested-remarks">{{ v.remarks || '—' }}</span>
                    </div>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import {
  Activity, Search, RefreshCw, ChevronLeft, ChevronRight, ChevronDown,
  Plus, Pencil, Trash2, CheckCircle, XCircle, RotateCcw, Upload,
  FileText, DollarSign, AlertCircle, Settings, LogIn, LogOut, Loader2,
  FolderKanban, FileDown, MessageSquareWarning, HardHat, Hammer, Wrench, ShieldCheck,
} from 'lucide-vue-next'
import { useActivityStore } from '@/stores/activity'
import { useAuthStore } from '@/stores/auth'
import { useSecurityStore } from '@/stores/security'
import { useUIStore } from '@/stores/ui'
import { getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { usePDF } from '@/composables/usePDF'
import { savePDF } from '@/utils/saveFile'

const activityStore = useActivityStore()
const auth = useAuthStore()
const security = useSecurityStore()
const ui = useUIStore()
const activityLoading = ref(false)
const expandedId = ref(null)

const section = ref('log') // 'log' | 'project'

const isAdmin = computed(() => auth.role === 'admin')

// ── Undo state ────────────────────────────────────────────────────────────────
const undoTarget = ref(null)
const undoPassword = ref('')
const undoError = ref('')
const undoLoading = ref(false)
const undoPasswordRef = ref(null)

function canUndo(act) {
  if (!isAdmin.value) return false
  if (!act.undoable || act.undone) return false
  if (!act.undoExpiresAt) return false
  return Date.now() < act.undoExpiresAt
}

function undoExpired(act) {
  return !act.undoExpiresAt || Date.now() >= act.undoExpiresAt
}

function undoRemaining(act) {
  if (!act.undoExpiresAt) return ''
  const ms = act.undoExpiresAt - Date.now()
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

async function startUndo(act) {
  undoTarget.value = act
  undoPassword.value = ''
  undoError.value = ''
  await nextTick()
  undoPasswordRef.value?.focus()
}

function cancelUndo() {
  undoTarget.value = null
  undoPassword.value = ''
  undoError.value = ''
}

async function confirmUndo() {
  if (!undoPassword.value || !undoTarget.value) return
  undoLoading.value = true
  undoError.value = ''
  try {
    const username = auth.user?.username || auth.user?.fullName || ''
    const ok = await security.verifyPassword(username, undoPassword.value)
    if (!ok) {
      undoError.value = 'Incorrect password. Try again.'
      undoLoading.value = false
      return
    }
    const result = await activityStore.executeUndo(undoTarget.value.id, undoTarget.value.undoData)
    if (result.success) {
      ui.showToast('Action undone successfully.', 'success')
      cancelUndo()
    } else {
      undoError.value = result.error || 'Undo failed. Please try again.'
    }
  } catch (e) {
    undoError.value = e.message || 'Undo failed.'
  } finally {
    undoLoading.value = false
  }
}

const search = ref('')
const moduleFilter = ref('')
const actionFilter = ref('')
const userFilter = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const page = ref(1)
const pageSize = 50

function toggle(id) {
  expandedId.value = expandedId.value === id ? null : id
  if (expandedId.value) page.value = page.value // keep page
}

async function loadActivities() {
  activityLoading.value = true
  await activityStore.load()
  activityLoading.value = false
}
onMounted(loadActivities)

const activities = computed(() => activityStore.activities)
const today = new Date().toISOString().slice(0, 10)
const todayCount = computed(() => activities.value.filter(a => (a.timestamp || '').startsWith(today)).length)
const uniqueModules = computed(() => [...new Set(activities.value.map(a => a.module).filter(Boolean))].sort())
const uniqueActions = computed(() => [...new Set(activities.value.map(a => a.action).filter(Boolean))].sort())
const uniqueUsers = computed(() => [...new Set(activities.value.map(a => a.user).filter(Boolean))].sort())

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return activities.value.filter(a => {
    if (q && ![a.action, a.user, a.module, a.summary, a.tab].filter(Boolean).join(' ').toLowerCase().includes(q)) return false
    if (moduleFilter.value && a.module !== moduleFilter.value) return false
    if (actionFilter.value && a.action !== actionFilter.value) return false
    if (userFilter.value && a.user !== userFilter.value) return false
    if (dateFrom.value && (a.timestamp || '') < dateFrom.value) return false
    if (dateTo.value && (a.timestamp || '') > dateTo.value + 'Z') return false
    return true
  })
})

const totalPages = computed(() => Math.ceil(filtered.value.length / pageSize) || 1)
const pagedActivities = computed(() => {
  const s = (page.value - 1) * pageSize
  return filtered.value.slice(s, s + pageSize)
})

const MODULE_LABELS = {
  quotations: 'Quotations', proformaInvoices: 'Proforma Invoices',
  taxInvoices: 'Tax Invoices', purchaseOrders: 'Purchase Orders',
  projects: 'Projects', amc: 'AMC', amcMonthlyMaintenance: 'AMC Visits',
  inventory: 'Inventory', inventoryUsage: 'Inventory Usage',
  installationActivities: 'Installation', modernisationActivities: 'Modernisation',
  repairActivities: 'Repairs', complaintActivities: 'Complaints',
  maintenance: 'Maintenance', employees: 'HR', salarySlips: 'Salary',
  leaveRequests: 'Leave', tasks: 'Tasks', leads: 'Sales',
  vendors: 'Vendors', bom: 'BOM', configurations: 'Configurations',
  attendance: 'Attendance', users: 'Settings', inspections: 'Inspection',
}
const moduleLabel = (m) => MODULE_LABELS[m] || m || '—'

const ACTION_CLASSES = {
  created: 'act-create', updated: 'act-update', deleted: 'act-delete',
  approved: 'act-approve', rejected: 'act-reject', completed: 'act-complete',
  converted: 'act-convert', imported: 'act-import', exported: 'act-export',
  payment: 'act-payment', renewed: 'act-renew', action: 'act-default',
}
const actionClass = (a) => ACTION_CLASSES[a] || 'act-default'

const ACTION_ICONS = {
  created: Plus, updated: Pencil, deleted: Trash2,
  approved: CheckCircle, rejected: XCircle, completed: CheckCircle,
  converted: RotateCcw, imported: Upload, exported: FileText,
  payment: DollarSign, renewed: RotateCcw, action: AlertCircle,
}
const actionIcon = (a) => ACTION_ICONS[a] || Activity

const initials = (name) => (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

const fmtTime = (ts) => {
  if (!ts) return '—'
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffMin < 1440) return `${Math.floor(diffMin/60)}h ago`
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' })
}
const fmtTimeFull = (ts) => {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })
}

const KEY_LABELS = {
  id: 'Record ID', clientName: 'Client', projectName: 'Project', docNumber: 'Document No.',
  amount: 'Amount', total: 'Total', status: 'Status', employeeName: 'Employee',
  username: 'Username', role: 'Role', bomNumber: 'BOM No.', linkedProjectId: 'Linked Project',
  linkedBomId: 'Linked BOM', subtotal: 'Subtotal', gstAmount: 'GST', fromStatus: 'From Status',
  toStatus: 'To Status', serviceType: 'Service Type', liftType: 'Lift Type',
  location: 'Location', floor: 'Floor', itemName: 'Item', quantity: 'Quantity',
  assignedTo: 'Assigned To', dueDate: 'Due Date', priority: 'Priority',
  leaveType: 'Leave Type', days: 'Days', reason: 'Reason',
  checkIn: 'Check In', checkOut: 'Check Out', date: 'Date',
  month: 'Month', year: 'Year', paymentAmount: 'Payment',
  contractNo: 'Contract No.', renewalDate: 'Renewal Date',
  vendorName: 'Vendor', category: 'Category', numberOfLifts: 'No. of Lifts',
  liftDescription: 'Lift Type', reportNo: 'Report No.', templateChanged: 'Template Changed',
  provider: 'LLM Provider', model: 'LLM Model',
}
const humanKey = (k) => KEY_LABELS[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()

function cleanDetails(d) {
  if (!d || typeof d !== 'object') return {}
  const skip = new Set(['id', 'tab', 'summary'])
  const result = {}
  for (const [k, v] of Object.entries(d)) {
    if (skip.has(k) || v === null || v === undefined || v === '') continue
    if (typeof v === 'object') result[k] = JSON.stringify(v)
    else result[k] = String(v)
  }
  return result
}

// ══════════════════════ Project Activities ══════════════════════════════════
const { _drawHeader, _drawFooter, _sectionLabel, _infoGrid, _toRs, _C, _MARGIN, _getCtx } = usePDF()

const projectsCache = ref([])
const complaintsCache = ref([])
const installationsCache = ref([])
const modernisationCache = ref([])
const repairsCache = ref([])
const amcCache = ref([])
const amcVisitsCache = ref([])
const maintenanceCache = ref([])
const projectDataLoading = ref(false)
let projectDataPromise = null

function ensureProjectData() {
  if (projectDataPromise) return projectDataPromise
  projectDataLoading.value = true
  projectDataPromise = Promise.all([
    getAll(Collections.PROJECTS),
    getAll(Collections.COMPLAINTS),
    getAll(Collections.INSTALLATION),
    getAll(Collections.MODERNISATION),
    getAll(Collections.REPAIRS),
    getAll(Collections.AMC),
    getAll(Collections.AMC_MONTHLY),
    getAll(Collections.MAINTENANCE),
  ]).then(([projects, complaints, installations, modernisations, repairs, amc, amcVisits, maintenance]) => {
    projectsCache.value = projects
    complaintsCache.value = complaints
    installationsCache.value = installations
    modernisationCache.value = modernisations
    repairsCache.value = repairs
    amcCache.value = amc
    amcVisitsCache.value = amcVisits
    maintenanceCache.value = maintenance
  }).finally(() => { projectDataLoading.value = false })
  return projectDataPromise
}

watch(section, (val) => { if (val === 'project') ensureProjectData() })

const projectSearch = ref('')
const showProjectDropdown = ref(false)
const selectedProjectId = ref('')
const expandedRecordId = ref(null)
const pdfGenerating = ref(false)

const filteredProjectsForSearch = computed(() => {
  const q = projectSearch.value.trim().toLowerCase()
  return projectsCache.value.filter(p =>
    (p.projectName || '').toLowerCase().includes(q) ||
    (p.clientName || '').toLowerCase().includes(q) ||
    (p.city || '').toLowerCase().includes(q)
  ).slice(0, 50)
})

function selectProject(p) {
  selectedProjectId.value = p.id
  projectSearch.value = p.projectName
  showProjectDropdown.value = false
  expandedRecordId.value = null
}

function delayCloseProjectDropdown() {
  setTimeout(() => { showProjectDropdown.value = false }, 200)
}

const selectedProject = computed(() => projectsCache.value.find(p => p.id === selectedProjectId.value) || null)

function fmtDateShort(d) {
  if (!d) return '—'
  const dt = d?.toDate ? d.toDate() : new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatStatusLabel(s) {
  if (!s) return '—'
  return String(s).replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const STATUS_PILL_MAP = {
  completed: 'pill-green', resolved: 'pill-green', done: 'pill-green', active: 'pill-green',
  'in-progress': 'pill-yellow', pending: 'pill-yellow', scheduled: 'pill-yellow', open: 'pill-yellow', reported: 'pill-yellow',
  cancelled: 'pill-red', rejected: 'pill-red', expired: 'pill-red',
}
function statusPillClass(s) {
  return STATUS_PILL_MAP[(s || '').toLowerCase()] || 'pill-grey'
}

function pruneEmpty(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === '' || v === '—') continue
    out[k] = v
  }
  return out
}

const projectRecordGroups = computed(() => {
  const pid = selectedProjectId.value
  if (!pid) return []

  const complaints = complaintsCache.value.filter(c => c.projectId === pid).map(c => ({
    id: c.id, status: c.status, title: c.issueType || 'Complaint',
    person: (c.assignedTechnicians || [c.assignedTo]).filter(Boolean).join(', '),
    date: c.scheduledDate,
    details: pruneEmpty({
      Priority: formatStatusLabel(c.priority), Client: c.clientName, Description: c.description,
      'Scheduled Date': fmtDateShort(c.scheduledDate), 'Scheduled Time': c.scheduledTime,
      'Arrival Time': c.arrivalTime, 'Completion Time': c.completionTime,
      'Customer Rating': c.customerRating ? `${c.customerRating} / 5` : '',
    }),
  }))

  const installations = installationsCache.value.filter(a => a.projectId === pid).map(a => ({
    id: a.id, status: a.status, title: a.liftType || 'Installation Activity',
    person: (a.technicians || []).join(', ') || a.technician || '',
    date: a.activityDate,
    details: pruneEmpty({
      Progress: a.progress != null ? `${a.progress}%` : '', Location: a.location, 'Lift Number': a.liftNumber,
      'Issue Description': a.issueDescription, Remarks: a.remarks, 'Next Step Date': fmtDateShort(a.nextStepDate),
    }),
  }))

  const modernisations = modernisationCache.value.filter(a => a.projectId === pid).map(a => ({
    id: a.id, status: a.status, title: a.liftType || 'Modernisation Activity',
    person: (a.technicians || []).join(', ') || a.technician || '',
    date: a.activityDate,
    details: pruneEmpty({
      Progress: a.progress != null ? `${a.progress}%` : '', Location: a.location, 'Lift Number': a.liftNumber,
      'Issue Description': a.issueDescription, Remarks: a.remarks, 'Next Step Date': fmtDateShort(a.nextStepDate),
    }),
  }))

  const repairs = repairsCache.value.filter(r => r.projectId === pid).map(r => ({
    id: r.id, status: r.status, title: r.repairType || 'Repair',
    person: (r.technicians || []).join(', ') || r.technician || '',
    date: r.repairDate,
    details: pruneEmpty({
      'Fault Description': r.faultDescription, 'Total Cost': r.totalCost ? _toRs(r.totalCost) : '',
      Warranty: r.warranty === 'yes' ? 'Yes' : 'No', Notes: r.notes, Client: r.clientName,
    }),
  }))

  const amcContracts = amcCache.value.filter(c => c.projectId === pid).map(c => ({
    id: c.id, status: c.status, title: `Contract ${c.contractNumber || c.id}`,
    person: (c.technicians || []).join(', '),
    date: c.startDate,
    details: pruneEmpty({
      'Start Date': fmtDateShort(c.startDate), 'End Date': fmtDateShort(c.endDate),
      'Contract Value': c.contractValue ? _toRs(c.totalWithGST || c.contractValue) : '',
      Frequency: formatStatusLabel(c.frequency), Type: formatStatusLabel(c.contractTier), Notes: c.notes,
    }),
    visits: amcVisitsCache.value.filter(v => v.contractId === c.id)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map(v => ({ id: v.id, monthKey: v.monthKey, date: v.date, technician: v.technician, remarks: v.remarks })),
  }))

  const maintenance = maintenanceCache.value.filter(m => m.projectId === pid).map(m => ({
    id: m.id, status: m.status, title: m.maintenanceType || 'Maintenance',
    person: m.technicianName || '',
    date: m.scheduledDate,
    details: pruneEmpty({
      'Scheduled Date': fmtDateShort(m.scheduledDate), 'Completed Date': fmtDateShort(m.completedDate),
      'Work Performed': m.workPerformed, 'Next Service Date': fmtDateShort(m.nextServiceDate), Remarks: m.remarks,
    }),
  }))

  const sortByDateDesc = (arr) => arr.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  return [
    { key: 'complaints', label: 'Complaints', icon: MessageSquareWarning, color: '#f87171', records: sortByDateDesc(complaints) },
    { key: 'installation', label: 'Installation', icon: HardHat, color: '#60a5fa', records: sortByDateDesc(installations) },
    { key: 'modernisation', label: 'Modernisation', icon: Wrench, color: '#c084fc', records: sortByDateDesc(modernisations) },
    { key: 'repairs', label: 'Repairs', icon: Hammer, color: '#fbbf24', records: sortByDateDesc(repairs) },
    { key: 'amc', label: 'AMC Contracts', icon: ShieldCheck, color: '#34d399', records: sortByDateDesc(amcContracts) },
    { key: 'maintenance', label: 'Maintenance', icon: Settings, color: '#94a3b8', records: sortByDateDesc(maintenance) },
  ]
})

const projectStatSummary = computed(() => projectRecordGroups.value.map(g => ({ label: g.label, count: g.records.length })))

async function downloadProjectReport() {
  const proj = selectedProject.value
  if (!proj) return
  pdfGenerating.value = true
  try {
    const { jsPDF } = await import('jspdf')
    const { applyPlugin } = await import('jspdf-autotable')
    applyPlugin(jsPDF)
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const { company, userName } = await _getCtx()
    const M = _MARGIN

    let y = await _drawHeader(doc, {
      company, userName,
      title: 'Project Activity Report',
      subtitle: `${proj.projectName} · ${proj.clientName || '—'}`,
      accent: _C.indigo,
    })

    y = _sectionLabel(doc, 'Project Details', y, _C.indigo)
    y = _infoGrid(doc, [
      ['Project Name', proj.projectName || '—'],
      ['Client', proj.clientName || '—'],
      ['Address', proj.address || proj.city || '—'],
      ['Status', formatStatusLabel(proj.status)],
      ['Type', proj.type || '—'],
      ['File Number', proj.fileNumber || '—'],
    ], y)

    const ensureSpace = (needed) => {
      if (y + needed > 280) { doc.addPage(); y = 16 }
    }

    for (const group of projectRecordGroups.value) {
      if (!group.records.length) continue
      ensureSpace(20)
      y = _sectionLabel(doc, `${group.label} (${group.records.length})`, y, _C.indigo)

      doc.autoTable({
        startY: y,
        head: [['Date', 'Title', 'Status', 'Assigned To', 'Details']],
        body: group.records.map(r => [
          fmtDateShort(r.date), r.title, formatStatusLabel(r.status), r.person || '—',
          Object.entries(r.details).map(([k, v]) => `${k}: ${v}`).join('\n'),
        ]),
        styles: { fontSize: 7.5, cellPadding: 3, textColor: _C.darkText, overflow: 'linebreak' },
        headStyles: { fillColor: _C.indigo, textColor: _C.white, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: _C.rowAlt },
        columnStyles: { 4: { cellWidth: 70 } },
        margin: { left: M, right: M },
        didDrawPage: async (data) => {
          if (data.pageNumber > 1) await _drawHeader(doc, { company, userName, title: 'Project Activity Report', subtitle: '(continued)', accent: _C.indigo })
        },
      })
      y = doc.lastAutoTable.finalY + 6

      if (group.key === 'amc') {
        const allVisits = group.records.flatMap(c => c.visits.map(v => ({ ...v, contractNo: c.title })))
        if (allVisits.length) {
          ensureSpace(20)
          y = _sectionLabel(doc, 'AMC Maintenance Visits', y, _C.greyText)
          doc.autoTable({
            startY: y,
            head: [['Contract', 'Month', 'Visit Date', 'Technician', 'Remarks']],
            body: allVisits.map(v => [v.contractNo, v.monthKey || '—', fmtDateShort(v.date), v.technician || '—', v.remarks || '—']),
            styles: { fontSize: 7.5, cellPadding: 3, textColor: _C.darkText, overflow: 'linebreak' },
            headStyles: { fillColor: _C.greyText, textColor: _C.white, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: _C.rowAlt },
            margin: { left: M, right: M },
          })
          y = doc.lastAutoTable.finalY + 6
        }
      }
    }

    _drawFooter(doc, { company: company.name, title: 'Project Activity Report' })
    await savePDF(doc, `Project-Activities-${(proj.projectName || proj.id).replace(/\s+/g, '_')}.pdf`, ui)
    ui.success('PDF report downloaded.')
  } catch (e) {
    ui.error('PDF export failed: ' + e.message)
  } finally {
    pdfGenerating.value = false
  }
}
</script>

<style scoped>
.page-container { padding: 28px; }
.stats-row { display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px; }
.stat-card { background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:16px;text-align:center; }
.stat-val { font-size:24px;font-weight:700;margin-bottom:4px; }
.stat-val.accent { color:var(--ct-accent); } .stat-val.green { color:#22c55e; }
.stat-val.yellow { color:#fbbf24; } .stat-val.purple { color:#c084fc; }
.stat-lbl { font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em; }

.filters-bar { display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center; }
.filter-sel { width:160px; }

.activity-list { display:flex;flex-direction:column;gap:8px;margin-bottom:20px; }
.activity-card {
  background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);
  border-radius:12px;cursor:pointer;transition:border-color .15s,background .15s;overflow:hidden;
}
.activity-card:hover { border-color:rgba(255,255,255,.15);background:rgba(255,255,255,.05); }
.activity-card.expanded { border-color:rgba(99,102,241,.35);background:rgba(99,102,241,.04); }

.card-row { display:flex;align-items:center;gap:12px;padding:12px 16px;flex-wrap:wrap; }
.action-badge {
  display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;
  font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;flex-shrink:0;white-space:nowrap;
}
.act-create  { background:rgba(34,197,94,.12); color:#22c55e;border:1px solid rgba(34,197,94,.25); }
.act-update  { background:rgba(99,102,241,.12);color:#a5b4fc;border:1px solid rgba(99,102,241,.25); }
.act-delete  { background:rgba(239,68,68,.12); color:#f87171;border:1px solid rgba(239,68,68,.25); }
.act-approve { background:rgba(16,185,129,.12);color:#34d399;border:1px solid rgba(16,185,129,.25); }
.act-reject  { background:rgba(239,68,68,.12); color:#f87171;border:1px solid rgba(239,68,68,.25); }
.act-complete{ background:rgba(168,85,247,.12);color:#c084fc;border:1px solid rgba(168,85,247,.25); }
.act-convert { background:rgba(245,158,11,.12);color:#fbbf24;border:1px solid rgba(245,158,11,.25); }
.act-import  { background:rgba(6,182,212,.12); color:#67e8f9;border:1px solid rgba(6,182,212,.25); }
.act-export  { background:rgba(59,130,246,.12);color:#93c5fd;border:1px solid rgba(59,130,246,.25); }
.act-payment { background:rgba(34,197,94,.12); color:#86efac;border:1px solid rgba(34,197,94,.25); }
.act-renew   { background:rgba(251,191,36,.12);color:#fcd34d;border:1px solid rgba(251,191,36,.25); }
.act-default { background:rgba(100,116,139,.1);color:#94a3b8;border:1px solid rgba(100,116,139,.2); }

.card-summary { flex:1;font-size:13px;color:var(--ct-primary);font-weight:500;min-width:0; }
.card-meta { display:flex;align-items:center;gap:14px;flex-shrink:0;flex-wrap:wrap; }
.user-chip { display:flex;align-items:center;gap:7px; }
.user-av {
  width:26px;height:26px;border-radius:7px;flex-shrink:0;
  background:linear-gradient(135deg,rgba(99,102,241,.3),rgba(168,85,247,.3));
  border:1px solid rgba(99,102,241,.2);display:flex;align-items:center;justify-content:center;
  font-size:10px;font-weight:700;color:var(--ct-accent);
}
.user-name { font-size:12px;color:var(--ct-sub);font-weight:500; }
.user-role { font-size:11px;color:var(--ct-muted); }
.card-time { font-size:11px;color:var(--ct-muted);white-space:nowrap; }
.card-module-tag { display:flex;align-items:center;gap:4px;font-size:11px; }
.mod-badge { background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:1px 6px;color:var(--ct-muted); }
.tab-label { color:var(--ct-muted); }
.expand-icon { color:var(--ct-muted);transition:transform .2s;flex-shrink:0; }
.expand-icon.rotated { transform:rotate(180deg); }

.card-details { border-top:1px solid rgba(255,255,255,.06);padding:14px 16px; }
.details-grid { display:grid;grid-template-columns:160px 1fr;gap:4px 16px;margin-bottom:12px; }
.detail-key { font-size:12px;color:var(--ct-muted);font-weight:500;padding:3px 0; }
.detail-val { font-size:12px;color:var(--ct-sub);padding:3px 0;word-break:break-word; }
.details-meta-row { display:flex;flex-wrap:wrap;gap:16px;font-size:11px;color:var(--ct-muted);padding-top:10px;border-top:1px solid rgba(255,255,255,.05); }

.expand-enter-active,.expand-leave-active { transition:opacity .18s ease; }
.expand-enter-from,.expand-leave-to { opacity:0; }

/* Undo button */
.undo-btn {
  display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;
  font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;white-space:nowrap;
  background:rgba(251,191,36,.1);color:#fbbf24;border:1px solid rgba(251,191,36,.3);
  transition:background .15s,border-color .15s;
}
.undo-btn:hover { background:rgba(251,191,36,.2);border-color:rgba(251,191,36,.5); }

.undone-badge {
  display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;
  font-size:11px;font-weight:600;flex-shrink:0;
  background:rgba(239,68,68,.08);color:#f87171;border:1px solid rgba(239,68,68,.2);
}

/* Undo modal */
.undo-backdrop {
  position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);
  display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;
}
.undo-modal {
  background:var(--ct-surface,#1a1a2e);border:1px solid rgba(251,191,36,.25);
  border-radius:16px;width:100%;max-width:440px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.5);
}
.undo-modal-header {
  display:flex;align-items:center;gap:10px;padding:18px 20px 14px;
  font-size:16px;font-weight:700;color:var(--ct-primary);
  border-bottom:1px solid rgba(255,255,255,.06);
}
.undo-modal-body { padding:18px 20px; }
.undo-summary { font-size:13px;color:var(--ct-primary);font-weight:600;margin-bottom:8px; }
.undo-hint { font-size:12px;color:var(--ct-muted);margin-bottom:14px;line-height:1.5; }
.undo-error { margin-top:8px;font-size:12px;color:#f87171;font-weight:500; }
.undo-modal-footer {
  display:flex;gap:10px;padding:14px 20px 18px;border-top:1px solid rgba(255,255,255,.05);
}

@keyframes spin { to { transform:rotate(360deg); } }

/* ── Sub-tabs ── */
.act-tabs {
  display:flex;gap:4px;margin-bottom:20px;border-bottom:1px solid rgba(255,255,255,.08);
  overflow-x:auto;
}
.act-tab {
  display:flex;align-items:center;gap:7px;padding:10px 16px;border:none;
  border-bottom:2px solid transparent;background:transparent;color:var(--ct-muted);
  font-size:13px;font-weight:500;cursor:pointer;transition:all .18s;
  border-radius:8px 8px 0 0;white-space:nowrap;flex-shrink:0;
}
.act-tab:hover { color:var(--ct-sub); }
.act-tab.active { color:var(--ct-accent);border-bottom-color:#6366f1;background:rgba(99,102,241,.06); }

/* ── Project Activities ── */
.proj-search-bar { display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;align-items:center; }
.proj-dd {
  position:absolute;top:100%;left:0;right:0;margin-top:4px;border-radius:10px;z-index:200;
  max-height:260px;overflow-y:auto;background:var(--ct-surface,#1a1a2e);
  border:1px solid rgba(255,255,255,.12);box-shadow:0 12px 30px rgba(0,0,0,.4);
}
.proj-dd-item { padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid rgba(255,255,255,.05); }
.proj-dd-item:last-child { border-bottom:none; }
.proj-dd-item:hover, .proj-dd-item.active { background:rgba(99,102,241,.12); }
.proj-dd-name { color:var(--ct-primary);font-weight:600; }
.proj-dd-sub { color:var(--ct-muted);font-size:11px;margin-top:2px; }

.proj-summary-card {
  display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;
  background:rgba(99,102,241,.05);border:1px solid rgba(99,102,241,.15);border-radius:14px;
  padding:18px 20px;margin-bottom:20px;
}
.proj-summary-name { font-size:17px;font-weight:700;color:var(--ct-primary); }
.proj-summary-sub { font-size:12px;color:var(--ct-muted);margin-top:3px; }
.proj-summary-stats { display:flex;gap:20px;flex-wrap:wrap; }
.proj-summary-stat { text-align:center;min-width:64px; }
.proj-summary-stat-val { font-size:18px;font-weight:700;color:var(--ct-accent); }
.proj-summary-stat-lbl { font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.04em;margin-top:2px; }

.proj-section { margin-bottom:20px; }
.proj-section-head { display:flex;align-items:center;gap:8px;margin-bottom:10px; }
.proj-section-title { font-size:14px;font-weight:600;color:var(--ct-primary); }
.proj-section-count {
  background:rgba(255,255,255,.08);border-radius:20px;padding:1px 9px;font-size:11px;
  color:var(--ct-muted);font-weight:600;
}
.proj-section-empty { font-size:12px;color:var(--ct-muted);padding:10px 2px; }

.proj-record-list { display:flex;flex-direction:column;gap:8px; }
.proj-record-card {
  background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);
  border-radius:12px;cursor:pointer;transition:border-color .15s,background .15s;overflow:hidden;
}
.proj-record-card:hover { border-color:rgba(255,255,255,.15);background:rgba(255,255,255,.05); }
.proj-record-card.expanded { border-color:rgba(99,102,241,.35);background:rgba(99,102,241,.04); }
.proj-record-row { display:flex;align-items:center;gap:12px;padding:12px 16px;flex-wrap:wrap; }
.proj-record-title { flex:1;font-size:13px;color:var(--ct-primary);font-weight:500;min-width:0; }
.proj-record-meta { display:flex;align-items:center;gap:12px;font-size:11px;color:var(--ct-muted);flex-shrink:0; }
.proj-record-date { white-space:nowrap; }
.proj-record-details { border-top:1px solid rgba(255,255,255,.06);padding:14px 16px; }

.proj-nested-visits { margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.05); }
.proj-nested-head { font-size:11px;font-weight:600;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px; }
.proj-nested-row {
  display:grid;grid-template-columns:70px 90px 120px 1fr;gap:10px;font-size:12px;
  color:var(--ct-sub);padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);
}
.proj-nested-remarks { color:var(--ct-muted); }

.status-pill {
  display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;
  font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;flex-shrink:0;white-space:nowrap;
}
.pill-green  { background:rgba(34,197,94,.12); color:#22c55e;border:1px solid rgba(34,197,94,.25); }
.pill-yellow { background:rgba(251,191,36,.1); color:#fbbf24;border:1px solid rgba(251,191,36,.25); }
.pill-red    { background:rgba(239,68,68,.12); color:#f87171;border:1px solid rgba(239,68,68,.25); }
.pill-grey   { background:rgba(100,116,139,.1);color:#94a3b8;border:1px solid rgba(100,116,139,.2); }

@media (max-width:700px) {
  .stats-row { grid-template-columns:repeat(2,1fr); }
  .card-row { padding:10px 12px; }
  .card-meta { gap:8px; }
  .details-grid { grid-template-columns:120px 1fr; }
  .proj-nested-row { grid-template-columns:1fr 1fr; }
  .proj-summary-card { flex-direction:column;align-items:flex-start; }
}
</style>
