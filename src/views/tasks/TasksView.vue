<template>
  <div class="page-container">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Task Management</h1>
        <p class="page-subtitle">Clear priorities, assigned and delivered on time.</p>
      </div>
      <div class="header-actions">
        <button class="btn-secondary btn-sm" @click="toggleView">
          <LayoutList v-if="viewMode === 'kanban'" :size="16" />
          <Kanban v-else :size="16" />
          {{ viewMode === 'kanban' ? 'List View' : 'Kanban View' }}
        </button>
        <button class="btn-primary" @click="openAddModal" v-if="canCreate">
          <Plus :size="16" />
          Add Task
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

    <!-- Filters -->
    <div class="glass filters-bar">
      <div class="filter-group">
        <Search :size="16" class="filter-icon" />
        <input
          v-model="search"
          type="text"
          class="input filter-input"
          placeholder="Search tasks..."
        />
      </div>
      <select v-model="filterPriority" class="input filter-select">
        <option value="">All Priorities</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </select>
      <select v-model="filterStatus" class="input filter-select">
        <option value="">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="in_progress">In Progress</option>
        <option value="completed">Completed</option>
        <option value="on_hold">On Hold</option>
      </select>
      <select v-model="filterAssignee" class="input filter-select" v-if="isAdminOrStaff">
        <option value="">All Assignees</option>
        <option v-for="emp in employees" :key="emp.id" :value="emp.id">{{ emp.fullName }}</option>
      </select>
      <div class="filter-group">
        <input v-model="filterDateFrom" type="date" class="input filter-date" />
        <span class="filter-sep">to</span>
        <input v-model="filterDateTo" type="date" class="input filter-date" />
      </div>
      <button class="btn-secondary btn-sm" @click="clearFilters">
        <X :size="14" /> Clear
      </button>
    </div>

    <!-- List View -->
    <div v-if="viewMode === 'list'" class="glass table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Assigned To</th>
            <th>Priority</th>
            <th>Due Date</th>
            <th>Status</th>
            <th>Project</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredTasks.length === 0">
            <td colspan="7">
              <div class="empty-state">
                <ClipboardList :size="40" class="empty-icon" />
                <p>No tasks found</p>
              </div>
            </td>
          </tr>
          <tr v-for="task in filteredTasks" :key="task.id"
            :class="{ 'row-overdue': isOverdue(task) }"
            style="cursor:pointer;" @click="openView(task)">
            <td>
              <div class="task-title-cell">
                <span class="task-title">{{ task.title }}</span>
                <div class="task-meta-row">
                  <span v-if="isOverdue(task)" class="overdue-badge">
                    <AlertCircle :size="12" /> Overdue
                  </span>
                  <span class="task-category">{{ task.category }}</span>
                </div>
              </div>
            </td>
            <td>
              <div class="assignee-cell">
                <div class="avatar-sm">{{ getInitials(getEmployeeName(task.assignedTo)) }}</div>
                <span>{{ getEmployeeName(task.assignedTo) }}</span>
              </div>
            </td>
            <td>
              <span class="priority-badge" :class="`priority-${task.priority}`">
                {{ task.priority }}
              </span>
            </td>
            <td :class="{ 'text-danger': isOverdue(task) }">
              {{ formatDate(task.dueDate) }}
            </td>
            <td @click.stop>
              <select
                class="status-select"
                :class="`status-${task.status}`"
                :value="task.status"
                @change="updateStatus(task, $event.target.value)"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
              </select>
            </td>
            <td>
              <span v-if="task.projectId" class="project-link">
                <Link2 :size="12" />
                {{ getProjectName(task.projectId) }}
              </span>
              <span v-else class="text-muted">—</span>
            </td>
            <td>
              <div class="action-btns" @click.stop>
                <button class="btn-secondary btn-sm icon-btn" @click="openEditModal(task)" title="Edit">
                  <Pencil :size="14" />
                </button>
                <button class="btn-danger btn-sm icon-btn" @click="confirmDelete(task)" title="Delete" v-if="canDelete">
                  <Trash2 :size="14" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Kanban View -->
    <div v-else class="kanban-board">
      <div v-for="col in kanbanColumns" :key="col.key" class="kanban-col">
        <div class="kanban-col-header">
          <span class="kanban-col-title">{{ col.label }}</span>
          <span class="kanban-col-count">{{ getKanbanTasks(col.key).length }}</span>
        </div>
        <div class="kanban-cards">
          <div v-if="getKanbanTasks(col.key).length === 0" class="kanban-empty">
            No tasks
          </div>
          <div
            v-for="task in getKanbanTasks(col.key)"
            :key="task.id"
            class="kanban-card glass"
            :class="{ 'card-overdue': isOverdue(task) }"
            style="cursor:pointer;" @click="openView(task)"
          >
            <div class="kanban-card-header">
              <span class="priority-badge" :class="`priority-${task.priority}`">{{ task.priority }}</span>
              <div class="action-btns" @click.stop>
                <button class="btn-secondary btn-sm icon-btn" @click="openEditModal(task)">
                  <Pencil :size="12" />
                </button>
                <button class="btn-danger btn-sm icon-btn" @click="confirmDelete(task)" v-if="canDelete">
                  <Trash2 :size="12" />
                </button>
              </div>
            </div>
            <p class="kanban-card-title">{{ task.title }}</p>
            <p v-if="task.description" class="kanban-card-desc">{{ task.description }}</p>
            <div class="kanban-card-footer">
              <div class="assignee-cell">
                <div class="avatar-sm">{{ getInitials(getEmployeeName(task.assignedTo)) }}</div>
                <span class="text-xs">{{ getEmployeeName(task.assignedTo) }}</span>
              </div>
              <div class="kanban-meta">
                <span v-if="isOverdue(task)" class="overdue-badge"><AlertCircle :size="10" /> Overdue</span>
                <span class="due-date" :class="{ 'text-danger': isOverdue(task) }">
                  <Calendar :size="11" /> {{ formatDate(task.dueDate) }}
                </span>
              </div>
            </div>
            <div class="kanban-status-row" @click.stop>
              <select
                class="status-select-sm"
                :class="`status-${task.status}`"
                :value="task.status"
                @change="updateStatus(task, $event.target.value)"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Task Detail View Modal -->
    <AppModal v-model="showViewModal" :title="viewTarget?.title || 'Task Details'" width="560px">
      <div v-if="viewTarget" style="display:flex;flex-direction:column;gap:14px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <span class="priority-badge" :class="`priority-${viewTarget.priority}`">{{ viewTarget.priority }}</span>
          <span class="status-badge" :class="`status-${viewTarget.status}`" style="padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;text-transform:capitalize;">{{ (viewTarget.status||'').replace('_',' ') }}</span>
          <span v-if="isOverdue(viewTarget)" style="font-size:11px;color:#f87171;display:flex;align-items:center;gap:4px;"><AlertCircle :size="11"/> Overdue</span>
        </div>
        <div v-if="viewTarget.description" style="font-size:13px;color:var(--ct-sub);line-height:1.6;padding:12px 14px;background:rgba(255,255,255,0.04);border-radius:8px;">
          {{ viewTarget.description }}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="vd-field"><div class="vd-label">Assigned To</div><div class="vd-val">{{ getEmployeeName(viewTarget.assignedTo) || '—' }}</div></div>
          <div class="vd-field"><div class="vd-label">Category</div><div class="vd-val">{{ viewTarget.category || '—' }}</div></div>
          <div class="vd-field"><div class="vd-label">Due Date</div><div class="vd-val" :style="isOverdue(viewTarget)?'color:#f87171':''">{{ formatDate(viewTarget.dueDate) || '—' }}</div></div>
          <div class="vd-field"><div class="vd-label">Created By</div><div class="vd-val">{{ viewTarget.createdBy || '—' }}</div></div>
          <div v-if="viewTarget.projectId" class="vd-field" style="grid-column:1/-1;"><div class="vd-label">Project</div><div class="vd-val">{{ getProjectName(viewTarget.projectId) }}</div></div>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showViewModal = false">Close</button>
        <button class="btn-primary" @click="openEditModal(viewTarget); showViewModal = false"><Pencil :size="13"/> Edit</button>
      </template>
    </AppModal>

    <!-- Add/Edit Task Modal -->
    <AppModal
      v-model="showModal"
      :title="editingTask ? 'Edit Task' : 'Add New Task'"
      subtitle="Fill in the task details below"
      width="640px"
    >
      <form @submit.prevent="saveTask" class="form-grid">
        <div class="form-group" style="grid-column: 1 / -1">
          <label class="label">Task Title <span class="required">*</span></label>
          <input v-model="form.title" type="text" class="input" placeholder="Enter task title" required />
        </div>
        <div class="form-group" style="grid-column: 1 / -1">
          <label class="label">Description</label>
          <textarea v-model="form.description" class="input" rows="3" placeholder="Task description..." />
        </div>
        <div class="form-group">
          <label class="label">Assigned To <span class="required">*</span></label>
          <select v-model="form.assignedTo" class="input" required>
            <option value="">Select employee</option>
            <option v-if="isSelfAssignable" :value="authStore.user?.id">Assign to myself</option>
            <option v-for="emp in employees" :key="emp.id" :value="emp.id">{{ emp.fullName }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Priority <span class="required">*</span></label>
          <select v-model="form.priority" class="input" required>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Due Date <span class="required">*</span></label>
          <input v-model="form.dueDate" type="date" class="input" required />
        </div>
        <div class="form-group">
          <label class="label">Status</label>
          <select v-model="form.status" class="input">
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Category</label>
          <select v-model="form.category" class="input">
            <option value="General">General</option>
            <option value="Installation">Installation</option>
            <option value="Repair">Repair</option>
            <option value="AMC">AMC</option>
            <option value="Complaint">Complaint</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Linked Project (optional)</label>
          <select v-model="form.projectId" class="input">
            <option value="">None</option>
            <option v-for="proj in projects" :key="proj.id" :value="proj.id">{{ proj.clientName || proj.name }}</option>
          </select>
        </div>
      </form>
      <template #footer>
        <button class="btn-secondary" @click="showModal = false">Cancel</button>
        <button class="btn-primary" @click="saveTask" :disabled="saving">
          <Loader2 v-if="saving" :size="16" class="spin" />
          {{ editingTask ? 'Update Task' : 'Create Task' }}
        </button>
      </template>
    </AppModal>

    <!-- Delete Confirm -->
    <ConfirmDialog
      v-model="showDeleteDialog"
      title="Delete Task"
      :message="`Are you sure you want to delete '${taskToDelete?.title}'? This action cannot be undone.`"
      confirmLabel="Delete"
      :danger="true"
      @confirm="deleteTask"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  Plus, Search, X, Pencil, Trash2, ClipboardList, AlertCircle,
  Calendar, Link2, Kanban, LayoutList, Loader2,
} from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { getAll, create, update, remove } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { useUIStore } from '@/stores/ui'
import { useActivityStore } from '@/stores/activity'
import { useAuthStore } from '@/stores/auth'

const uiStore = useUIStore()
const activity = useActivityStore()
const authStore = useAuthStore()

// Data
const tasks = ref([])
const employees = ref([])
const projects = ref([])
const loading = ref(false)
const saving = ref(false)

// UI State
const activeTab = ref('all')
const viewMode = ref('list')
const search = ref('')
const filterPriority = ref('')
const filterStatus = ref('')
const filterAssignee = ref('')
const filterDateFrom = ref('')
const filterDateTo = ref('')
const showModal = ref(false)
const showDeleteDialog = ref(false)
const showViewModal = ref(false)
const viewTarget = ref(null)
const editingTask = ref(null)
const taskToDelete = ref(null)
function openView(task) { viewTarget.value = task; showViewModal.value = true }

const defaultForm = {
  title: '',
  description: '',
  assignedTo: '',
  priority: 'medium',
  dueDate: '',
  status: 'pending',
  category: 'General',
  projectId: '',
}
const form = ref({ ...defaultForm })

// Computed
// Admin and reception can see ALL tasks; sales/technician/user see only their own
const isAdminOrStaff = computed(() =>
  ['admin', 'reception'].includes(authStore.user?.role)
)
const isSelfAssignable = computed(() =>
  ['admin', 'reception', 'sales'].includes(authStore.user?.role)
)
const canCreate = computed(() => authStore.user?.role !== 'user')
const canDelete = computed(() => authStore.user?.role === 'admin')

const tabs = computed(() => {
  const base = [
    { key: 'all', label: 'All Tasks' },
    { key: 'mine', label: 'My Tasks' },
    { key: 'created', label: 'Created by Me' },
    { key: 'completed', label: 'Completed' },
  ]
  return isAdminOrStaff.value
    ? base
    : [{ key: 'mine', label: 'My Tasks' }, { key: 'completed', label: 'Completed' }]
})

const kanbanColumns = [
  { key: 'pending', label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
]

function getTabTasks(tabKey) {
  const uid = authStore.user?.id  // use Firestore document id, not uid
  switch (tabKey) {
    case 'all': return tasks.value
    case 'mine': return tasks.value.filter(t => t.assignedTo === uid)
    case 'created': return tasks.value.filter(t => t.createdBy === uid)
    case 'completed': return tasks.value.filter(t => t.status === 'completed')
    default: return tasks.value
  }
}

const filteredTasks = computed(() => {
  let list = getTabTasks(activeTab.value)
  // Non-admin/reception roles only see tasks assigned to them
  if (!isAdminOrStaff.value) {
    const uid = authStore.user?.id
    list = list.filter(t => t.assignedTo === uid)
  }
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(t => t.title?.toLowerCase().includes(q))
  }
  if (filterPriority.value) list = list.filter(t => t.priority === filterPriority.value)
  if (filterStatus.value) list = list.filter(t => t.status === filterStatus.value)
  if (filterAssignee.value) list = list.filter(t => t.assignedTo === filterAssignee.value)
  if (filterDateFrom.value) list = list.filter(t => t.dueDate >= filterDateFrom.value)
  if (filterDateTo.value) list = list.filter(t => t.dueDate <= filterDateTo.value)
  return list
})

function getTabCount(tabKey) {
  return getTabTasks(tabKey).length
}

function getKanbanTasks(status) {
  return filteredTasks.value.filter(t => t.status === status)
}

function isOverdue(task) {
  if (task.status === 'completed') return false
  if (!task.dueDate) return false
  return task.dueDate < new Date().toISOString().slice(0, 10)
}

function getEmployeeName(id) {
  if (!id) return '—'
  if (id === authStore.user?.id) return 'Me'
  const emp = employees.value.find(e => e.id === id)
  return emp?.fullName || id
}

function getProjectName(id) {
  if (!id) return '—'
  const proj = projects.value.find(p => p.id === id)
  return proj?.clientName || proj?.name || id
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

// Actions
function toggleView() {
  viewMode.value = viewMode.value === 'list' ? 'kanban' : 'list'
}

function clearFilters() {
  search.value = ''
  filterPriority.value = ''
  filterStatus.value = ''
  filterAssignee.value = ''
  filterDateFrom.value = ''
  filterDateTo.value = ''
}

function openAddModal() {
  editingTask.value = null
  form.value = { ...defaultForm }
  showModal.value = true
}

function openEditModal(task) {
  editingTask.value = task
  form.value = {
    title: task.title || '',
    description: task.description || '',
    assignedTo: task.assignedTo || '',
    priority: task.priority || 'medium',
    dueDate: task.dueDate || '',
    status: task.status || 'pending',
    category: task.category || 'General',
    projectId: task.projectId || '',
  }
  showModal.value = true
}

async function saveTask() {
  if (!form.value.title || !form.value.assignedTo || !form.value.dueDate) {
    uiStore.error('Please fill all required fields')
    return
  }
  saving.value = true
  try {
    const payload = { ...form.value, updatedAt: new Date().toISOString() }
    if (editingTask.value) {
      await update(Collections.TASKS, editingTask.value.id, payload)
      const idx = tasks.value.findIndex(t => t.id === editingTask.value.id)
      if (idx !== -1) tasks.value[idx] = { ...tasks.value[idx], ...payload }
      activity.log({ action: 'updated', module: 'tasks', tab: 'Tasks', summary: `Updated task: ${payload.title}`, details: { title: payload.title, assignedTo: payload.assignedTo, priority: payload.priority, status: payload.status, dueDate: payload.dueDate } })
      uiStore.success('Task updated successfully')
    } else {
      payload.createdBy = authStore.user?.id
      payload.createdAt = new Date().toISOString()
      const id = await create(Collections.TASKS, payload)
      tasks.value.push({ id, ...payload })
      activity.log({ action: 'created', module: 'tasks', tab: 'Tasks', summary: `Created task: ${payload.title}`, details: { title: payload.title, assignedTo: payload.assignedTo, priority: payload.priority, dueDate: payload.dueDate, category: payload.category } })
      uiStore.success('Task created successfully')
    }
    showModal.value = false
  } catch {
    uiStore.error('Failed to save task')
  } finally {
    saving.value = false
  }
}

async function updateStatus(task, newStatus) {
  try {
    await update(Collections.TASKS, task.id, { status: newStatus, updatedAt: new Date().toISOString() })
    const idx = tasks.value.findIndex(t => t.id === task.id)
    if (idx !== -1) tasks.value[idx].status = newStatus
    uiStore.success('Status updated')
  } catch {
    uiStore.error('Failed to update status')
  }
}

function confirmDelete(task) {
  taskToDelete.value = task
  showDeleteDialog.value = true
}

async function deleteTask() {
  if (!taskToDelete.value) return
  try {
    await remove(Collections.TASKS, taskToDelete.value.id)
    tasks.value = tasks.value.filter(t => t.id !== taskToDelete.value.id)
    activity.log({ action: 'deleted', module: 'tasks', tab: 'Tasks', summary: `Deleted task: ${taskToDelete.value.title}`, details: { title: taskToDelete.value.title, assignedTo: taskToDelete.value.assignedTo, priority: taskToDelete.value.priority } })
    uiStore.success('Task deleted')
  } catch {
    uiStore.error('Failed to delete task')
  } finally {
    taskToDelete.value = null
  }
}

// Load data
onMounted(async () => {
  loading.value = true
  try {
    const [t, e, p] = await Promise.all([
      getAll(Collections.TASKS),
      getAll(Collections.EMPLOYEES),
      getAll(Collections.PROJECTS),
    ])
    tasks.value = t
    employees.value = e
    projects.value = p
  } catch {
    uiStore.error('Failed to load tasks')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.page-container { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
.page-subtitle { font-size: 13px; color:var(--ct-muted); margin-top: 4px; }
.header-actions { display: flex; align-items: center; gap: 10px; }

.filters-bar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 14px 16px; border-radius: 12px;
}
.filter-group { display: flex; align-items: center; gap: 8px; }
.filter-icon { color:var(--ct-muted); flex-shrink: 0; }
.filter-input { width: 200px; }
.filter-select { width: 150px; }
.filter-date { width: 140px; }
.filter-sep { color:var(--ct-muted); font-size: 12px; }

.tabs-nav { display: flex; gap: 4px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.tab-btn { padding: 8px 16px; font-size: 13px; color:var(--ct-muted); background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
.tab-btn.active { color: #6366f1; border-bottom-color: #6366f1; }
.tab-count { background: rgba(99,102,241,0.15); color: #6366f1; font-size: 11px; padding: 1px 7px; border-radius: 10px; }

.data-table { width: 100%; border-collapse: collapse; }
.data-table th { font-size: 12px; color:var(--ct-muted); font-weight: 500; padding: 10px 14px; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.06); text-align: left; }
.data-table td { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 13px; color:var(--ct-secondary); vertical-align: middle; }
.data-table tr:last-child td { border-bottom: none; }
.data-table tr.row-overdue { background: rgba(239,68,68,0.04); }

.task-title-cell { display: flex; flex-direction: column; gap: 4px; }
.task-title { font-weight: 500; color:var(--ct-primary); }
.task-meta-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.task-category { font-size: 11px; color:var(--ct-muted); }
.overdue-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; color: #ef4444; background: rgba(239,68,68,0.12); padding: 2px 6px; border-radius: 6px; }

.assignee-cell { display: flex; align-items: center; gap: 8px; }
.avatar-sm { width: 26px; height: 26px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: white; flex-shrink: 0; }

.priority-badge { font-size: 11px; font-weight: 500; padding: 3px 8px; border-radius: 6px; text-transform: capitalize; }
.priority-low { background: rgba(34,197,94,0.15); color: #22c55e; }
.priority-medium { background: rgba(234,179,8,0.15); color: #eab308; }
.priority-high { background: rgba(249,115,22,0.15); color: #f97316; }
.priority-urgent { background: rgba(239,68,68,0.15); color: #ef4444; }

.status-select {
  font-size: 12px; font-weight: 500; padding: 4px 8px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05);
  cursor: pointer; color:var(--ct-primary); outline: none;
}
.status-select.status-pending { border-color: rgba(234,179,8,0.4); color: #eab308; }
.status-select.status-in_progress { border-color: rgba(99,102,241,0.4); color: #818cf8; }
.status-select.status-completed { border-color: rgba(34,197,94,0.4); color: #22c55e; }
.status-select.status-on_hold { border-color: rgba(107,114,128,0.4); color: #9ca3af; }

.status-select-sm {
  font-size: 11px; font-weight: 500; padding: 3px 6px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05);
  cursor: pointer; color:var(--ct-primary); outline: none; width: 100%;
}
.status-select-sm.status-pending { border-color: rgba(234,179,8,0.4); color: #eab308; }
.status-select-sm.status-in_progress { border-color: rgba(99,102,241,0.4); color: #818cf8; }
.status-select-sm.status-completed { border-color: rgba(34,197,94,0.4); color: #22c55e; }
.status-select-sm.status-on_hold { border-color: rgba(107,114,128,0.4); color: #9ca3af; }

.project-link { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #818cf8; }
.text-muted { color:var(--ct-muted); font-size: 12px; }
.text-danger { color: #ef4444 !important; }
.text-xs { font-size: 11px; }

.action-btns { display: flex; gap: 8px; }
.icon-btn { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; padding: 0; }

/* Kanban */
.kanban-board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.kanban-col { display: flex; flex-direction: column; gap: 10px; }
.kanban-col-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; background: rgba(255,255,255,0.04);
  border-radius: 10px; border: 1px solid rgba(255,255,255,0.07);
}
.kanban-col-title { font-size: 12px; font-weight: 600; color:var(--ct-sub); text-transform: uppercase; letter-spacing: 0.5px; }
.kanban-col-count { background: rgba(99,102,241,0.15); color: #818cf8; font-size: 12px; padding: 2px 8px; border-radius: 10px; }
.kanban-cards { display: flex; flex-direction: column; gap: 10px; min-height: 80px; }
.kanban-empty { text-align: center; padding: 24px; color:var(--ct-muted); font-size: 12px; }
.kanban-card { border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 10px; transition: transform 0.15s; }
.kanban-card:hover { transform: translateY(-1px); }
.kanban-card.card-overdue { border-left: 3px solid #ef4444; }
.kanban-card-header { display: flex; align-items: center; justify-content: space-between; }
.kanban-card-title { font-size: 13px; font-weight: 500; color:var(--ct-primary); line-height: 1.4; margin: 0; }
.kanban-card-desc { font-size: 12px; color:var(--ct-muted); line-height: 1.4; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.kanban-card-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px; }
.kanban-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.due-date { display: flex; align-items: center; gap: 3px; font-size: 11px; color:var(--ct-muted); }
.kanban-status-row { margin-top: 2px; }

.empty-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px; color:var(--ct-muted); }
.empty-icon { opacity: 0.35; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-group { display: flex; flex-direction: column; gap: 6px; }
.required { color: #ef4444; }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
