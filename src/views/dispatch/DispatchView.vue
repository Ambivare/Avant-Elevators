<template>
  <div class="dispatch-view">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <Kanban :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          Dispatch Board
        </h1>
        <p class="page-sub" v-if="activeTab === 'board'">Route the right technician to the right job, instantly.</p>
        <p class="page-sub" v-else>Leads tracked, pipeline managed, deals won.</p>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <!-- Tab switcher -->
        <div style="display:flex;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;overflow:hidden;">
          <button
            :class="activeTab === 'board' ? 'tab-btn-active' : 'tab-btn'"
            @click="activeTab = 'board'"
          ><LayoutGrid :size="13" style="vertical-align:-2px;margin-right:4px;" />Board</button>
          <button
            :class="activeTab === 'sales' ? 'tab-btn-active' : 'tab-btn'"
            @click="activeTab = 'sales'"
          ><TrendingUp :size="13" style="vertical-align:-2px;margin-right:4px;" />Sales Team</button>
        </div>

        <!-- Board controls -->
        <template v-if="activeTab === 'board'">
          <button class="btn-secondary btn-sm" style="padding:6px 10px;" @click="shiftDate(-1)">&#8249;</button>
          <input type="date" v-model="selectedDate" class="input" style="width:160px;" />
          <button class="btn-secondary btn-sm" style="padding:6px 10px;" @click="shiftDate(1)">&#8250;</button>
          <button class="btn-primary btn-sm" @click="selectedDate = today">Today</button>
          <button class="btn-secondary btn-sm" :class="{ 'btn-primary': showAll }" @click="showAll = !showAll" title="Show all scheduled jobs">
            <LayoutGrid :size="14" /> {{ showAll ? 'All Dates' : 'Date Filter' }}
          </button>
        </template>

        <!-- Sales controls -->
        <template v-if="activeTab === 'sales'">
          <select v-model="salesPersonFilter" class="input" style="width:160px;">
            <option value="">All Sales People</option>
            <option v-for="s in salesEmployees" :key="s.id" :value="s.fullName || s.username">{{ s.fullName || s.username }}</option>
          </select>
          <select v-model="salesRangeFilter" class="input" style="width:130px;">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="0">All time</option>
          </select>
        </template>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" style="display:flex;justify-content:center;padding:60px;">
      <Loader2 :size="28" class="spin" style="color:var(--ct-accent);" />
    </div>

    <template v-else>

      <!-- ══════════════════════ BOARD TAB ══════════════════════ -->
      <template v-if="activeTab === 'board'">
        <!-- Stats row -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:20px;">
          <div v-for="stat in stats" :key="stat.label" class="glass" style="padding:12px 16px;text-align:center;">
            <div :style="`font-size:20px;font-weight:700;color:${stat.color};`">{{ stat.count }}</div>
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:3px;">{{ stat.label }}</div>
          </div>
        </div>

        <!-- Board -->
        <div class="dispatch-board">
          <!-- Unassigned column -->
          <div
            class="board-col"
            :class="{ 'drop-target': dragOverCol === '__unassigned__' }"
            @dragover.prevent="dragOverCol = '__unassigned__'"
            @dragleave="dragOverCol = null"
            @drop="onDrop($event, null)"
          >
            <div class="col-header" style="border-color:rgba(248,113,113,0.4);">
              <span style="color:#f87171;font-weight:700;">Unassigned</span>
              <span class="col-count" style="background:rgba(248,113,113,0.15);color:#f87171;">{{ unassignedCards.length }}</span>
            </div>
            <div
              v-for="card in unassignedCards" :key="card._uid"
              class="job-card"
              :class="{ 'is-done': card._done }"
              :style="`border-left:3px solid ${typeColor(card._type)};`"
              draggable="true"
              @dragstart="onDragStart($event, card)"
              @dragend="dragOverCol = null"
              @click="openCard(card)"
            >
              <div class="card-type-row">
                <span class="card-type-badge" :style="`background:${typeColor(card._type)}22;color:${typeColor(card._type)};`">
                  <component :is="typeIcon(card._type)" :size="10" />
                  {{ typeLabel(card._type) }}
                </span>
                <span class="card-status" :style="`color:${statusColor(card.status)};`">{{ card.status || '—' }}</span>
              </div>
              <div class="card-client">{{ card.clientName || card.projectName || '—' }}</div>
              <div class="card-desc">{{ cardDesc(card) }}</div>
              <div v-if="card.scheduledTime || card.repairDate || card.activityDate || card.scheduledDate" class="card-time">
                <Clock :size="10" style="vertical-align:-1px;" />
                {{ card.scheduledTime || formatDate(card.repairDate || card.activityDate || card.scheduledDate) }}
              </div>
            </div>
            <div v-if="!unassignedCards.length" class="col-empty">No unassigned jobs</div>
          </div>

          <!-- Technician columns -->
          <div
            v-for="tech in technicians" :key="tech.id"
            class="board-col"
            :class="{ 'drop-target': dragOverCol === tech.fullName }"
            @dragover.prevent="dragOverCol = tech.fullName"
            @dragleave="dragOverCol = null"
            @drop="onDrop($event, tech)"
          >
            <div class="col-header">
              <div>
                <div style="font-weight:600;color:var(--ct-primary);font-size:13px;">{{ tech.fullName || tech.username }}</div>
                <div style="font-size:10px;color:var(--ct-muted);margin-top:1px;">{{ tech.phone || '' }}</div>
              </div>
              <span class="col-count" :style="getTechCards(tech).length ? 'background:rgba(99,102,241,0.15);color:#818cf8;' : ''">
                {{ getTechCards(tech).length }}
              </span>
            </div>
            <div
              v-for="card in getTechCards(tech)" :key="card._uid"
              class="job-card"
              :class="{ 'is-done': card._done }"
              :style="`border-left:3px solid ${typeColor(card._type)};`"
              draggable="true"
              @dragstart="onDragStart($event, card)"
              @dragend="dragOverCol = null"
              @click="openCard(card)"
            >
              <div class="card-type-row">
                <span class="card-type-badge" :style="`background:${typeColor(card._type)}22;color:${typeColor(card._type)};`">
                  <component :is="typeIcon(card._type)" :size="10" />
                  {{ typeLabel(card._type) }}
                </span>
                <span class="card-status" :style="`color:${statusColor(card.status)};`">{{ card.status || '—' }}</span>
              </div>
              <div class="card-client">{{ card.clientName || card.projectName || '—' }}</div>
              <div class="card-desc">{{ cardDesc(card) }}</div>
              <div v-if="card.scheduledTime || card.repairDate || card.activityDate || card.scheduledDate" class="card-time">
                <Clock :size="10" style="vertical-align:-1px;" />
                {{ card.scheduledTime || formatDate(card.repairDate || card.activityDate || card.scheduledDate) }}
              </div>
            </div>
            <div v-if="!getTechCards(tech).length" class="col-empty">No jobs assigned</div>
          </div>
        </div>
      </template>

      <!-- ══════════════════════ SALES TAB ══════════════════════ -->
      <template v-if="activeTab === 'sales'">
        <!-- Sales person cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;margin-bottom:28px;">
          <div
            v-for="sp in filteredSalesStats" :key="sp.id"
            class="glass"
            style="border-radius:14px;padding:18px;cursor:pointer;transition:background .15s;"
            :style="salesPersonFilter === (sp.fullName || sp.username) ? 'border:1.5px solid rgba(99,102,241,0.5);background:rgba(99,102,241,0.07);' : ''"
            @click="salesPersonFilter = salesPersonFilter === (sp.fullName || sp.username) ? '' : (sp.fullName || sp.username)"
          >
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
              <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;color:#fff;flex-shrink:0;">
                {{ (sp.fullName || sp.username || '?').charAt(0).toUpperCase() }}
              </div>
              <div>
                <div style="font-weight:700;font-size:14px;color:var(--ct-primary);">{{ sp.fullName || sp.username }}</div>
                <div style="font-size:11px;color:var(--ct-muted);margin-top:1px;">{{ sp.phone || sp.email || 'Sales' }}</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">
              <div style="text-align:center;background:rgba(255,255,255,0.04);border-radius:8px;padding:8px 4px;">
                <div style="font-size:18px;font-weight:700;color:#a5b4fc;">{{ sp.total }}</div>
                <div style="font-size:9px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.04em;margin-top:2px;">Total</div>
              </div>
              <div style="text-align:center;background:rgba(255,255,255,0.04);border-radius:8px;padding:8px 4px;">
                <div style="font-size:18px;font-weight:700;color:#4ade80;">{{ sp.won }}</div>
                <div style="font-size:9px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.04em;margin-top:2px;">Won</div>
              </div>
              <div style="text-align:center;background:rgba(255,255,255,0.04);border-radius:8px;padding:8px 4px;">
                <div style="font-size:18px;font-weight:700;color:#f87171;">{{ sp.lost }}</div>
                <div style="font-size:9px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.04em;margin-top:2px;">Lost</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px;">
              <div v-for="s in [['Hot','hot','#f87171'],['Warm','warm','#fbbf24'],['Cold','cold','#60a5fa'],['New','new','#94a3b8']]" :key="s[1]" style="text-align:center;">
                <div :style="`font-size:14px;font-weight:700;color:${s[2]};`">{{ sp.byStage[s[1]] || 0 }}</div>
                <div style="font-size:9px;color:var(--ct-muted);">{{ s[0] }}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding-top:8px;border-top:1px solid rgba(255,255,255,0.07);">
              <span style="font-size:11px;color:var(--ct-muted);">Pipeline</span>
              <span style="font-size:13px;font-weight:700;color:#fbbf24;">₹{{ formatCurrency(sp.pipeline) }}</span>
            </div>
          </div>
        </div>

        <!-- Recent leads table -->
        <div class="glass" style="border-radius:14px;overflow:hidden;">
          <div style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <span style="font-size:14px;font-weight:600;color:var(--ct-primary);">
              Leads {{ salesPersonFilter ? `· ${salesPersonFilter}` : '' }}
              <span style="font-size:12px;color:var(--ct-muted);font-weight:400;margin-left:6px;">({{ filteredSalesLeads.length }})</span>
            </span>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <select v-model="salesStageFilter" class="input" style="width:120px;font-size:12px;">
                <option value="">All Stages</option>
                <option value="new">New</option>
                <option value="hot">Hot</option>
                <option value="warm">Warm</option>
                <option value="cold">Cold</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
              <input v-model="salesSearch" class="input" placeholder="Search…" style="width:140px;font-size:12px;" />
            </div>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead>
                <tr style="border-bottom:1px solid rgba(255,255,255,0.07);">
                  <th style="text-align:left;padding:10px 14px;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--ct-muted);font-weight:600;">Client</th>
                  <th style="text-align:left;padding:10px 14px;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--ct-muted);font-weight:600;">Stage</th>
                  <th style="text-align:left;padding:10px 14px;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--ct-muted);font-weight:600;">Assigned To</th>
                  <th style="text-align:left;padding:10px 14px;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--ct-muted);font-weight:600;">Value</th>
                  <th style="text-align:left;padding:10px 14px;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--ct-muted);font-weight:600;">Follow-up</th>
                  <th style="text-align:left;padding:10px 14px;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--ct-muted);font-weight:600;">Added</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="lead in filteredSalesLeads" :key="lead.id"
                  style="border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;transition:background .1s;"
                  @mouseenter="$event.currentTarget.style.background='rgba(255,255,255,0.04)'"
                  @mouseleave="$event.currentTarget.style.background=''"
                  @click="openLead(lead)"
                >
                  <td style="padding:10px 14px;">
                    <div style="font-weight:600;color:var(--ct-primary);">{{ lead.clientName || '—' }}</div>
                    <div v-if="lead.phone" style="font-size:10px;color:var(--ct-muted);margin-top:1px;">{{ lead.phone }}</div>
                  </td>
                  <td style="padding:10px 14px;">
                    <span :style="`font-size:10px;font-weight:700;text-transform:uppercase;padding:2px 8px;border-radius:99px;background:${stageColor(lead.stage)}22;color:${stageColor(lead.stage)};`">
                      {{ lead.stage || 'new' }}
                    </span>
                  </td>
                  <td style="padding:10px 14px;color:var(--ct-sub);">{{ lead.assignedTo || '—' }}</td>
                  <td style="padding:10px 14px;font-weight:600;color:#fbbf24;">{{ lead.value ? '₹' + formatCurrency(lead.value) : '—' }}</td>
                  <td style="padding:10px 14px;color:var(--ct-muted);">{{ lead.nextFollowUp ? formatDate(lead.nextFollowUp) : '—' }}</td>
                  <td style="padding:10px 14px;color:var(--ct-muted);">{{ lead.createdAt ? formatDate(lead.createdAt) : '—' }}</td>
                </tr>
                <tr v-if="!filteredSalesLeads.length">
                  <td colspan="6" style="text-align:center;padding:30px;color:var(--ct-muted);font-size:12px;">No leads found</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Kanban, LayoutGrid, Loader2, Clock, Wrench, MessageSquareWarning, Zap, RefreshCw, ClipboardList, TrendingUp } from 'lucide-vue-next'
import { getAll, update } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { useUIStore } from '@/stores/ui'

const ui = useUIStore()
const router = useRouter()

// ── Tabs ──────────────────────────────────────────────────────────────────────
const activeTab = ref('board')

// ── Date (board) ──────────────────────────────────────────────────────────────
const today = new Date().toISOString().split('T')[0]
const selectedDate = ref(today)
const showAll = ref(false)

function shiftDate(delta) {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() + delta)
  selectedDate.value = d.toISOString().split('T')[0]
}

function formatDate(val) {
  if (!val) return ''
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    const [y, m, d] = val.split('-')
    return `${d}/${m}/${y}`
  }
  try {
    const ts = val?.seconds ? new Date(val.seconds * 1000) : new Date(val)
    return ts.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return '' }
}

function formatCurrency(v) {
  if (!v) return '0'
  return Number(v).toLocaleString('en-IN')
}

// ── Data ──────────────────────────────────────────────────────────────────────
const loading = ref(true)
const technicians = ref([])
const repairs = ref([])
const complaints = ref([])
const installations = ref([])
const modernisations = ref([])
const maintenances = ref([])
const allEmployees = ref([])
const allLeads = ref([])

async function loadAll() {
  loading.value = true
  try {
    const [emp, rep, cmp, inst, mod, maint, leads] = await Promise.all([
      getAll(Collections.EMPLOYEES),
      getAll(Collections.REPAIRS),
      getAll(Collections.COMPLAINTS),
      getAll(Collections.INSTALLATION),
      getAll(Collections.MODERNISATION),
      getAll(Collections.MAINTENANCE),
      getAll(Collections.LEADS),
    ])
    allEmployees.value = emp
    technicians.value = emp
      .filter(e => (e.role === 'technician' || e.department === 'Technical') && e.status !== 'inactive')
      .sort((a, b) => (a.fullName || a.username || '').localeCompare(b.fullName || b.username || ''))
    repairs.value = rep
    complaints.value = cmp
    installations.value = inst
    modernisations.value = mod
    maintenances.value = maint
    allLeads.value = leads
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)

// ── Date filter helper ─────────────────────────────────────────────────────────
// Records with no date are always excluded (they're undated drafts, not dispatched jobs)
function matchesDate(val) {
  if (!val) return false
  if (showAll.value) return true
  if (typeof val === 'string') return val.startsWith(selectedDate.value)
  if (val?.seconds) return new Date(val.seconds * 1000).toISOString().startsWith(selectedDate.value)
  return false
}

// ── Flatten all records into uniform cards ────────────────────────────────────
const allCards = computed(() => {
  const cards = []

  repairs.value.filter(r => matchesDate(r.repairDate)).forEach(r => {
    cards.push({ ...r, _type: 'repair', _uid: 'rep-' + r.id, _col: Collections.REPAIRS,
      _techs: (r.technicians || (r.technician ? [r.technician] : [])).filter(Boolean),
      _done: ['completed'].includes(r.status) })
  })

  complaints.value.filter(c => matchesDate(c.scheduledDate)).forEach(c => {
    cards.push({ ...c, _type: 'complaint', _uid: 'cmp-' + c.id, _col: Collections.COMPLAINTS,
      _techs: (c.assignedTechnicians || []).filter(Boolean),
      _done: ['resolved', 'closed'].includes(c.status) })
  })

  installations.value.filter(i => matchesDate(i.activityDate)).forEach(i => {
    cards.push({ ...i, _type: 'installation', _uid: 'inst-' + i.id, _col: Collections.INSTALLATION,
      _techs: (i.technicians || []).filter(Boolean),
      _done: i.status === 'completed' })
  })

  modernisations.value.filter(m => matchesDate(m.activityDate)).forEach(m => {
    cards.push({ ...m, _type: 'modernisation', _uid: 'mod-' + m.id, _col: Collections.MODERNISATION,
      _techs: (m.technicians || []).filter(Boolean),
      _done: m.status === 'completed' })
  })

  maintenances.value.filter(m => matchesDate(m.scheduledDate)).forEach(m => {
    cards.push({ ...m, _type: 'maintenance', _uid: 'maint-' + m.id, _col: Collections.MAINTENANCE,
      _techs: m.technicianName ? [m.technicianName] : [],
      _done: m.status === 'completed' })
  })

  return cards
})

// ── Column grouping ───────────────────────────────────────────────────────────
const unassignedCards = computed(() =>
  allCards.value.filter(c => !c._techs.length).sort(sortCards)
)

function getTechCards(tech) {
  const name = tech.fullName || tech.username
  return allCards.value
    .filter(c => c._techs.some(t => t.toLowerCase() === name.toLowerCase()))
    .sort(sortCards)
}

function sortCards(a, b) {
  if (a._done !== b._done) return a._done ? 1 : -1
  const timeA = a.scheduledTime || ''
  const timeB = b.scheduledTime || ''
  return timeA.localeCompare(timeB)
}

// ── Stats ─────────────────────────────────────────────────────────────────────
const doneCount = computed(() => allCards.value.filter(c => c._done).length)
const pendingCount = computed(() => allCards.value.filter(c => !c._done).length)

const stats = computed(() => [
  { label: 'Total', count: allCards.value.length, color: '#a5b4fc' },
  { label: 'Done', count: doneCount.value, color: '#4ade80' },
  { label: 'Pending', count: pendingCount.value, color: '#fbbf24' },
  { label: 'Unassigned', count: unassignedCards.value.length, color: '#f87171' },
  { label: 'Repairs', count: allCards.value.filter(c => c._type === 'repair').length, color: '#f87171' },
  { label: 'Complaints', count: allCards.value.filter(c => c._type === 'complaint').length, color: '#fb923c' },
  { label: 'Installation', count: allCards.value.filter(c => c._type === 'installation').length, color: '#60a5fa' },
  { label: 'Maintenance', count: allCards.value.filter(c => c._type === 'maintenance').length, color: '#34d399' },
])

// ── Type helpers ──────────────────────────────────────────────────────────────
function typeColor(type) {
  return { repair: '#f87171', complaint: '#fb923c', installation: '#60a5fa', modernisation: '#a78bfa', maintenance: '#34d399' }[type] || '#94a3b8'
}
function typeLabel(type) {
  return { repair: 'Repair', complaint: 'Complaint', installation: 'Installation', modernisation: 'Modernisation', maintenance: 'Maintenance' }[type] || type
}
function typeIcon(type) {
  return { repair: Wrench, complaint: MessageSquareWarning, installation: Zap, modernisation: RefreshCw, maintenance: ClipboardList }[type] || Wrench
}
function statusColor(status) {
  if (['completed', 'resolved', 'closed'].includes(status)) return '#4ade80'
  if (['in-progress', 'diagnosed'].includes(status)) return '#60a5fa'
  if (status === 'reported' || status === 'open') return '#fbbf24'
  return 'var(--ct-muted)'
}
function cardDesc(card) {
  const desc = card.faultDescription || card.issueDescription || card.issueType || card.maintenanceType || card.repairType || card.liftType || ''
  return desc.length > 55 ? desc.slice(0, 55) + '…' : desc
}

// ── Drag & Drop ───────────────────────────────────────────────────────────────
const dragCard = ref(null)
const dragOverCol = ref(null)

function onDragStart(e, card) {
  dragCard.value = card
  e.dataTransfer.effectAllowed = 'move'
}

async function onDrop(e, tech) {
  dragOverCol.value = null
  const card = dragCard.value
  dragCard.value = null
  if (!card) return

  const techName = tech ? (tech.fullName || tech.username) : null

  const alreadyHere = techName
    ? card._techs.some(t => t.toLowerCase() === techName.toLowerCase())
    : !card._techs.length
  if (alreadyHere) return

  try {
    if (card._type === 'maintenance') {
      await update(card._col, card.id, { technicianName: techName || '' })
    } else if (card._type === 'complaint') {
      await update(card._col, card.id, { assignedTechnicians: techName ? [techName] : [] })
    } else {
      await update(card._col, card.id, { technicians: techName ? [techName] : [] })
    }
    ui.success(techName ? `Assigned to ${techName}` : 'Moved to Unassigned')
    await loadAll()
  } catch {
    ui.error('Failed to update assignment.')
  }
}

// ── Navigate to source module and open the specific record ────────────────────
function openCard(card) {
  const routes = {
    repair: '/repairs',
    complaint: '/complaints',
    installation: '/installation',
    modernisation: '/modernisation',
    maintenance: '/maintenance',
  }
  ui.setPendingAutoOpen({ collection: card._col, recordId: card.id })
  router.push(routes[card._type] || '/')
}

// ── Sales Tab ─────────────────────────────────────────────────────────────────
const salesPersonFilter = ref('')
const salesRangeFilter = ref('30')
const salesStageFilter = ref('')
const salesSearch = ref('')

const salesEmployees = computed(() =>
  allEmployees.value
    .filter(e => e.role === 'sales' && e.status !== 'inactive')
    .sort((a, b) => (a.fullName || a.username || '').localeCompare(b.fullName || b.username || ''))
)

function salesRangeCutoff() {
  const days = Number(salesRangeFilter.value)
  if (!days) return null
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

function leadInRange(lead) {
  const cutoff = salesRangeCutoff()
  if (!cutoff) return true
  if (!lead.createdAt) return false
  try {
    const ts = lead.createdAt?.seconds ? new Date(lead.createdAt.seconds * 1000) : new Date(lead.createdAt)
    return ts >= cutoff
  } catch { return false }
}

const rangeLeads = computed(() => allLeads.value.filter(leadInRange))

const filteredSalesStats = computed(() => {
  const people = salesPersonFilter.value
    ? salesEmployees.value.filter(s => (s.fullName || s.username) === salesPersonFilter.value)
    : salesEmployees.value

  return people.map(sp => {
    const name = sp.fullName || sp.username
    const mine = rangeLeads.value.filter(l => l.assignedTo === name)
    const byStage = {}
    mine.forEach(l => { const s = l.stage || 'new'; byStage[s] = (byStage[s] || 0) + 1 })
    const pipeline = mine.filter(l => !['won', 'lost'].includes(l.stage)).reduce((s, l) => s + (l.value || 0), 0)
    return {
      ...sp,
      total: mine.length,
      won: byStage.won || 0,
      lost: byStage.lost || 0,
      byStage,
      pipeline,
    }
  })
})

const filteredSalesLeads = computed(() => {
  let list = rangeLeads.value
  if (salesPersonFilter.value) list = list.filter(l => l.assignedTo === salesPersonFilter.value)
  if (salesStageFilter.value) list = list.filter(l => (l.stage || 'new') === salesStageFilter.value)
  if (salesSearch.value.trim()) {
    const q = salesSearch.value.trim().toLowerCase()
    list = list.filter(l =>
      (l.clientName || '').toLowerCase().includes(q) ||
      (l.phone || '').includes(q) ||
      (l.assignedTo || '').toLowerCase().includes(q)
    )
  }
  return [...list].sort((a, b) => {
    const ta = a.createdAt?.seconds || 0
    const tb = b.createdAt?.seconds || 0
    return tb - ta
  })
})

function stageColor(stage) {
  return { hot: '#f87171', warm: '#fbbf24', cold: '#60a5fa', won: '#4ade80', lost: '#94a3b8', new: '#a5b4fc' }[stage] || '#94a3b8'
}

function openLead(lead) {
  ui.setPendingAutoOpen({ collection: Collections.LEADS, recordId: lead.id })
  router.push('/sales')
}

watch(selectedDate, loadAll)
watch(showAll, loadAll)
</script>

<style scoped>
.dispatch-view { padding-bottom: 40px; }

.tab-btn {
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ct-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color .15s, background .15s;
}
.tab-btn:hover { color: var(--ct-primary); background: rgba(255,255,255,0.04); }
.tab-btn-active {
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: rgba(99,102,241,0.35);
  border: none;
  cursor: pointer;
}

.dispatch-board {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  align-items: flex-start;
  padding-bottom: 16px;
}

.board-col {
  flex: 0 0 260px;
  min-width: 260px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 14px;
  padding: 12px;
  transition: background .15s, border-color .15s;
  min-height: 160px;
}

.board-col.drop-target {
  background: rgba(99,102,241,0.07);
  border-color: rgba(99,102,241,0.35);
}

.col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  margin-bottom: 10px;
  border-radius: 8px 8px 0 0;
}

.col-count {
  font-size: 11px;
  font-weight: 700;
  background: rgba(255,255,255,0.06);
  color: var(--ct-muted);
  padding: 2px 8px;
  border-radius: 99px;
}

.job-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: grab;
  transition: background .12s, transform .1s, opacity .12s;
  user-select: none;
}
.job-card:hover { background: rgba(255,255,255,0.07); transform: translateY(-1px); }
.job-card:active { cursor: grabbing; transform: scale(.98); }
.job-card.is-done { opacity: .5; }

.card-type-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
}

.card-type-badge {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
  padding: 2px 6px;
  border-radius: 99px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.card-status {
  font-size: 9px;
  font-weight: 600;
  text-transform: capitalize;
}

.card-client {
  font-size: 12px;
  font-weight: 600;
  color: var(--ct-primary);
  margin-bottom: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-desc {
  font-size: 11px;
  color: var(--ct-muted);
  line-height: 1.4;
  margin-bottom: 4px;
}

.card-time {
  font-size: 10px;
  color: var(--ct-muted);
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 3px;
}

.col-empty {
  font-size: 11px;
  color: var(--ct-muted);
  text-align: center;
  padding: 20px 0;
  opacity: .6;
}

.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Light mode overrides ── */
:global([data-theme="light"] .board-col) {
  background: #ffffff;
  border: 1px solid #9faab8;
}
:global([data-theme="light"] .board-col.drop-target) {
  background: rgba(99,102,241,0.06);
  border-color: rgba(99,102,241,0.4);
}
:global([data-theme="light"] .col-header) {
  border-bottom: 1px solid #d0d5de;
}
:global([data-theme="light"] .col-count) {
  background: rgba(0,0,0,0.06);
  color: #475569;
}
:global([data-theme="light"] .job-card) {
  background: #f7f8fa;
  border: 1px solid #9faab8;
}
:global([data-theme="light"] .job-card:hover) {
  background: #eef0f4;
}
:global([data-theme="light"] .card-client) {
  color: #0f172a;
}
:global([data-theme="light"] .card-desc) {
  color: #475569;
}
:global([data-theme="light"] .card-time) {
  color: #64748b;
}
:global([data-theme="light"] .col-empty) {
  color: #94a3b8;
}
</style>
