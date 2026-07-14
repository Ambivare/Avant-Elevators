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
      <button class="btn-secondary" @click="loadActivities" :disabled="activityLoading">
        <Loader2 v-if="activityLoading" :size="14" style="animation:spin 1s linear infinite;" />
        <RefreshCw v-else :size="14" />
        Refresh
      </button>
    </div>

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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import {
  Activity, Search, RefreshCw, ChevronLeft, ChevronRight, ChevronDown,
  Plus, Pencil, Trash2, CheckCircle, XCircle, RotateCcw, Upload,
  FileText, DollarSign, AlertCircle, Settings, LogIn, LogOut, Loader2,
} from 'lucide-vue-next'
import { useActivityStore } from '@/stores/activity'
import { useAuthStore } from '@/stores/auth'
import { useSecurityStore } from '@/stores/security'
import { useUIStore } from '@/stores/ui'

const activityStore = useActivityStore()
const auth = useAuthStore()
const security = useSecurityStore()
const ui = useUIStore()
const activityLoading = ref(false)
const expandedId = ref(null)

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
@media (max-width:700px) {
  .stats-row { grid-template-columns:repeat(2,1fr); }
  .card-row { padding:10px 12px; }
  .card-meta { gap:8px; }
  .details-grid { grid-template-columns:120px 1fr; }
}
</style>
