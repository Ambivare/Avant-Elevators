<template>
  <!-- Backdrop -->
  <Transition name="backdrop">
    <div v-if="modelValue" class="notif-backdrop" @click="$emit('update:modelValue', false)" />
  </Transition>

  <!-- Slide-in Panel -->
  <Transition name="notif-slide">
    <div v-if="modelValue" class="notif-panel">
      <!-- Header -->
      <div class="notif-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:34px;height:34px;background:rgba(99,102,241,0.12);border-radius:10px;display:flex;align-items:center;justify-content:center;">
            <Bell :size="16" style="color:var(--ct-accent);" />
          </div>
          <div>
            <div style="font-size:15px;font-weight:700;color:var(--ct-primary);">Notifications</div>
            <div style="font-size:11px;color:var(--ct-muted);">{{ totalCount }} active alerts</div>
          </div>
        </div>
        <button class="notif-close" @click="$emit('update:modelValue', false)">
          <X :size="16" />
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" style="padding:48px;text-align:center;color:var(--ct-muted);">
        <Loader2 :size="24" style="animation:spin 1s linear infinite;margin:0 auto 10px;display:block;" />
        <p style="font-size:13px;">Loading notifications…</p>
      </div>

      <!-- Content -->
      <div v-else class="notif-scroll">

        <!-- New QR Tickets (admin real-time) -->
        <div v-if="newTickets.length" class="notif-section">
          <div class="notif-section-title">
            <Ticket :size="13" style="color:#34d399;" /> New QR Tickets
            <span class="notif-count green">{{ newTickets.length }}</span>
          </div>
          <div v-for="item in newTickets" :key="item.id" class="notif-item green" @click="navigate('tickets')">
            <div class="notif-icon green"><Ticket :size="14" /></div>
            <div class="notif-body">
              <div class="notif-title">{{ item.reporterName || 'Anonymous' }} · {{ item.liftId || '—' }}</div>
              <div class="notif-sub">{{ item.issueType || 'Issue' }} · {{ item.ticketRef || item.id.slice(0,8) }}</div>
            </div>
            <div class="notif-badge green">New</div>
          </div>
        </div>

        <!-- AMC Renewals -->
        <div v-if="renewals.length" class="notif-section">
          <div class="notif-section-title">
            <RefreshCw :size="13" style="color:#fbbf24;" /> AMC Renewals
            <span class="notif-count warning">{{ renewals.length }}</span>
          </div>
          <div v-for="item in renewals" :key="item.id" class="notif-item warning" @click="navigate('amc')">
            <div class="notif-icon warning"><RefreshCw :size="14" /></div>
            <div class="notif-body">
              <div class="notif-title">{{ item.clientName }}</div>
              <div class="notif-sub">Contract {{ item.contractNumber }} · expires in <strong>{{ item.daysLeft }}d</strong></div>
            </div>
            <div class="notif-badge warning">{{ item.daysLeft }}d</div>
          </div>
        </div>

        <!-- Open Complaints -->
        <div v-if="openComplaints.length" class="notif-section">
          <div class="notif-section-title">
            <MessageSquareWarning :size="13" style="color:#f87171;" /> Open Complaints
            <span class="notif-count danger">{{ openComplaints.length }}</span>
          </div>
          <div v-for="item in openComplaints" :key="item.id" class="notif-item danger" @click="navigate('complaints')">
            <div class="notif-icon danger"><MessageSquareWarning :size="14" /></div>
            <div class="notif-body">
              <div class="notif-title">{{ item.clientName }}</div>
              <div class="notif-sub">{{ item.issueType || 'Issue' }} · <span :class="priorityClass(item.priority)">{{ item.priority }}</span> priority</div>
            </div>
            <div class="notif-badge danger">{{ formatStatus(item.status) }}</div>
          </div>
        </div>

        <!-- Pending Repairs -->
        <div v-if="pendingRepairs.length" class="notif-section">
          <div class="notif-section-title">
            <Hammer :size="13" style="color:#93c5fd;" /> Pending Repairs
            <span class="notif-count info">{{ pendingRepairs.length }}</span>
          </div>
          <div v-for="item in pendingRepairs" :key="item.id" class="notif-item info" @click="navigate('repairs')">
            <div class="notif-icon info"><Hammer :size="14" /></div>
            <div class="notif-body">
              <div class="notif-title">{{ item.clientName || item.projectName || 'Unknown' }}</div>
              <div class="notif-sub">{{ item.repairType || 'Repair' }} · {{ item.faultDescription?.slice(0, 40) || '—' }}</div>
            </div>
            <div class="notif-badge info">{{ item.status }}</div>
          </div>
        </div>

        <!-- Overdue Tasks -->
        <div v-if="overdueTasks.length" class="notif-section">
          <div class="notif-section-title">
            <CheckSquare :size="13" style="color:#f87171;" /> Overdue Tasks
            <span class="notif-count danger">{{ overdueTasks.length }}</span>
          </div>
          <div v-for="item in overdueTasks" :key="item.id" class="notif-item danger" @click="navigate('tasks')">
            <div class="notif-icon danger"><CheckSquare :size="14" /></div>
            <div class="notif-body">
              <div class="notif-title">{{ item.title || item.description || 'Task' }}</div>
              <div class="notif-sub">Due: <strong style="color:#f87171;">{{ formatDate(item.dueDate) }}</strong> · {{ item.assignedTo || 'Unassigned' }}</div>
            </div>
            <div class="notif-badge danger">Overdue</div>
          </div>
        </div>

        <!-- Expiring Projects (completion due) -->
        <div v-if="expiringProjects.length" class="notif-section">
          <div class="notif-section-title">
            <FolderOpen :size="13" style="color:var(--ct-accent);" /> Projects Due Soon
            <span class="notif-count indigo">{{ expiringProjects.length }}</span>
          </div>
          <div v-for="item in expiringProjects" :key="item.id" class="notif-item indigo" @click="navigate('projects')">
            <div class="notif-icon indigo"><FolderOpen :size="14" /></div>
            <div class="notif-body">
              <div class="notif-title">{{ item.projectName }}</div>
              <div class="notif-sub">Expected by {{ formatDate(item.expectedCompletion) }} · {{ item.clientName }}</div>
            </div>
            <div class="notif-badge indigo">{{ item.daysLeft }}d</div>
          </div>
        </div>

        <!-- All clear -->
        <div v-if="totalCount === 0" style="padding:48px 24px;text-align:center;">
          <div style="width:56px;height:56px;background:rgba(16,185,129,0.1);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">
            <CheckCircle2 :size="26" style="color:var(--ct-green);" />
          </div>
          <div style="font-size:14px;font-weight:600;color:var(--ct-primary);margin-bottom:4px;">All Clear!</div>
          <div style="font-size:12px;color:var(--ct-muted);">No pending alerts or notifications.</div>
        </div>
      </div>

      <!-- Footer -->
      <div class="notif-footer">
        <button class="btn-secondary btn-sm" style="width:100%;justify-content:center;" @click="loadData">
          <RefreshCw :size="13" /> Refresh
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Bell, X, RefreshCw, MessageSquareWarning, Hammer,
  CheckSquare, FolderOpen, CheckCircle2, Loader2, Ticket,
} from 'lucide-vue-next'
import { where } from 'firebase/firestore'
import { getAll, subscribe } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue', 'count'])
const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const today = new Date()
const todayStr = today.toISOString().slice(0, 10)

const renewals = ref([])
const openComplaints = ref([])
const pendingRepairs = ref([])
const overdueTasks = ref([])
const expiringProjects = ref([])
const newTickets = ref([])

const totalCount = computed(() =>
  renewals.value.length + openComplaints.value.length +
  pendingRepairs.value.length + overdueTasks.value.length +
  expiringProjects.value.length + newTickets.value.length
)

watch(totalCount, (n) => emit('count', n), { immediate: true })

// Real-time listener for new QR tickets — starts on mount so bell badge is always live
let unsubTickets = null
onMounted(() => {
  if (authStore.role !== 'admin') return
  unsubTickets = subscribe(
    Collections.TICKETS,
    (docs) => { newTickets.value = docs.filter(t => t.status === 'new') },
    [where('status', '==', 'new')]
  )
})
onUnmounted(() => { unsubTickets?.() })

async function loadData() {
  loading.value = true
  const role = authStore.role
  const myName = authStore.user?.fullName || authStore.user?.username || ''

  try {
    const isAdmin = role === 'admin'
    const isSales = role === 'sales'
    const isTech  = role === 'technician'

    const [amc, complaints, repairs, tasks, projects] = await Promise.all([
      (isAdmin || isSales) ? getAll(Collections.AMC) : Promise.resolve([]),
      getAll(Collections.COMPLAINTS),
      getAll(Collections.REPAIRS),
      getAll(Collections.TASKS),
      (isAdmin || isSales) ? getAll(Collections.PROJECTS) : Promise.resolve([]),
    ])

    // AMC renewals — admin + sales only
    if (isAdmin || isSales) {
      renewals.value = amc
        .filter(c => c.status === 'active' && c.endDate)
        .map(c => {
          const end = c.endDate?.toDate ? c.endDate.toDate() : new Date(c.endDate)
          const daysLeft = Math.ceil((end - today) / (1000 * 60 * 60 * 24))
          return { ...c, daysLeft }
        })
        .filter(c => c.daysLeft >= 0 && c.daysLeft <= 45)
        .sort((a, b) => a.daysLeft - b.daysLeft)
    } else {
      renewals.value = []
    }

    // Complaints — admin sees all; others see only assigned to them
    openComplaints.value = complaints
      .filter(c => {
        if (!['open', 'in-progress'].includes(c.status)) return false
        if (isAdmin) return true
        return c.assignedTo === myName
      })
      .slice(0, 15)

    // Repairs — admin sees all; technician sees assigned; sales/others skip
    pendingRepairs.value = isSales ? [] : repairs
      .filter(r => {
        if (!['reported', 'diagnosed'].includes(r.status)) return false
        if (isAdmin) return true
        if (isTech) return r.assignedTo === myName || r.assignedTechnician === myName || r.technicianName === myName
        return false
      })
      .slice(0, 15)

    // Tasks — admin sees all overdue; others see only their own
    overdueTasks.value = tasks
      .filter(t => {
        if (!t.dueDate || t.dueDate >= todayStr) return false
        if (['completed', 'done'].includes(t.status)) return false
        if (isAdmin) return true
        return t.assignedTo === myName
      })
      .slice(0, 10)

    // Projects due soon — admin + sales only
    if (isAdmin || isSales) {
      expiringProjects.value = projects
        .filter(p => p.status === 'active' && p.expectedCompletion)
        .map(p => {
          const d = p.expectedCompletion?.toDate ? p.expectedCompletion.toDate() : new Date(p.expectedCompletion)
          const daysLeft = Math.ceil((d - today) / (1000 * 60 * 60 * 24))
          return { ...p, daysLeft }
        })
        .filter(p => p.daysLeft >= 0 && p.daysLeft <= 14)
        .sort((a, b) => a.daysLeft - b.daysLeft)
        .slice(0, 10)
    } else {
      expiringProjects.value = []
    }
  } catch (e) {
    console.error('Failed to load notifications', e)
  } finally {
    loading.value = false
  }
}

watch(() => props.modelValue, (open) => {
  if (open) loadData()
}, { immediate: false })

function navigate(path) {
  router.push('/' + path)
  emit('update:modelValue', false)
}

function formatDate(val) {
  if (!val) return '—'
  const d = val?.toDate ? val.toDate() : new Date(val)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatStatus(s) {
  return { 'open': 'Open', 'in-progress': 'In Progress', 'resolved': 'Resolved' }[s] || s
}

function priorityClass(p) {
  return { urgent: 'color:#f87171', high: 'color:#fbbf24', medium: 'color:#93c5fd', low: 'color:var(--ct-green)' }[p] || ''
}
</script>

<style scoped>
.notif-backdrop {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(4px);
}
.notif-panel {
  position: fixed; top: 0; right: 0; bottom: 0; z-index: 201;
  width: 400px; max-width: 100vw;
  display: flex; flex-direction: column;
  background: rgba(10,10,20,0.97);
  border-left: 1px solid rgba(255,255,255,0.08);
  box-shadow: -20px 0 60px rgba(0,0,0,0.5);
}
.notif-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 20px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.notif-close {
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  border-radius: 9px; background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08); color:var(--ct-muted); cursor: pointer;
  transition: all .18s;
}
.notif-close:hover { background: rgba(255,255,255,0.1); color:var(--ct-sub); }

.notif-scroll { flex: 1; overflow-y: auto; padding: 12px 0; }

.notif-section { padding: 0 12px 4px; margin-bottom: 4px; }
.notif-section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  color:var(--ct-muted); padding: 10px 8px 8px;
}
.notif-count {
  margin-left: auto; padding: 2px 7px; border-radius: 99px; font-size: 10px; font-weight: 700;
}
.notif-count.warning  { background: rgba(245,158,11,0.15); color: #fbbf24; }
.notif-count.danger   { background: rgba(239,68,68,0.12);  color: #f87171; }
.notif-count.info     { background: rgba(59,130,246,0.12); color: #93c5fd; }
.notif-count.indigo   { background: rgba(99,102,241,0.12); color:var(--ct-accent); }
.notif-count.green    { background: rgba(52,211,153,0.15); color: #34d399; }

.notif-item {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 10px; border-radius: 10px; cursor: pointer;
  margin-bottom: 3px; transition: all .15s;
}
.notif-item:hover { background: rgba(255,255,255,0.04); }
.notif-item.warning:hover  { background: rgba(245,158,11,0.06); }
.notif-item.danger:hover   { background: rgba(239,68,68,0.06); }
.notif-item.info:hover     { background: rgba(59,130,246,0.06); }
.notif-item.indigo:hover   { background: rgba(99,102,241,0.06); }
.notif-item.green:hover    { background: rgba(52,211,153,0.06); }

.notif-icon {
  width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.notif-icon.warning  { background: rgba(245,158,11,0.12); color: #fbbf24; border: 1px solid rgba(245,158,11,0.18); }
.notif-icon.danger   { background: rgba(239,68,68,0.1);   color: #f87171; border: 1px solid rgba(239,68,68,0.15); }
.notif-icon.info     { background: rgba(59,130,246,0.1);  color: #93c5fd; border: 1px solid rgba(59,130,246,0.15); }
.notif-icon.indigo   { background: rgba(99,102,241,0.1);  color:var(--ct-accent); border: 1px solid rgba(99,102,241,0.15); }
.notif-icon.green    { background: rgba(52,211,153,0.1);  color: #34d399; border: 1px solid rgba(52,211,153,0.18); }

.notif-body { flex: 1; min-width: 0; }
.notif-title { font-size: 13px; font-weight: 600; color:var(--ct-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.notif-sub   { font-size: 11px; color:var(--ct-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.notif-badge {
  font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 99px; flex-shrink: 0;
}
.notif-badge.warning  { background: rgba(245,158,11,0.15);  color: #fbbf24; }
.notif-badge.danger   { background: rgba(239,68,68,0.12);   color: #f87171; }
.notif-badge.info     { background: rgba(59,130,246,0.12);  color: #93c5fd; }
.notif-badge.indigo   { background: rgba(99,102,241,0.12);  color:var(--ct-accent); }
.notif-badge.green    { background: rgba(52,211,153,0.15);  color: #34d399; }

.notif-footer {
  padding: 14px 20px;
  border-top: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}

/* Light theme */
[data-theme="light"] .notif-panel {
  background: rgba(255,255,255,0.99);
  border-left-color: rgba(0,0,0,0.09);
  box-shadow: -20px 0 60px rgba(0,0,0,0.15);
}
[data-theme="light"] .notif-header { border-bottom-color: rgba(0,0,0,0.07); }
[data-theme="light"] .notif-close { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.08); color:var(--ct-muted); }
[data-theme="light"] .notif-close:hover { background: rgba(0,0,0,0.09); }
[data-theme="light"] .notif-title { color: #1e293b; }
[data-theme="light"] .notif-section-title { color:var(--ct-sub); }
[data-theme="light"] .notif-footer { border-top-color: rgba(0,0,0,0.07); }
[data-theme="light"] .notif-item:hover { background: rgba(0,0,0,0.03); }

/* Transitions */
.notif-slide-enter-active, .notif-slide-leave-active { transition: transform 0.28s cubic-bezier(0.16,1,0.3,1); }
.notif-slide-enter-from, .notif-slide-leave-to { transform: translateX(100%); }
.backdrop-enter-active, .backdrop-leave-active { transition: opacity 0.22s ease; }
.backdrop-enter-from, .backdrop-leave-to { opacity: 0; }

@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
</style>
