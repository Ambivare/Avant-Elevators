<template>
  <div class="page-container">
    <!-- Greeting -->
    <div class="dash-greeting">
      <div>
        <h1 class="dash-title">{{ greeting }}, {{ firstName }} 👋</h1>
        <p class="dash-sub">{{ today }} · {{ roleLabel }}</p>
      </div>
      <div class="dash-actions">
        <button class="btn-secondary btn-sm" @click="refresh">
          <RefreshCw :size="13" :class="{ spin: refreshing }" /> Refresh
        </button>
      </div>
    </div>

    <!-- Role-specific dashboard -->
    <AdminDashboard v-if="role === 'admin'" :stats="stats" :charts="charts" :rawData="rawData" />
    <SalesDashboard v-else-if="role === 'sales'" :stats="stats" />
    <TechDashboard v-else-if="role === 'technician'" :stats="stats" />
    <ReceptionDashboard v-else-if="role === 'reception'" :stats="stats" />
    <UserDashboard v-else :stats="stats" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore, ROLES } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { RefreshCw } from 'lucide-vue-next'
import { useRoute } from 'vue-router'
import { watch } from 'vue'
import AdminDashboard from './AdminDashboard.vue'
import SalesDashboard from './SalesDashboard.vue'
import TechDashboard from './TechDashboard.vue'
import ReceptionDashboard from './ReceptionDashboard.vue'
import UserDashboard from './UserDashboard.vue'

const auth = useAuthStore()
const ui = useUIStore()
const route = useRoute()
const role = computed(() => auth.user?.role || 'user')
const roleLabel = computed(() => ROLES[role.value]?.label || 'User')
const firstName = computed(() => (auth.user?.fullName || auth.user?.username || '').split(' ')[0])

const stats = ref({})
const charts = ref({})
const rawData = ref({})
const refreshing = ref(false)

const today = computed(() => new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
})

async function loadStats() {
  try {
    const [projects, amc, tasks, allComplaintDocs, inventory, employees, leads, invoices] = await Promise.all([
      getAll(Collections.PROJECTS),
      getAll(Collections.AMC),
      getAll(Collections.TASKS),
      getAll(Collections.COMPLAINTS),
      getAll(Collections.INVENTORY),
      getAll(Collections.EMPLOYEES),
      getAll(Collections.LEADS),
      getAll(Collections.PROFORMA_INVOICES),
    ])
    // Exclude timeline activity-log entries (they have recordId; real complaints don't)
    const complaints = allComplaintDocs.filter(c => !c.recordId)

    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()

    stats.value = {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'active' || p.status === 'in-progress').length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      totalAMC: amc.length,
      activeAMC: amc.filter(a => a.status === 'active').length,
      expiringAMC: amc.filter(a => {
        if (!a.endDate) return false
        const d = new Date(a.endDate)
        const diff = (d - now) / (1000 * 60 * 60 * 24)
        return diff >= 0 && diff <= 30
      }).length,
      pendingTasks: tasks.filter(t => t.status === 'pending' || !t.status).length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      openComplaints: complaints.filter(c => c.status !== 'closed' && c.status !== 'resolved').length,
      totalEmployees: employees.length,
      activeEmployees: employees.filter(e => e.status === 'active').length,
      totalLeads: leads.length,
      activeLeads: leads.filter(l => l.status !== 'closed' && l.status !== 'lost').length,
      lowStockItems: inventory.filter(i => Number(i.quantity) <= Number(i.minStock || 5)).length,
      monthlyRevenue: invoices
        .filter(i => {
          const d = i.createdAt?.toDate?.() || new Date(i.createdAt || 0)
          return d.getMonth() === thisMonth && d.getFullYear() === thisYear
        })
        .reduce((sum, i) => sum + Number(i.total || 0), 0),
    }

    // Raw data for expanded card detail views (admin only)
    rawData.value = { projects, amc, tasks, complaints, employees, leads, inventory, invoices }

    // Chart data for admin
    charts.value = {
      projectsByStatus: {
        labels: ['Active', 'Completed', 'On Hold', 'Cancelled'],
        data: [
          projects.filter(p => p.status === 'active' || p.status === 'in-progress').length,
          projects.filter(p => p.status === 'completed').length,
          projects.filter(p => p.status === 'on-hold').length,
          projects.filter(p => p.status === 'cancelled').length,
        ],
      },
      tasksByStatus: {
        labels: ['Pending', 'In Progress', 'Completed'],
        data: [
          tasks.filter(t => t.status === 'pending' || !t.status).length,
          tasks.filter(t => t.status === 'in-progress').length,
          tasks.filter(t => t.status === 'completed').length,
        ],
      },
    }
  } catch {
    ui.error('Failed to load dashboard data.')
  }
}

async function refresh() {
  refreshing.value = true
  await loadStats()
  refreshing.value = false
}

onMounted(loadStats)

// Re-fetch whenever the user navigates back to /dashboard
watch(() => route.path, (path) => {
  if (path === '/dashboard') loadStats()
})
</script>

<style scoped>
.dash-greeting {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.dash-title { font-size: 22px; font-weight: 700; color: #f1f5f9; margin: 0 0 4px; letter-spacing: -0.4px; }
.dash-sub { font-size: 13px; color:var(--ct-muted); margin: 0; }
.dash-actions { display: flex; gap: 8px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 600px) {
  .dash-title { font-size: 18px; }
  .dash-sub { font-size: 12px; }
}

[data-theme="light"] .dash-title { color: #1e293b; }
[data-theme="light"] .dash-sub { color:var(--ct-muted); }
</style>
