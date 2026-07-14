<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <Layers :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          Bill of Materials
        </h1>
        <p class="page-sub">Materials planned, costs controlled, nothing missed.</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
        <button class="btn-secondary btn-sm" @click="showImportModal = true">
          <Upload :size="14" /> Import Excel
        </button>
        <button class="btn-primary" @click="openAdd">
          <Plus :size="16" /> New BOM
        </button>
      </div>
    </div>

    <!-- Search & Filter -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
      <div class="search-box" style="flex:1;min-width:220px;">
        <Search :size="14" class="search-icon" />
        <input v-model="search" class="input" placeholder="Search BOM…" />
      </div>
      <select v-model="projectFilter" class="input" style="width:200px;">
        <option value="">All Projects</option>
        <option v-for="p in projects.items.value" :key="p.id" :value="p.id">{{ p.projectName || p.name }}</option>
      </select>
      <select v-model="statusFilter" class="input" style="width:150px;">
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="approved">Approved</option>
        <option value="ordered">Ordered</option>
        <option value="received">Received</option>
      </select>
    </div>

    <DataTable
      :columns="columns"
      :rows="pagedItems"
      :loading="loading"
      :total="filtered.length"
      :page="page"
      :pageSize="pageSize"
      empty-text="No BOM records found."
      :on-row-click="viewBOM"
      @page="page = $event"
    >
      <template #default="{ row }">
        <td>
          <div style="font-weight:600;color:var(--ct-primary);">{{ row.bomNumber }}</div>
          <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ formatDate(row.createdAt) }}</div>
        </td>
        <td>
          <div style="color:var(--ct-sub);">{{ getProjectName(row.projectId) }}</div>
        </td>
        <td>
          <div style="color:var(--ct-sub);font-size:12px;">{{ row.description || '—' }}</div>
        </td>
        <td>
          <div style="color:var(--ct-accent);font-weight:600;">{{ row.items?.length || 0 }} items</div>
          <div style="font-size:11px;color:var(--ct-muted);">Total: {{ formatCurrency(getTotal(row)) }}</div>
        </td>
        <td><span :class="['badge', statusBadge(row.status)]">{{ row.status || 'draft' }}</span></td>
        <td @click.stop>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn-secondary btn-sm" @click="openEdit(row)" title="Edit"><Pencil :size="12" /></button>
            <button class="btn-secondary btn-sm" :disabled="!!pdfLoading[row.id]" @click="downloadBomPdf(row)" title="Download PDF">
              <Loader2 v-if="pdfLoading[row.id]" :size="12" style="animation:spin 0.8s linear infinite;" />
              <FileDown v-else :size="12" />
            </button>
            <button v-if="auth.can('canDelete')" class="btn-danger btn-sm" @click="confirmDel(row)"><Trash2 :size="12" /></button>
          </div>
        </td>
      </template>
    </DataTable>

    <!-- Add/Edit Modal -->
    <AppModal v-model="showModal" :title="editing ? 'Edit BOM' : 'New BOM'" width="900px">
      <div class="form-grid" style="margin-bottom:20px;">
        <div class="form-group">
          <label class="label">BOM Number</label>
          <input v-model="form.bomNumber" class="input" placeholder="BOM-0001" />
        </div>
        <div class="form-group">
          <label class="label">Project</label>
          <select v-model="form.projectId" class="input">
            <option value="">Select Project</option>
            <option v-for="p in projects.items.value" :key="p.id" :value="p.id">{{ p.projectName || p.name }}</option>
          </select>
          <div v-if="form.clientName" style="margin-top:6px;font-size:12px;color:var(--ct-green);">
            ✓ {{ form.clientName }}{{ form.clientPhone ? ' · ' + form.clientPhone : '' }}
          </div>
        </div>
        <div class="form-group">
          <label class="label">Status</label>
          <select v-model="form.status" class="input">
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="ordered">Ordered</option>
            <option value="received">Received</option>
          </select>
        </div>
        <div class="form-group form-full">
          <label class="label">Description / Notes</label>
          <textarea v-model="form.description" class="input" rows="2" placeholder="BOM description…"></textarea>
        </div>
      </div>

      <!-- Materials Table -->
      <div style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <label class="label" style="margin:0;">Materials / Components</label>
          <button class="btn-secondary btn-sm" @click="addItem"><Plus :size="12" /> Add Item</button>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">
              <th style="text-align:left;padding:8px 6px;">Part Name</th>
              <th style="text-align:left;padding:8px 6px;">Description</th>
              <th style="text-align:left;padding:8px 6px;width:120px;">Part No.</th>
              <th style="text-align:right;padding:8px 6px;width:80px;">Qty</th>
              <th style="text-align:left;padding:8px 6px;width:80px;">Unit</th>
              <th style="text-align:right;padding:8px 6px;width:110px;">Unit Cost</th>
              <th style="text-align:right;padding:8px 6px;width:110px;">Total</th>
              <th style="text-align:left;padding:8px 6px;width:120px;">Vendor</th>
              <th style="width:36px;"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, idx) in form.items" :key="idx" style="border-top:1px solid rgba(255,255,255,0.04);">
              <td style="padding:4px 6px;">
                <input v-model="item.partName" class="input" placeholder="Part name" style="font-size:12px;" />
              </td>
              <td style="padding:4px 6px;">
                <input v-model="item.partDescription" class="input" placeholder="Per unit description…" style="font-size:12px;" />
              </td>
              <td style="padding:4px 6px;">
                <input v-model="item.partNumber" class="input" placeholder="PN-001" style="font-size:12px;" />
              </td>
              <td style="padding:4px 6px;">
                <input v-model.number="item.qty" class="input" type="number" min="1" style="text-align:right;font-size:12px;" />
              </td>
              <td style="padding:4px 6px;">
                <select v-model="item.unit" class="input" style="font-size:12px;">
                  <option value="pcs">pcs</option>
                  <option value="nos">nos</option>
                  <option value="m">m</option>
                  <option value="kg">kg</option>
                  <option value="litre">litre</option>
                  <option value="set">set</option>
                </select>
              </td>
              <td style="padding:4px 6px;">
                <input v-model.number="item.unitCost" class="input" type="number" min="0" style="text-align:right;font-size:12px;" />
              </td>
              <td style="padding:4px 6px;text-align:right;color:var(--ct-accent);font-size:13px;font-weight:500;">
                {{ formatCurrency((item.qty || 0) * (item.unitCost || 0)) }}
              </td>
              <td style="padding:4px 6px;">
                <select v-model="item.vendorId" class="input" style="font-size:12px;">
                  <option value="">—</option>
                  <option v-for="v in vendors.items.value" :key="v.id" :value="v.id">{{ v.name }}</option>
                </select>
              </td>
              <td style="padding:4px 6px;">
                <button class="btn-danger btn-sm btn-icon" @click="removeItem(idx)"><X :size="12" /></button>
              </td>
            </tr>
            <tr v-if="!form.items.length">
              <td colspan="8" style="text-align:center;padding:20px;color:var(--ct-muted);font-size:13px;">No items added yet</td>
            </tr>
          </tbody>
        </table>
        <!-- Total row -->
        <div style="display:flex;justify-content:flex-end;padding:12px 6px 0;border-top:1px solid rgba(255,255,255,0.06);margin-top:8px;">
          <div style="font-size:14px;font-weight:700;color:var(--ct-primary);">
            Total: <span style="color:var(--ct-accent);margin-left:8px;">{{ formatCurrency(getTotal(form)) }}</span>
          </div>
        </div>
      </div>

      <template #footer>
        <button class="btn-secondary" @click="showModal = false">Cancel</button>
        <button class="btn-primary" @click="save" :disabled="saving">
          {{ saving ? 'Saving…' : (editing ? 'Update BOM' : 'Create BOM') }}
        </button>
      </template>
    </AppModal>

    <!-- View Modal -->
    <AppModal v-model="showViewModal" :title="`BOM: ${viewItem?.bomNumber}`" width="900px">
      <template v-if="viewItem">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
          <div class="glass" style="padding:14px;">
            <div class="label">Project</div>
            <div style="color:var(--ct-primary);">{{ getProjectName(viewItem.projectId) }}</div>
          </div>
          <div class="glass" style="padding:14px;">
            <div class="label">Status</div>
            <span :class="['badge', statusBadge(viewItem.status)]">{{ viewItem.status }}</span>
          </div>
          <div class="glass" style="padding:14px;grid-column:1/-1;" v-if="viewItem.description">
            <div class="label">Description</div>
            <div style="color:var(--ct-sub);">{{ viewItem.description }}</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;">
              <th style="text-align:left;padding:10px 12px;">Part Name</th>
              <th style="text-align:left;padding:10px 12px;">Description</th>
              <th style="text-align:left;padding:10px 12px;">Part No.</th>
              <th style="text-align:right;padding:10px 12px;">Qty</th>
              <th style="text-align:left;padding:10px 12px;">Unit</th>
              <th style="text-align:right;padding:10px 12px;">Unit Cost</th>
              <th style="text-align:right;padding:10px 12px;">Total</th>
              <th style="text-align:left;padding:10px 12px;">Vendor</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in viewItem.items" :key="i" style="border-top:1px solid rgba(255,255,255,0.04);">
              <td style="padding:10px 12px;color:var(--ct-primary);font-weight:500;">{{ item.partName }}</td>
              <td style="padding:10px 12px;color:var(--ct-muted);font-size:12px;">{{ item.partDescription || '—' }}</td>
              <td style="padding:10px 12px;color:var(--ct-muted);font-size:12px;">{{ item.partNumber || '—' }}</td>
              <td style="padding:10px 12px;text-align:right;color:var(--ct-sub);">{{ item.qty }}</td>
              <td style="padding:10px 12px;color:var(--ct-muted);font-size:12px;">{{ item.unit }}</td>
              <td style="padding:10px 12px;text-align:right;color:var(--ct-sub);">{{ formatCurrency(item.unitCost) }}</td>
              <td style="padding:10px 12px;text-align:right;color:var(--ct-accent);font-weight:600;">{{ formatCurrency((item.qty || 0) * (item.unitCost || 0)) }}</td>
              <td style="padding:10px 12px;color:var(--ct-muted);font-size:12px;">{{ getVendorName(item.vendorId) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="border-top:1px solid rgba(255,255,255,0.08);">
              <td colspan="6" style="padding:12px;text-align:right;font-size:13px;font-weight:600;color:var(--ct-sub);">Grand Total</td>
              <td style="padding:12px;text-align:right;font-size:15px;font-weight:700;color:var(--ct-accent);">{{ formatCurrency(getTotal(viewItem)) }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </template>
    </AppModal>

    <ConfirmDialog ref="confirmRef" @confirm="doDelete" />

    <!-- Import Modal -->
    <AppModal v-model="showImportModal" title="Import BOM from Excel" width="640px">
      <div style="margin-bottom:16px;">
        <div class="glass" style="padding:16px;border-radius:12px;margin-bottom:16px;">
          <p style="font-size:12px;color:var(--ct-muted);margin:0 0 10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Expected Columns (in order)</p>
          <table style="width:100%;font-size:12px;border-collapse:collapse;">
            <thead><tr style="color:var(--ct-muted);"><th style="text-align:left;padding:4px 8px;">Column</th><th style="text-align:left;padding:4px 8px;">Example</th><th style="text-align:left;padding:4px 8px;">Required</th></tr></thead>
            <tbody>
              <tr v-for="col in importColumns" :key="col.key" style="border-top:1px solid rgba(255,255,255,0.04);">
                <td style="padding:5px 8px;color:var(--ct-accent);font-family:monospace;">{{ col.key }}</td>
                <td style="padding:5px 8px;color:var(--ct-sub);">{{ col.example }}</td>
                <td style="padding:5px 8px;"><span :class="col.required ? 'badge badge-danger' : 'badge badge-inactive'" style="font-size:10px;">{{ col.required ? 'Required' : 'Optional' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style="margin-bottom:12px;">
          <label class="label">Select Excel / CSV File</label>
          <label style="display:flex;align-items:center;gap:10px;padding:12px 16px;border:2px dashed rgba(99,102,241,0.3);border-radius:12px;cursor:pointer;background:rgba(99,102,241,0.04);">
            <Upload :size="20" style="color:#6366f1;flex-shrink:0;" />
            <span style="color:var(--ct-muted);font-size:13px;">{{ importFile ? importFile.name : 'Click to choose .xlsx, .xls or .csv' }}</span>
            <input type="file" accept=".xlsx,.xls,.csv" @change="onImportFile" style="display:none;" />
          </label>
        </div>
        <div v-if="importError" style="color:#f87171;font-size:12px;padding:10px 14px;background:rgba(239,68,68,0.08);border-radius:10px;border:1px solid rgba(239,68,68,0.18);margin-bottom:10px;">{{ importError }}</div>
        <div v-if="importPreview.length" class="glass" style="padding:12px;border-radius:12px;">
          <p style="font-size:12px;color:var(--ct-green);margin:0 0 8px;">✓ {{ importPreview.length }} record(s) ready to import</p>
          <p v-if="importSkipped" style="font-size:11px;color:#fbbf24;margin:0 0 6px;">⚠ {{ importSkipped }} row(s) skipped (missing required fields)</p>
          <div style="max-height:120px;overflow-y:auto;font-size:11px;color:var(--ct-muted);">
            <div v-for="(r, i) in importPreview.slice(0,5)" :key="i" style="padding:2px 0;">{{ r.bomNumber }} — {{ r.description || '(no description)' }}</div>
            <div v-if="importPreview.length > 5" style="color:var(--ct-muted);">…and {{ importPreview.length - 5 }} more</div>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="closeImport">Cancel</button>
        <button class="btn-primary" :disabled="!importPreview.length || importing" @click="doImport">
          <Upload :size="14" /> {{ importing ? 'Importing…' : `Import ${importPreview.length} Records` }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Layers, Plus, Search, Pencil, Trash2, Eye, X, Upload, FileDown, Loader2 } from 'lucide-vue-next'
import DataTable from '@/components/ui/DataTable.vue'
import AppModal from '@/components/ui/AppModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useCollection } from '@/composables/useCollection'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { Collections } from '@/firebase/collections'
import { loadBillingConfig, renderBillingHtml, getDocMeta } from '@/composables/useBillingPDF'
import { generateOrGetPdf, triggerDownload } from '@/composables/usePdfApiService'
import * as XLSX from 'xlsx'

const ui = useUIStore()
const auth = useAuthStore()
const { items, loading, add, edit, del } = useCollection(Collections.BOM)
const projects = useCollection(Collections.PROJECTS)
const vendors = useCollection(Collections.VENDORS)

const pdfLoading = ref({})

async function downloadBomPdf(row) {
  if (pdfLoading.value[row.id]) return
  pdfLoading.value[row.id] = true
  try {
    const config = await loadBillingConfig()
    // Enrich row with project client data if not already stored
    const proj = row.projectId ? projects.items.value.find(p => p.id === row.projectId) : null
    const enrichedRow = {
      ...row,
      clientName: row.clientName || proj?.clientName || '',
      clientPhone: row.clientPhone || proj?.phone || proj?.clientPhone || '',
      clientAddress: row.clientAddress || proj?.address || proj?.clientAddress || '',
      projectName: proj?.projectName || proj?.name || '',
    }
    const html = renderBillingHtml(enrichedRow, 'bom', config)
    const { filename } = getDocMeta(enrichedRow, 'bom')
    const url = await generateOrGetPdf(enrichedRow, 'bom', html, filename, config.updatedAt)
    await triggerDownload(url, filename)
    ui.success('PDF ready — opening download.')
  } catch (e) {
    ui.error(e?.message || 'PDF generation failed.')
  } finally {
    pdfLoading.value[row.id] = false
  }
}

watch(() => form.value.projectId, (id) => {
  const proj = projects.items.value.find(p => p.id === id)
  if (proj) {
    form.value.clientName = proj.clientName || ''
    form.value.clientPhone = proj.phone || proj.clientPhone || ''
    form.value.clientAddress = proj.address || proj.clientAddress || ''
  } else {
    form.value.clientName = ''
    form.value.clientPhone = ''
    form.value.clientAddress = ''
  }
})

const search = ref('')
const projectFilter = ref('')
const statusFilter = ref('')
const page = ref(1)
const pageSize = 20
const showModal = ref(false)
const showViewModal = ref(false)
const editing = ref(null)
const viewItem = ref(null)
const saving = ref(false)
const confirmRef = ref(null)
let pendingDeleteId = null

const emptyForm = () => ({
  bomNumber: '', projectId: '', status: 'draft', description: '',
  clientName: '', clientPhone: '', clientAddress: '',
  items: [],
})
const form = ref(emptyForm())

const columns = [
  { key: 'bomNumber', label: 'BOM #' },
  { key: 'project', label: 'Project' },
  { key: 'description', label: 'Description' },
  { key: 'items', label: 'Items / Value' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions', width: '130px' },
]

const filtered = computed(() => items.value.filter(b => {
  const q = search.value.toLowerCase()
  if (q && !b.bomNumber?.toLowerCase().includes(q) && !b.description?.toLowerCase().includes(q)) return false
  if (projectFilter.value && b.projectId !== projectFilter.value) return false
  if (statusFilter.value && (b.status || 'draft') !== statusFilter.value) return false
  return true
}))

const pagedItems = computed(() => {
  const s = (page.value - 1) * pageSize
  return filtered.value.slice(s, s + pageSize)
})

const getProjectName = (id) => projects.items.value.find(p => p.id === id)?.projectName || projects.items.value.find(p => p.id === id)?.name || '—'
const getVendorName = (id) => vendors.items.value.find(v => v.id === id)?.name || '—'
const getTotal = (b) => (b.items || []).reduce((s, i) => s + (i.qty || 0) * (i.unitCost || 0), 0)

function addItem() { form.value.items.push({ partName: '', partDescription: '', partNumber: '', qty: 1, unit: 'pcs', unitCost: 0, vendorId: '' }) }
function removeItem(i) { form.value.items.splice(i, 1) }

function openAdd() {
  editing.value = null
  form.value = emptyForm()
  form.value.bomNumber = `BOM-${String(items.value.length + 1).padStart(4, '0')}`
  showModal.value = true
}
function openEdit(row) {
  editing.value = row
  form.value = { ...emptyForm(), ...row, items: (row.items || []).map(i => ({ ...i })) }
  showModal.value = true
}
function viewBOM(row) {
  viewItem.value = row
  showViewModal.value = true
}

async function save() {
  if (!form.value.bomNumber.trim()) return ui.error('BOM number required')
  saving.value = true
  try {
    if (editing.value) {
      await edit(editing.value.id, form.value, `Updated BOM ${form.value.bomNumber}`)
      ui.success('BOM updated')
    } else {
      await add(form.value, `Created BOM ${form.value.bomNumber}`)
      ui.success('BOM created')
    }
    showModal.value = false
  } catch { ui.error('Save failed') }
  finally { saving.value = false }
}

function confirmDel(row) {
  pendingDeleteId = row.id
  confirmRef.value?.open(`Delete BOM "${row.bomNumber}"?`)
}
async function doDelete() {
  await del(pendingDeleteId, 'Deleted BOM')
  ui.success('BOM deleted')
}


const statusBadge = (s) => ({ draft: 'badge-inactive', approved: 'badge-active', ordered: 'badge-info', received: 'badge-purple' }[s] || 'badge-inactive')
const formatCurrency = (v) => `₹${(v || 0).toLocaleString('en-IN')}`
function formatDate(d) {
  if (!d) return '—'
  const date = d?.toDate ? d.toDate() : new Date(d)
  if (isNaN(date.getTime())) return '—'
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${date.getFullYear()}`
}

// ── Excel Import ──────────────────────────────────────────────────────────────
const showImportModal = ref(false)
const importFile = ref(null)
const importPreview = ref([])
const importError = ref('')
const importSkipped = ref(0)
const importing = ref(false)

const importColumns = [
  { key: 'bomNumber', example: 'BOM-0001', required: true },
  { key: 'status', example: 'draft', required: false },
  { key: 'description', example: 'Cabin renovation materials', required: false },
  { key: 'partName', example: 'Steel Cable', required: false },
  { key: 'qty', example: '10', required: false },
  { key: 'unit', example: 'm', required: false },
  { key: 'unitCost', example: '250', required: false },
]

function onImportFile(e) {
  importError.value = ''
  importPreview.value = []
  importSkipped.value = 0
  const file = e.target.files[0]
  if (!file) return
  importFile.value = file
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      const valid = []
      let skipped = 0
      rows.forEach(row => {
        const bomNumber = String(row.bomNumber || row['BOM Number'] || row['bom_number'] || '').trim()
        if (!bomNumber) { skipped++; return }
        valid.push({
          bomNumber,
          status: String(row.status || 'draft').trim(),
          description: String(row.description || row['Description'] || '').trim(),
          items: row.partName ? [{
            partName: String(row.partName || row['Part Name'] || '').trim(),
            partNumber: String(row.partNumber || row['Part Number'] || '').trim(),
            qty: Number(row.qty || 1),
            unit: String(row.unit || 'pcs').trim(),
            unitCost: Number(row.unitCost || row['Unit Cost'] || 0),
            vendorId: '',
          }] : [],
        })
      })
      importPreview.value = valid
      importSkipped.value = skipped
      if (!valid.length) importError.value = 'No valid rows found. Check column names match expected format.'
    } catch (err) {
      importError.value = 'Failed to parse file: ' + err.message
    }
  }
  reader.readAsArrayBuffer(file)
  e.target.value = ''
}

async function doImport() {
  importing.value = true
  let success = 0
  for (const row of importPreview.value) {
    try {
      await add(row, `Imported BOM ${row.bomNumber}`)
      success++
    } catch {}
  }
  ui.success(`Imported ${success} BOM record(s).`)
  closeImport()
  importing.value = false
}

function closeImport() {
  showImportModal.value = false
  importFile.value = null
  importPreview.value = []
  importError.value = ''
  importSkipped.value = 0
}
</script>

<style scoped>
.page-container { padding: 28px; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
