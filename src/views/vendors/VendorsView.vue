<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <Store :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          Vendors
        </h1>
        <p class="page-sub">Trusted suppliers, pricing, and purchase history in one place.</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button class="btn-primary" @click="openAdd">
          <Plus :size="16" /> Add Vendor
        </button>
      </div>
    </div>

    <!-- Search & Filters -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
      <div class="search-box" style="flex:1;min-width:220px;">
        <Search :size="14" class="search-icon" />
        <input v-model="search" class="input" placeholder="Search vendors…" />
      </div>
      <!-- Category filter — all built-in + custom categories -->
      <select v-model="categoryFilter" class="input" style="width:180px;">
        <option value="">All Categories</option>
        <option v-for="cat in allCategories" :key="cat" :value="cat">{{ cat }}</option>
      </select>
      <select v-model="statusFilter" class="input" style="width:140px;">
        <option value="">All Statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="blacklisted">Blacklisted</option>
      </select>
    </div>

    <DataTable
      :columns="columns"
      :rows="pagedItems"
      :loading="loading"
      :total="filtered.length"
      :page="page"
      :pageSize="pageSize"
      empty-text="No vendors found."
      @page="page = $event"
    >
      <template #default="{ row }">
        <td>
          <div style="font-weight:600;color:var(--ct-primary);">{{ row.name }}</div>
          <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ row.vendorCode }}</div>
        </td>
        <!-- Multi-category badges (backward-compatible with old single category field) -->
        <td>
          <div v-if="vendorCategories(row).length" style="display:flex;flex-wrap:wrap;gap:4px;">
            <span v-for="cat in vendorCategories(row)" :key="cat" :class="['badge', categoryBadge(cat)]" style="font-size:10px;">{{ cat }}</span>
          </div>
          <span v-else style="color:var(--ct-muted);font-size:12px;">—</span>
        </td>
        <td>
          <div style="color:var(--ct-sub);font-size:12px;">{{ row.contactPerson }}</div>
          <div style="color:var(--ct-muted);font-size:11px;">{{ row.phone }}</div>
          <div style="color:var(--ct-muted);font-size:11px;">{{ row.email }}</div>
        </td>
        <td>
          <div style="color:var(--ct-muted);font-size:12px;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ row.address || '—' }}</div>
          <div style="font-size:11px;color:var(--ct-muted);">GST: {{ row.gstNumber || '—' }}</div>
        </td>
        <td>
          <div style="color:var(--ct-accent);font-weight:500;">{{ row.paymentTerms || '—' }}</div>
          <div style="font-size:11px;color:var(--ct-muted);">Credit: {{ row.creditLimit ? formatCurrency(row.creditLimit) : '—' }}</div>
        </td>
        <td><span :class="['badge', statusBadge(row.status)]">{{ row.status || 'active' }}</span></td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn-secondary btn-sm" @click="openEdit(row)"><Pencil :size="12" /></button>
            <button v-if="auth.can('canDelete')" class="btn-danger btn-sm" @click="confirmDel(row)"><Trash2 :size="12" /></button>
          </div>
        </td>
      </template>
    </DataTable>

    <!-- Add/Edit Modal -->
    <AppModal v-model="showModal" :title="editing ? 'Edit Vendor' : 'Add Vendor'" width="700px">
      <div class="form-grid">
        <div class="form-group">
          <label class="label">Vendor Name *</label>
          <input v-model="form.name" class="input" placeholder="Company name" />
        </div>
        <div class="form-group">
          <label class="label">Vendor Code</label>
          <input v-model="form.vendorCode" class="input" placeholder="VND-001" />
        </div>

        <!-- Multi-select categories with + add button -->
        <div class="form-group form-full">
          <label class="label">Categories <span style="font-weight:400;color:var(--ct-muted);">(select one or more)</span></label>
          <div class="cat-chips-wrap">
            <div
              v-for="cat in allCategories"
              :key="cat"
              :class="['cat-chip', { selected: form.categories.includes(cat) }]"
              @click="toggleCategory(cat)"
            >
              <span v-if="form.categories.includes(cat)" style="margin-right:4px;font-size:10px;">✓</span>
              {{ cat }}
            </div>
          </div>
          <!-- Add new category inline -->
          <div class="add-cat-row">
            <input
              v-model="newCatInput"
              class="input"
              placeholder="Create new category…"
              style="flex:1;"
              @keyup.enter="addCategory"
              maxlength="40"
            />
            <button class="btn-primary btn-sm" @click="addCategory" title="Add category" :disabled="!newCatInput.trim()">
              <Plus :size="13" /> Add
            </button>
          </div>
          <div v-if="form.categories.length" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:5px;">
            <span style="font-size:11px;color:var(--ct-muted);align-self:center;">Selected:</span>
            <span v-for="cat in form.categories" :key="cat" class="cat-selected-chip">
              {{ cat }}
              <button class="cat-chip-remove" @click.stop="toggleCategory(cat)">×</button>
            </span>
          </div>
        </div>

        <div class="form-group">
          <label class="label">Status</label>
          <select v-model="form.status" class="input">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="blacklisted">Blacklisted</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Contact Person</label>
          <input v-model="form.contactPerson" class="input" placeholder="Full name" />
        </div>
        <div class="form-group">
          <label class="label">Phone</label>
          <input v-model="form.phone" class="input" placeholder="+91 9876543210" />
        </div>
        <div class="form-group">
          <label class="label">Email</label>
          <input v-model="form.email" class="input" type="email" placeholder="vendor@company.com" />
        </div>
        <div class="form-group">
          <label class="label">Website</label>
          <input v-model="form.website" class="input" placeholder="https://…" />
        </div>
        <div class="form-group form-full">
          <label class="label">Address</label>
          <textarea v-model="form.address" class="input" rows="2" placeholder="Full address…"></textarea>
        </div>
        <div class="form-group">
          <label class="label">GST Number</label>
          <input v-model="form.gstNumber" class="input" placeholder="22AAAAA0000A1Z5" />
        </div>
        <div class="form-group">
          <label class="label">PAN Number</label>
          <input v-model="form.panNumber" class="input" placeholder="AAAAA0000A" />
        </div>
        <div class="form-group">
          <label class="label">Payment Terms</label>
          <select v-model="form.paymentTerms" class="input">
            <option value="">Select…</option>
            <option value="Immediate">Immediate</option>
            <option value="Net 7">Net 7</option>
            <option value="Net 15">Net 15</option>
            <option value="Net 30">Net 30</option>
            <option value="Net 60">Net 60</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Credit Limit (₹)</label>
          <input v-model.number="form.creditLimit" class="input" type="number" min="0" placeholder="0" />
        </div>
        <div class="form-group form-full">
          <label class="label">Notes</label>
          <textarea v-model="form.notes" class="input" rows="2" placeholder="Any additional notes…"></textarea>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showModal = false">Cancel</button>
        <button class="btn-primary" @click="save" :disabled="saving">
          {{ saving ? 'Saving…' : (editing ? 'Update' : 'Add Vendor') }}
        </button>
      </template>
    </AppModal>

    <ConfirmDialog ref="confirmRef" @confirm="doDelete" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Store, Plus, Search, Pencil, Trash2 } from 'lucide-vue-next'
import DataTable from '@/components/ui/DataTable.vue'
import AppModal from '@/components/ui/AppModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useCollection } from '@/composables/useCollection'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { Collections } from '@/firebase/collections'
import { getOne } from '@/firebase/firestore'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/firebase/config'

const ui   = useUIStore()
const auth = useAuthStore()
const { items, loading, add, edit, del } = useCollection(Collections.VENDORS)

// ── Category management ────────────────────────────────────────────────────────
const BUILTIN_CATEGORIES = ['Components', 'Electronics', 'Hydraulics', 'Safety Equipment', 'Services', 'Other']
const customCategories = ref([])  // loaded from Firestore

const allCategories = computed(() => {
  const merged = [...BUILTIN_CATEGORIES]
  customCategories.value.forEach(c => { if (!merged.includes(c)) merged.push(c) })
  return merged
})

async function loadCustomCategories() {
  try {
    const snap = await getOne(Collections.SETTINGS, 'vendorCategories')
    if (snap?.categories?.length) customCategories.value = snap.categories
  } catch { /* no custom categories yet */ }
}

async function saveCustomCategories() {
  try {
    await setDoc(doc(db, Collections.SETTINGS, 'vendorCategories'), {
      categories: customCategories.value,
    })
  } catch { /* non-critical */ }
}

const newCatInput = ref('')
function addCategory() {
  const cat = newCatInput.value.trim()
  if (!cat) return
  if (!allCategories.value.includes(cat)) {
    customCategories.value.push(cat)
    saveCustomCategories()
  }
  // Auto-select the new category in the form
  if (!form.value.categories.includes(cat)) form.value.categories.push(cat)
  newCatInput.value = ''
}

function toggleCategory(cat) {
  const idx = form.value.categories.indexOf(cat)
  if (idx === -1) form.value.categories.push(cat)
  else form.value.categories.splice(idx, 1)
}

// ── Filters ────────────────────────────────────────────────────────────────────
const search         = ref('')
const categoryFilter = ref('')
const statusFilter   = ref('')
const page           = ref(1)
const pageSize       = 25

// Get the effective categories for a vendor (handles legacy single-string field)
function vendorCategories(row) {
  if (row.categories?.length) return row.categories
  if (row.category) return [row.category]
  return []
}

const filtered = computed(() => items.value.filter(v => {
  const q = search.value.toLowerCase()
  if (q && !v.name?.toLowerCase().includes(q) && !v.contactPerson?.toLowerCase().includes(q) && !v.phone?.includes(q)) return false
  if (categoryFilter.value) {
    const cats = vendorCategories(v)
    if (!cats.includes(categoryFilter.value)) return false
  }
  if (statusFilter.value && (v.status || 'active') !== statusFilter.value) return false
  return true
}))

const pagedItems    = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const activeVendors = computed(() => items.value.filter(v => (v.status || 'active') === 'active').length)

// ── Form ───────────────────────────────────────────────────────────────────────
const showModal = ref(false)
const editing   = ref(null)
const saving    = ref(false)
const confirmRef = ref(null)
let pendingDeleteId = null

const emptyForm = () => ({
  name: '', vendorCode: '', categories: [], status: 'active',
  contactPerson: '', phone: '', email: '', website: '',
  address: '', gstNumber: '', panNumber: '',
  paymentTerms: '', creditLimit: 0, notes: '',
})
const form = ref(emptyForm())

const columns = [
  { key: 'name',     label: 'Vendor' },
  { key: 'category', label: 'Categories' },
  { key: 'contact',  label: 'Contact' },
  { key: 'address',  label: 'Address / GST' },
  { key: 'payment',  label: 'Payment Terms' },
  { key: 'status',   label: 'Status' },
  { key: 'actions',  label: 'Actions', width: '100px' },
]

function openAdd() {
  editing.value = null
  form.value = emptyForm()
  form.value.vendorCode = `VND-${String(items.value.length + 1).padStart(3, '0')}`
  newCatInput.value = ''
  showModal.value = true
}

function openEdit(row) {
  editing.value = row
  form.value = { ...emptyForm(), ...row }
  // Migrate legacy single-string category to array
  if (!form.value.categories?.length && form.value.category) {
    form.value.categories = [form.value.category]
  }
  if (!Array.isArray(form.value.categories)) form.value.categories = []
  newCatInput.value = ''
  showModal.value = true
}

async function save() {
  if (!form.value.name.trim()) return ui.error('Vendor name is required')
  saving.value = true
  try {
    const data = { ...form.value }
    // Ensure categories is always an array; drop legacy field
    if (!Array.isArray(data.categories)) data.categories = []
    delete data.category  // remove old field

    if (editing.value) {
      await edit(editing.value.id, data, `Updated vendor ${data.name}`)
      ui.success('Vendor updated')
    } else {
      await add(data, `Added vendor ${data.name}`)
      ui.success('Vendor added')
    }
    showModal.value = false
  } catch { ui.error('Save failed') }
  finally { saving.value = false }
}

function confirmDel(row) { pendingDeleteId = row.id; confirmRef.value?.open(`Delete vendor "${row.name}"?`) }
async function doDelete() { await del(pendingDeleteId, 'Deleted vendor'); ui.success('Vendor deleted') }

// ── Helpers ────────────────────────────────────────────────────────────────────
const BADGE_MAP = {
  'Components':       'badge-info',
  'Electronics':      'badge-blue',
  'Hydraulics':       'badge-purple',
  'Safety Equipment': 'badge-warning',
  'Services':         'badge-active',
  'Other':            'badge-inactive',
}
const CAT_COLORS = ['badge-info', 'badge-blue', 'badge-purple', 'badge-warning', 'badge-active', 'badge-inactive']
function categoryBadge(c) {
  if (BADGE_MAP[c]) return BADGE_MAP[c]
  // deterministic color for custom categories
  let hash = 0; for (const ch of (c || '')) hash = (hash * 31 + ch.charCodeAt(0)) & 0xff
  return CAT_COLORS[hash % CAT_COLORS.length]
}
const statusBadge    = (s) => ({ active: 'badge-active', inactive: 'badge-inactive', blacklisted: 'badge-danger' }[s] || 'badge-inactive')
const formatCurrency = (v) => `₹${(v || 0).toLocaleString('en-IN')}`

onMounted(loadCustomCategories)
</script>

<style scoped>
.page-container { padding: 28px; }

/* ── Multi-category chip selector ──────────────────────────────────── */
.cat-chips-wrap {
  display: flex; flex-wrap: wrap; gap: 7px;
  padding: 10px 12px;
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  margin-top: 4px;
  min-height: 44px;
}
.cat-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 5px 12px; border-radius: 99px;
  font-size: 12px; font-weight: 500;
  color: var(--ct-muted);
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.09);
  cursor: pointer; transition: all 0.13s; user-select: none;
}
.cat-chip:hover { border-color: rgba(99,102,241,0.3); color: var(--ct-sub); background: rgba(99,102,241,0.07); }
.cat-chip.selected {
  background: rgba(99,102,241,0.18);
  border-color: rgba(99,102,241,0.45);
  color: #a5b4fc;
  font-weight: 600;
}

/* ── Add new category row ─────────────────────────────────────────── */
.add-cat-row {
  display: flex; gap: 8px; margin-top: 8px;
}

/* ── Selected category chips (below the grid) ─────────────────────── */
.cat-selected-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 8px 3px 10px; border-radius: 99px;
  background: rgba(99,102,241,0.18); border: 1px solid rgba(99,102,241,0.3);
  color: #a5b4fc; font-size: 11px; font-weight: 600;
}
.cat-chip-remove {
  background: none; border: none; cursor: pointer;
  color: rgba(165,180,252,.6); font-size: 14px; line-height: 1;
  padding: 0; margin-left: 1px;
  display: flex; align-items: center;
}
.cat-chip-remove:hover { color: #f87171; }
</style>
