/**
 * Global search composable.
 * Searches across all major collections and returns grouped results.
 * Results are cached for 60s to avoid repeated Firestore reads.
 * Non-admin users only see records assigned to / created by them.
 */
import { ref } from 'vue'
import { getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'

// ── In-memory cache (shared across all uses) ─────────────────────────────────
const cache = {}
const CACHE_TTL = 60_000 // 60s

async function fetchCached(col) {
  const now = Date.now()
  if (cache[col] && now - cache[col].ts < CACHE_TTL) return cache[col].data
  const data = await getAll(col)
  cache[col] = { data, ts: now }
  return data
}

// ── Search helpers ────────────────────────────────────────────────────────────
function matchAll(query, ...fields) {
  const q = query.toLowerCase()
  return fields.some(f => (f || '').toString().toLowerCase().includes(q))
}

/** Returns true if user should see this record (admin sees all) */
function canSee(record, user) {
  if (!user || user.role === 'admin') return true
  const name = (user.fullName || user.username || '').toLowerCase()
  const uid  = (user.id || '').toLowerCase()
  const fields = [
    record.assignedTo, record.createdBy, record.addedBy,
    record.technician, record.inspector, record.userId,
  ]
  return fields.some(f => f && (
    f.toLowerCase().includes(name) ||
    f.toLowerCase().includes(uid)
  ))
}

// ── Main search function ──────────────────────────────────────────────────────
export async function searchAll(query, user = null) {
  if (!query || query.trim().length < 2) return []
  const q = query.trim()
  const groups = []

  const [projects, inventory, complaints, repairs, employees, amc, tasks, leads] =
    await Promise.allSettled([
      fetchCached(Collections.PROJECTS),
      fetchCached(Collections.INVENTORY),
      fetchCached(Collections.COMPLAINTS),
      fetchCached(Collections.REPAIRS),
      fetchCached(Collections.EMPLOYEES),
      fetchCached(Collections.AMC),
      fetchCached(Collections.TASKS),
      fetchCached(Collections.LEADS),
    ]).then(r => r.map(p => p.status === 'fulfilled' ? p.value : []))

  const isAdmin = !user || user.role === 'admin'

  // Projects
  const projResults = projects
    .filter(p => (isAdmin || canSee(p, user)) && matchAll(q, p.projectName, p.clientName, p.city, p.type))
    .slice(0, 5)
    .map(p => ({
      id: p.id,
      title: p.projectName || 'Unnamed Project',
      sub: [p.clientName, p.city, p.type].filter(Boolean).join(' · '),
      route: '/projects',
      icon: 'building',
      badge: p.status,
    }))
  if (projResults.length) groups.push({ group: 'Projects', icon: 'building', color: '#6366f1', items: projResults })

  // Sales Leads
  const leadResults = leads
    .filter(l => (isAdmin || canSee(l, user)) &&
      matchAll(q, l.clientName, l.contactPerson, l.phone, l.email, l.address,
        l.assignedTo, l.leadSource,
        ...(Array.isArray(l.leadTypes) ? l.leadTypes : [l.leadType]),
      ))
    .slice(0, 5)
    .map(l => ({
      id: l.id,
      title: l.clientName || l.contactPerson || 'Unknown Lead',
      sub: [l.contactPerson, l.phone, l.assignedTo].filter(Boolean).join(' · '),
      route: '/sales',
      icon: 'trending',
      badge: l.stage,
    }))
  if (leadResults.length) groups.push({ group: 'Sales Leads', icon: 'trending', color: '#f43f5e', items: leadResults })

  // Inventory
  const invResults = inventory
    .filter(i => matchAll(q, i.name, i.sku, i.barcode, i.category))
    .slice(0, 5)
    .map(i => ({
      id: i.id,
      title: i.name,
      sub: [i.category, i.sku ? `SKU: ${i.sku}` : null, `Qty: ${i.quantity}`].filter(Boolean).join(' · '),
      route: `/${i.location || 'warehouse'}`,
      icon: 'package',
      badge: i.quantity <= (i.minStock || 0) ? 'low' : null,
    }))
  if (invResults.length) groups.push({ group: 'Inventory', icon: 'package', color: '#10b981', items: invResults })

  // Complaints
  const cmpResults = complaints
    .filter(c => (isAdmin || canSee(c, user)) &&
      matchAll(q, c.clientName, c.complaintNumber, c.issueType, c.assignedTo, c.address))
    .slice(0, 5)
    .map(c => ({
      id: c.id,
      title: c.clientName || 'Unknown',
      sub: [c.complaintNumber, c.issueType, c.status].filter(Boolean).join(' · '),
      route: '/complaints',
      icon: 'alert',
      badge: c.priority,
    }))
  if (cmpResults.length) groups.push({ group: 'Complaints', icon: 'alert', color: '#f59e0b', items: cmpResults })

  // Repairs
  const repResults = repairs
    .filter(r => (isAdmin || canSee(r, user)) &&
      matchAll(q, r.clientName, r.repairType, r.technician, r.faultDescription))
    .slice(0, 5)
    .map(r => ({
      id: r.id,
      title: r.clientName || 'Unknown',
      sub: [r.repairType, r.technician, r.status].filter(Boolean).join(' · '),
      route: '/repairs',
      icon: 'tool',
      badge: r.status,
    }))
  if (repResults.length) groups.push({ group: 'Repairs', icon: 'tool', color: '#ef4444', items: repResults })

  // Employees (admin only)
  if (isAdmin) {
    const empResults = employees
      .filter(e => matchAll(q, e.fullName, e.employeeId, e.designation, e.department, e.email, e.phone))
      .slice(0, 4)
      .map(e => ({
        id: e.id,
        title: e.fullName || e.username,
        sub: [e.designation, e.department].filter(Boolean).join(' · '),
        route: '/hr',
        icon: 'user',
        badge: e.status,
      }))
    if (empResults.length) groups.push({ group: 'Employees', icon: 'user', color: '#8b5cf6', items: empResults })
  }

  // AMC
  const amcResults = amc
    .filter(a => (isAdmin || canSee(a, user)) &&
      matchAll(q, a.clientName, a.contractNumber, a.phone, a.location))
    .slice(0, 4)
    .map(a => ({
      id: a.id,
      title: a.clientName || 'Unknown',
      sub: [a.contractNumber, a.status].filter(Boolean).join(' · '),
      route: '/amc',
      icon: 'file',
      badge: a.status,
    }))
  if (amcResults.length) groups.push({ group: 'AMC Contracts', icon: 'file', color: '#06b6d4', items: amcResults })

  // Tasks
  const taskResults = tasks
    .filter(t => (isAdmin || canSee(t, user)) &&
      matchAll(q, t.title, t.description, t.assignedTo, t.category))
    .slice(0, 4)
    .map(t => ({
      id: t.id,
      title: t.title || 'Untitled Task',
      sub: [t.assignedTo, t.priority, t.status].filter(Boolean).join(' · '),
      route: '/tasks',
      icon: 'check',
      badge: t.priority,
    }))
  if (taskResults.length) groups.push({ group: 'Tasks', icon: 'check', color: '#f97316', items: taskResults })

  return groups
}

// ── Vue composable ────────────────────────────────────────────────────────────
export function useGlobalSearch() {
  const query    = ref('')
  const results  = ref([])
  const searching = ref(false)
  const open     = ref(false)

  let debounceTimer = null
  let _user = null

  function setUser(user) { _user = user }

  async function onQueryChange(val) {
    clearTimeout(debounceTimer)
    if (!val || val.trim().length < 2) {
      results.value = []
      open.value = false
      return
    }
    debounceTimer = setTimeout(async () => {
      searching.value = true
      try {
        results.value = await searchAll(val.trim(), _user)
        open.value = results.value.length > 0
      } catch (e) {
        console.error('[GlobalSearch]', e)
        results.value = []
      } finally {
        searching.value = false
      }
    }, 280)
  }

  function clear() {
    query.value = ''
    results.value = []
    open.value = false
    clearTimeout(debounceTimer)
  }

  return { query, results, searching, open, onQueryChange, clear, setUser }
}
