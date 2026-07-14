<template>
  <div class="admin-dash">
    <!-- KPI Row 1 -->
    <div class="stats-grid">
      <StatCard icon="FolderOpen" color="indigo" :value="stats.totalProjects" label="Total Projects" :sub="`${stats.activeProjects} active`" @expand="expandCard('projects')" />
      <StatCard icon="Shield" color="purple" :value="stats.totalAMC" label="AMC Contracts" :sub="`${stats.activeAMC} active`" :alert="stats.expiringAMC" alertText="expiring" @expand="expandCard('amc')" />
      <StatCard icon="CheckSquare" color="blue" :value="stats.pendingTasks" label="Pending Tasks" :sub="`${stats.completedTasks} done`" @expand="expandCard('tasks')" />
      <StatCard icon="MessageSquareWarning" color="amber" :value="stats.openComplaints" label="Open Complaints" @expand="expandCard('complaints')" />
      <StatCard icon="Users" color="emerald" :value="stats.totalEmployees" label="Employees" :sub="`${stats.activeEmployees} active`" @expand="expandCard('employees')" />
      <StatCard icon="TrendingUp" color="rose" :value="stats.totalLeads" label="Total Leads" :sub="`${stats.activeLeads} active`" @expand="expandCard('leads')" />
      <StatCard icon="Package" color="cyan" :value="stats.lowStockItems" label="Low Stock Items" @expand="expandCard('inventory')" />
      <StatCard icon="Receipt" color="green" :value="formatCurrency(stats.monthlyRevenue)" label="Monthly Revenue" valueLarge @expand="expandCard('revenue')" />
    </div>

    <!-- Charts row -->
    <div class="charts-grid">
      <div class="glass p-6">
        <h3 class="chart-title">Projects by Status</h3>
        <div class="chart-wrap">
          <Doughnut v-if="projectChartData" :data="projectChartData" :options="doughnutOpts" />
        </div>
      </div>
      <div class="glass p-6">
        <h3 class="chart-title">Tasks Overview</h3>
        <div class="chart-wrap">
          <Bar v-if="taskChartData" :data="taskChartData" :options="barOpts" />
        </div>
      </div>
    </div>

    <!-- Alerts row -->
    <div class="alerts-row" v-if="stats.expiringAMC > 0 || stats.lowStockItems > 0">
      <div class="alert-card amber" v-if="stats.expiringAMC > 0">
        <AlertTriangle :size="16" />
        <span>{{ stats.expiringAMC }} AMC contract(s) expiring within 30 days</span>
        <router-link to="/amc" class="alert-link">Review →</router-link>
      </div>
      <div class="alert-card rose" v-if="stats.lowStockItems > 0">
        <AlertCircle :size="16" />
        <span>{{ stats.lowStockItems }} inventory item(s) below minimum stock</span>
        <router-link to="/warehouse" class="alert-link">Review →</router-link>
      </div>
    </div>
  </div>

  <!-- Card Detail Modal (full screen overlay) -->
  <Teleport to="body">
    <transition name="modal">
      <div v-if="expandedCard" class="modal-backdrop" @click.self="expandedCard = null" style="z-index:200;">
        <div class="modal-panel" style="max-width:860px;width:100%;">
          <div class="modal-header">
            <div>
              <h2 style="font-size:18px;font-weight:700;color:var(--ct-primary);margin:0;">{{ cardTitles[expandedCard] }}</h2>
              <p style="font-size:13px;color:var(--ct-muted);margin:4px 0 0;">Detailed breakdown</p>
            </div>
            <button @click="expandedCard = null" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.09);color:var(--ct-muted);cursor:pointer;">
              <X :size="16" />
            </button>
          </div>
          <div class="modal-body">

            <!-- ── PROJECTS ── -->
            <template v-if="expandedCard === 'projects'">
              <div class="kpi-row">
                <div class="kpi-box" style="--kc:#818cf8"><div class="kpi-val">{{ props.stats.totalProjects }}</div><div class="kpi-lbl">Total</div></div>
                <div class="kpi-box" style="--kc:#34d399"><div class="kpi-val">{{ props.stats.activeProjects }}</div><div class="kpi-lbl">Active</div></div>
                <div class="kpi-box" style="--kc:#60a5fa"><div class="kpi-val">{{ props.stats.completedProjects }}</div><div class="kpi-lbl">Completed</div></div>
                <div class="kpi-box" style="--kc:#f87171"><div class="kpi-val">{{ (props.stats.totalProjects||0)-(props.stats.activeProjects||0)-(props.stats.completedProjects||0) }}</div><div class="kpi-lbl">On Hold</div></div>
              </div>
              <div class="detail-section-title">Status Breakdown</div>
              <div class="chart-wrap" style="height:180px;" v-if="projectBarData"><Bar :data="projectBarData" :options="barOpts" /></div>
              <div class="detail-section-title" style="margin-top:18px;">Recent Projects</div>
              <div class="detail-list">
                <div v-for="p in (props.rawData?.projects||[]).slice(0,8)" :key="p.id" class="detail-row">
                  <div class="detail-row-main">
                    <span class="detail-name">{{ p.projectName || p.clientName || '—' }}</span>
                    <span class="detail-sub">{{ p.address || p.city || '' }}</span>
                  </div>
                  <div class="detail-row-meta">
                    <span class="status-pill" :class="`sp-${p.status||'active'}`">{{ p.status || 'active' }}</span>
                    <span class="detail-value">{{ p.type || p.elevatorType || '' }}</span>
                  </div>
                </div>
                <div v-if="!(props.rawData?.projects?.length)" class="detail-empty">No project data</div>
              </div>
              <div class="detail-footer"><router-link to="/projects" class="btn-primary btn-sm" @click="expandedCard=null" style="text-decoration:none;">Open Projects →</router-link></div>
            </template>

            <!-- ── AMC ── -->
            <template v-else-if="expandedCard === 'amc'">
              <div class="kpi-row">
                <div class="kpi-box" style="--kc:#c084fc"><div class="kpi-val">{{ props.stats.totalAMC }}</div><div class="kpi-lbl">Total</div></div>
                <div class="kpi-box" style="--kc:#34d399"><div class="kpi-val">{{ props.stats.activeAMC }}</div><div class="kpi-lbl">Active</div></div>
                <div class="kpi-box" style="--kc:#fbbf24"><div class="kpi-val">{{ props.stats.expiringAMC }}</div><div class="kpi-lbl">Expiring (30d)</div></div>
                <div class="kpi-box" style="--kc:#f87171"><div class="kpi-val">{{ (props.stats.totalAMC||0)-(props.stats.activeAMC||0) }}</div><div class="kpi-lbl">Inactive</div></div>
              </div>
              <div v-if="props.stats.expiringAMC>0" class="warn-banner">⚠ {{ props.stats.expiringAMC }} contract(s) expire within 30 days</div>
              <div class="detail-section-title">AMC Contracts</div>
              <div class="detail-list">
                <div v-for="a in (props.rawData?.amc||[]).slice(0,8)" :key="a.id" class="detail-row">
                  <div class="detail-row-main">
                    <span class="detail-name">{{ a.clientName || a.projectName || '—' }}</span>
                    <span class="detail-sub">{{ a.address || '' }}</span>
                  </div>
                  <div class="detail-row-meta">
                    <span class="status-pill" :class="`sp-${a.status||'active'}`">{{ a.status||'active' }}</span>
                    <span class="detail-value" :style="isExpiringSoon(a.endDate)?'color:#fbbf24':''">
                      {{ a.endDate ? fmtDate(a.endDate) : '—' }}
                    </span>
                  </div>
                </div>
                <div v-if="!(props.rawData?.amc?.length)" class="detail-empty">No AMC data</div>
              </div>
              <div class="detail-footer"><router-link to="/amc" class="btn-primary btn-sm" @click="expandedCard=null" style="text-decoration:none;">Open AMC →</router-link></div>
            </template>

            <!-- ── TASKS ── -->
            <template v-else-if="expandedCard === 'tasks'">
              <div class="kpi-row">
                <div class="kpi-box" style="--kc:#93c5fd"><div class="kpi-val">{{ props.stats.pendingTasks }}</div><div class="kpi-lbl">Pending</div></div>
                <div class="kpi-box" style="--kc:#fbbf24"><div class="kpi-val">{{ (props.rawData?.tasks||[]).filter(t=>t.status==='in-progress').length }}</div><div class="kpi-lbl">In Progress</div></div>
                <div class="kpi-box" style="--kc:#34d399"><div class="kpi-val">{{ props.stats.completedTasks }}</div><div class="kpi-lbl">Completed</div></div>
              </div>
              <div class="chart-wrap" style="height:160px;margin-bottom:16px;" v-if="taskChartData"><Bar :data="taskChartData" :options="barOpts" /></div>
              <div class="detail-section-title">Pending Tasks</div>
              <div class="detail-list">
                <div v-for="t in (props.rawData?.tasks||[]).filter(x=>x.status!=='completed').slice(0,8)" :key="t.id" class="detail-row">
                  <div class="detail-row-main">
                    <span class="detail-name">{{ t.title || t.taskName || '—' }}</span>
                    <span class="detail-sub">{{ t.assignedTo || t.assignee || '' }}</span>
                  </div>
                  <div class="detail-row-meta">
                    <span class="status-pill" :class="`sp-${t.status||'pending'}`">{{ t.status||'pending' }}</span>
                    <span class="detail-value" :style="t.dueDate&&isOverdue(t.dueDate)?'color:#f87171':''">{{ t.dueDate ? fmtDate(t.dueDate) : '—' }}</span>
                  </div>
                </div>
                <div v-if="!(props.rawData?.tasks?.length)" class="detail-empty">No task data</div>
              </div>
              <div class="detail-footer"><router-link to="/tasks" class="btn-primary btn-sm" @click="expandedCard=null" style="text-decoration:none;">Open Tasks →</router-link></div>
            </template>

            <!-- ── COMPLAINTS ── -->
            <template v-else-if="expandedCard === 'complaints'">
              <div class="kpi-row">
                <div class="kpi-box" style="--kc:#fbbf24"><div class="kpi-val">{{ props.stats.openComplaints }}</div><div class="kpi-lbl">Open</div></div>
                <div class="kpi-box" style="--kc:#34d399"><div class="kpi-val">{{ (props.rawData?.complaints||[]).filter(c=>c.status==='closed'||c.status==='resolved').length }}</div><div class="kpi-lbl">Resolved/Closed</div></div>
                <div class="kpi-box" style="--kc:#f87171"><div class="kpi-val">{{ (props.rawData?.complaints||[]).filter(c=>(c.priority==='high'||c.priority==='urgent')&&c.status!=='closed'&&c.status!=='resolved').length }}</div><div class="kpi-lbl">High Priority</div></div>
              </div>
              <div class="chart-wrap" style="height:160px;margin-bottom:16px;" v-if="complaintsChartData"><Doughnut :data="complaintsChartData" :options="doughnutOpts" /></div>
              <div class="detail-section-title">Open Complaints</div>
              <div class="detail-list">
                <template v-if="(props.rawData?.complaints||[]).filter(x=>x.status!=='closed'&&x.status!=='resolved').length">
                  <div v-for="c in (props.rawData?.complaints||[]).filter(x=>x.status!=='closed'&&x.status!=='resolved').slice(0,8)" :key="c.id" class="detail-row">
                    <div class="detail-row-main">
                      <span class="detail-name">{{ c.clientName || c.complaintNumber || '—' }}</span>
                      <span class="detail-sub">{{ c.description?.slice(0,50) || c.address || '' }}</span>
                    </div>
                    <div class="detail-row-meta">
                      <span class="status-pill" :class="c.priority==='high'||c.priority==='urgent'?'sp-lost':'sp-proposal'">{{ c.priority||'normal' }}</span>
                      <span class="detail-value">{{ (c.assignedTechnicians||[]).join(', ') || c.assignedTo || '—' }}</span>
                    </div>
                  </div>
                </template>
                <div v-else class="detail-empty">No open complaints</div>
              </div>
              <div class="detail-footer"><router-link to="/complaints" class="btn-primary btn-sm" @click="expandedCard=null" style="text-decoration:none;">Open Complaints →</router-link></div>
            </template>

            <!-- ── EMPLOYEES ── -->
            <template v-else-if="expandedCard === 'employees'">
              <div class="kpi-row">
                <div class="kpi-box" style="--kc:#34d399"><div class="kpi-val">{{ props.stats.totalEmployees }}</div><div class="kpi-lbl">Total</div></div>
                <div class="kpi-box" style="--kc:#86efac"><div class="kpi-val">{{ props.stats.activeEmployees }}</div><div class="kpi-lbl">Active</div></div>
                <div class="kpi-box" style="--kc:#f87171"><div class="kpi-val">{{ (props.stats.totalEmployees||0)-(props.stats.activeEmployees||0) }}</div><div class="kpi-lbl">Inactive</div></div>
              </div>
              <div class="chart-wrap" style="height:160px;margin-bottom:16px;" v-if="employeeRoleChartData"><Bar :data="employeeRoleChartData" :options="barOpts" /></div>
              <div class="detail-section-title">Employee List</div>
              <div class="detail-list">
                <div v-for="e in (props.rawData?.employees||[]).slice(0,10)" :key="e.id" class="detail-row">
                  <div class="detail-row-main">
                    <span class="detail-name">{{ e.fullName || e.name || '—' }}</span>
                    <span class="detail-sub">{{ e.designation || e.department || '' }}</span>
                  </div>
                  <div class="detail-row-meta">
                    <span class="status-pill" :class="e.status==='active'?'sp-won':'sp-lost'">{{ e.status||'active' }}</span>
                    <span class="detail-value">{{ e.role || '—' }}</span>
                  </div>
                </div>
                <div v-if="!(props.rawData?.employees?.length)" class="detail-empty">No employee data</div>
              </div>
              <div class="detail-footer"><router-link to="/hr" class="btn-primary btn-sm" @click="expandedCard=null" style="text-decoration:none;">Open HR →</router-link></div>
            </template>

            <!-- ── LEADS ── -->
            <template v-else-if="expandedCard === 'leads'">
              <div class="kpi-row">
                <div class="kpi-box" style="--kc:#fb7185"><div class="kpi-val">{{ props.stats.totalLeads }}</div><div class="kpi-lbl">Total</div></div>
                <div class="kpi-box" style="--kc:#fbbf24"><div class="kpi-val">{{ props.stats.activeLeads }}</div><div class="kpi-lbl">Active</div></div>
                <div class="kpi-box" style="--kc:#34d399"><div class="kpi-val">{{ (props.rawData?.leads||[]).filter(l=>l.stage==='won').length }}</div><div class="kpi-lbl">Won</div></div>
                <div class="kpi-box" style="--kc:#f87171"><div class="kpi-val">{{ (props.rawData?.leads||[]).filter(l=>l.stage==='lost').length }}</div><div class="kpi-lbl">Lost</div></div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
                <div>
                  <div class="detail-section-title">Pipeline by Stage</div>
                  <div class="chart-wrap" style="height:160px;" v-if="leadsStageChartData"><Doughnut :data="leadsStageChartData" :options="doughnutOpts" /></div>
                </div>
                <div>
                  <div class="detail-section-title">Pipeline Value by Stage</div>
                  <div class="chart-wrap" style="height:160px;" v-if="leadsValueChartData"><Bar :data="leadsValueChartData" :options="barOpts" /></div>
                </div>
              </div>
              <div class="detail-section-title">All Leads</div>
              <div class="detail-list">
                <div v-for="l in (props.rawData?.leads||[]).slice(0,10)" :key="l.id" class="detail-row">
                  <div class="detail-row-main">
                    <span class="detail-name">{{ l.clientName || '—' }}</span>
                    <span class="detail-sub">{{ l.contactPerson || '' }} {{ l.phone ? '· '+l.phone : '' }}</span>
                  </div>
                  <div class="detail-row-meta">
                    <span class="status-pill" :class="`sp-${l.stage||'new'}`">{{ l.stage||'new' }}</span>
                    <span class="detail-value" style="color:#34d399;font-weight:600;">{{ l.value ? '₹'+Number(l.value).toLocaleString('en-IN') : '—' }}</span>
                    <span class="detail-sub" style="margin-left:4px;">{{ l.assignedTo||'' }}</span>
                  </div>
                </div>
                <div v-if="!(props.rawData?.leads?.length)" class="detail-empty">No lead data</div>
              </div>
              <div class="detail-footer"><router-link to="/sales" class="btn-primary btn-sm" @click="expandedCard=null" style="text-decoration:none;">Open Sales →</router-link></div>
            </template>

            <!-- ── INVENTORY ── -->
            <template v-else-if="expandedCard === 'inventory'">
              <div class="kpi-row">
                <div class="kpi-box" style="--kc:#67e8f9"><div class="kpi-val">{{ (props.rawData?.inventory||[]).length }}</div><div class="kpi-lbl">Total Items</div></div>
                <div class="kpi-box" style="--kc:#f87171"><div class="kpi-val">{{ props.stats.lowStockItems }}</div><div class="kpi-lbl">Low Stock</div></div>
                <div class="kpi-box" style="--kc:#34d399"><div class="kpi-val">{{ (props.rawData?.inventory||[]).filter(i=>Number(i.quantity)>(Number(i.minStock)||5)).length }}</div><div class="kpi-lbl">Stocked</div></div>
              </div>
              <div v-if="props.stats.lowStockItems>0" class="warn-banner warn-red">⚠ {{ props.stats.lowStockItems }} item(s) below minimum stock level</div>
              <div class="detail-section-title">Low Stock Items</div>
              <div class="detail-list">
                <div v-for="i in (props.rawData?.inventory||[]).filter(x=>Number(x.quantity)<=(Number(x.minStock)||5)).slice(0,8)" :key="i.id" class="detail-row">
                  <div class="detail-row-main">
                    <span class="detail-name">{{ i.name || i.itemName || '—' }}</span>
                    <span class="detail-sub">{{ i.category || '' }}</span>
                  </div>
                  <div class="detail-row-meta">
                    <span class="status-pill sp-lost">Low</span>
                    <span class="detail-value" style="color:#f87171;">Qty: {{ i.quantity ?? '—' }} / Min: {{ i.minStock || 5 }}</span>
                  </div>
                </div>
                <div v-if="!(props.rawData?.inventory?.filter(x=>Number(x.quantity)<=(Number(x.minStock)||5)).length)" class="detail-empty">All items well-stocked</div>
              </div>
              <div class="detail-footer"><router-link to="/warehouse" class="btn-primary btn-sm" @click="expandedCard=null" style="text-decoration:none;">Open Inventory →</router-link></div>
            </template>

            <!-- ── REVENUE ── -->
            <template v-else-if="expandedCard === 'revenue'">
              <div class="kpi-row">
                <div class="kpi-box" style="--kc:#86efac;flex:1"><div class="kpi-val" style="font-size:20px;">{{ formatCurrency(props.stats.monthlyRevenue) }}</div><div class="kpi-lbl">This Month</div></div>
                <div class="kpi-box" style="--kc:#60a5fa"><div class="kpi-val">{{ (props.rawData?.invoices||[]).filter(i=>isSameMonth(i.createdAt)).length }}</div><div class="kpi-lbl">Invoices (MTD)</div></div>
              </div>
              <div class="detail-section-title" style="margin-top:8px;">Recent Invoices This Month</div>
              <div class="detail-list">
                <div v-for="inv in (props.rawData?.invoices||[]).filter(i=>isSameMonth(i.createdAt)).slice(0,8)" :key="inv.id" class="detail-row">
                  <div class="detail-row-main">
                    <span class="detail-name">{{ inv.clientName || inv.clientName || '—' }}</span>
                    <span class="detail-sub">{{ inv.invoiceNo || '' }}</span>
                  </div>
                  <div class="detail-row-meta">
                    <span class="status-pill sp-won">paid</span>
                    <span class="detail-value" style="color:#86efac;font-weight:600;">{{ formatCurrency(inv.total||0) }}</span>
                  </div>
                </div>
                <div v-if="!(props.rawData?.invoices?.filter(i=>isSameMonth(i.createdAt)).length)" class="detail-empty">No invoices this month</div>
              </div>
              <div class="detail-footer"><router-link to="/billing" class="btn-primary btn-sm" @click="expandedCard=null" style="text-decoration:none;">Open Billing →</router-link></div>
            </template>

          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Doughnut, Bar } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js'
import StatCard from './StatCard.vue'
import { AlertTriangle, AlertCircle, X } from 'lucide-vue-next'
import { useSettingsStore } from '@/stores/settings'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

const props = defineProps({ stats: Object, charts: Object, rawData: Object })
const settings = useSettingsStore()

function formatCurrency(val) {
  return `${settings.settings.currency || '₹'}${Number(val || 0).toLocaleString('en-IN')}`
}

const projectChartData = computed(() => {
  if (!props.charts?.projectsByStatus) return null
  return {
    labels: props.charts.projectsByStatus.labels,
    datasets: [{
      data: props.charts.projectsByStatus.data,
      backgroundColor: ['rgba(99,102,241,0.7)', 'rgba(16,185,129,0.7)', 'rgba(245,158,11,0.7)', 'rgba(239,68,68,0.7)'],
      borderWidth: 0,
      hoverOffset: 4,
    }],
  }
})

const taskChartData = computed(() => {
  if (!props.charts?.tasksByStatus) return null
  return {
    labels: props.charts.tasksByStatus.labels,
    datasets: [{
      label: 'Tasks',
      data: props.charts.tasksByStatus.data,
      backgroundColor: ['rgba(99,102,241,0.6)', 'rgba(245,158,11,0.6)', 'rgba(16,185,129,0.6)'],
      borderRadius: 6,
      borderWidth: 0,
    }],
  }
})

const expandedCard = ref(null)

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—'
  const dt = d?.toDate ? d.toDate() : new Date(d)
  if (isNaN(dt)) return '—'
  return dt.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
}
function isOverdue(d) {
  if (!d) return false
  const dt = d?.toDate ? d.toDate() : new Date(d)
  return !isNaN(dt) && dt < new Date()
}
function isExpiringSoon(d) {
  if (!d) return false
  const dt = d?.toDate ? d.toDate() : new Date(d)
  if (isNaN(dt)) return false
  const diff = (dt - Date.now()) / 86400000
  return diff >= 0 && diff <= 30
}
function isSameMonth(d) {
  const dt = d?.toDate ? d.toDate() : new Date(d || 0)
  const now = new Date()
  return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear()
}

const cardTitles = {
  projects: 'Projects Overview',
  amc: 'AMC Contracts Overview',
  tasks: 'Tasks Overview',
  complaints: 'Complaints Overview',
  employees: 'Employees Overview',
  leads: 'Sales Leads Overview',
  inventory: 'Inventory Overview',
  revenue: 'Revenue Overview',
}

function expandCard(key) { expandedCard.value = key }

const complaintsChartData = computed(() => {
  const data = props.rawData?.complaints || []
  const open       = data.filter(c => c.status !== 'closed' && c.status !== 'resolved').length
  const inProgress = data.filter(c => c.status === 'in-progress').length
  const resolved   = data.filter(c => c.status === 'resolved').length
  const closed     = data.filter(c => c.status === 'closed').length
  if (!data.length) return null
  return {
    labels: ['Open', 'In Progress', 'Resolved', 'Closed'],
    datasets: [{ data: [open - inProgress, inProgress, resolved, closed], backgroundColor: ['rgba(251,191,36,0.7)','rgba(99,102,241,0.7)','rgba(52,211,153,0.7)','rgba(107,114,128,0.7)'], borderWidth: 0 }],
  }
})

const employeeRoleChartData = computed(() => {
  const data = props.rawData?.employees || []
  if (!data.length) return null
  const roles = {}
  data.forEach(e => { const r = e.role || 'other'; roles[r] = (roles[r] || 0) + 1 })
  return {
    labels: Object.keys(roles),
    datasets: [{ label: 'Employees', data: Object.values(roles), backgroundColor: ['rgba(99,102,241,0.6)','rgba(52,211,153,0.6)','rgba(245,158,11,0.6)','rgba(239,68,68,0.6)','rgba(167,139,250,0.6)'], borderRadius: 6, borderWidth: 0 }],
  }
})

const STAGE_ORDER = ['new','contacted','qualified','proposal','negotiation','won','lost']
const STAGE_COLORS = { new:'rgba(148,163,184,0.7)', contacted:'rgba(96,165,250,0.7)', qualified:'rgba(167,139,250,0.7)', proposal:'rgba(251,191,36,0.7)', negotiation:'rgba(251,146,60,0.7)', won:'rgba(52,211,153,0.7)', lost:'rgba(248,113,113,0.7)' }

const leadsStageChartData = computed(() => {
  const data = props.rawData?.leads || []
  if (!data.length) return null
  const counts = {}
  STAGE_ORDER.forEach(s => { counts[s] = data.filter(l => (l.stage||'new') === s).length })
  const labels = STAGE_ORDER.filter(s => counts[s] > 0)
  return { labels, datasets: [{ data: labels.map(s => counts[s]), backgroundColor: labels.map(s => STAGE_COLORS[s] || 'rgba(99,102,241,0.6)'), borderWidth: 0 }] }
})

const leadsValueChartData = computed(() => {
  const data = props.rawData?.leads || []
  if (!data.length) return null
  const vals = {}
  STAGE_ORDER.slice(0, 5).forEach(s => { vals[s] = data.filter(l => (l.stage||'new') === s).reduce((sum,l) => sum + Number(l.value||0), 0) })
  const labels = Object.keys(vals).filter(s => vals[s] > 0)
  return {
    labels,
    datasets: [{ label: 'Value (₹)', data: labels.map(s => vals[s]), backgroundColor: labels.map(s => STAGE_COLORS[s] || 'rgba(99,102,241,0.6)'), borderRadius: 6, borderWidth: 0 }],
  }
})

const projectBarData = computed(() => {
  if (!props.charts?.projectsByStatus) return null
  return {
    labels: props.charts.projectsByStatus.labels,
    datasets: [{
      label: 'Projects',
      data: props.charts.projectsByStatus.data,
      backgroundColor: ['rgba(99,102,241,0.6)', 'rgba(16,185,129,0.6)', 'rgba(245,158,11,0.6)', 'rgba(239,68,68,0.6)'],
      borderRadius: 6,
      borderWidth: 0,
    }],
  }
})

const doughnutOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { color: '#64748b', padding: 12, font: { size: 11 } } },
    tooltip: { bodyColor: '#e2e8f0', titleColor: '#94a3b8', backgroundColor: 'rgba(10,10,20,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 },
  },
}

const barOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { bodyColor: '#e2e8f0', titleColor: '#94a3b8', backgroundColor: 'rgba(10,10,20,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 },
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 11 } } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 11 } } },
  },
}
</script>

<style scoped>
.admin-dash { display: flex; flex-direction: column; gap: 24px; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 768px) { .charts-grid { grid-template-columns: 1fr; } }
@media (max-width: 600px) {
  .admin-dash { gap: 16px; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .chart-wrap { height: 180px; }
}
.chart-title { font-size: 14px; font-weight: 600; color:var(--ct-sub); margin: 0 0 16px; }
.chart-wrap { height: 220px; }
.alerts-row { display: flex; flex-direction: column; gap: 8px; }
.alert-card {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; border-radius: 12px;
  font-size: 13px;
  flex-wrap: wrap;
}
.alert-card.amber { background: rgba(245,158,11,0.08); color: #fbbf24; border: 1px solid rgba(245,158,11,0.18); }
.alert-card.rose { background: rgba(239,68,68,0.08); color: #f87171; border: 1px solid rgba(239,68,68,0.18); }
.alert-link { margin-left: auto; font-size: 12px; font-weight: 600; text-decoration: none; opacity: 0.8; color: inherit; }
.alert-link:hover { opacity: 1; }

/* ── Expanded card detail styles ─────────────────────────────────────────── */
.kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 20px; }
.kpi-box {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px; padding: 14px 16px; text-align: center;
  border-top: 3px solid var(--kc, #6366f1);
}
.kpi-val { font-size: 26px; font-weight: 800; color: var(--kc, #818cf8); line-height: 1.1; }
.kpi-lbl { font-size: 11px; color: var(--ct-muted); margin-top: 5px; font-weight: 500; }

.detail-section-title {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .07em; color: var(--ct-muted);
  padding: 0 0 8px; border-bottom: 1px solid rgba(255,255,255,0.05);
  margin-bottom: 10px;
}
.detail-list { display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; }
.detail-list::-webkit-scrollbar { width: 3px; }
.detail-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
.detail-row {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 10px 12px; border-radius: 10px;
  background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.05);
  transition: background .15s;
}
.detail-row:hover { background: rgba(255,255,255,0.045); }
.detail-row-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.detail-name { font-size: 13px; font-weight: 600; color: var(--ct-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.detail-sub { font-size: 11px; color: var(--ct-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.detail-row-meta { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.detail-value { font-size: 12px; color: var(--ct-sub); }
.detail-empty { text-align: center; padding: 24px; color: #334155; font-size: 13px; }
.detail-footer { padding-top: 16px; text-align: center; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 16px; }

.status-pill {
  font-size: 10px; font-weight: 700; padding: 2px 8px;
  border-radius: 99px; text-transform: capitalize; white-space: nowrap;
}
.sp-new,.sp-pending    { background: rgba(148,163,184,.15); color: #94a3b8; }
.sp-active,.sp-won     { background: rgba(52,211,153,.15);  color: #34d399; }
.sp-contacted,.sp-in-progress { background: rgba(96,165,250,.15); color: #60a5fa; }
.sp-qualified,.sp-completed   { background: rgba(167,139,250,.15); color: #a78bfa; }
.sp-proposal           { background: rgba(251,191,36,.15);  color: #fbbf24; }
.sp-negotiation        { background: rgba(251,146,60,.15);  color: #fb923c; }
.sp-lost               { background: rgba(248,113,113,.15); color: #f87171; }

.warn-banner { padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 14px; background: rgba(245,158,11,.08); border: 1px solid rgba(245,158,11,.2); color: #fbbf24; }
.warn-red { background: rgba(239,68,68,.08); border-color: rgba(239,68,68,.2); color: #f87171; }
</style>
