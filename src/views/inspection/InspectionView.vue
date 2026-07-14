<template>
  <div class="page-wrap">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <ClipboardCheck :size="20" class="header-icon" />
        <div>
          <h1 class="page-title">Inspection</h1>
          <p class="page-sub">Safe lifts, certified records, full compliance — on every visit.</p>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn-secondary" @click="showExportDialog = true">
          <Download :size="15" /> Export
        </button>
        <button class="btn-primary" @click="openForm()">
          <Plus :size="15" /> New Inspection
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card" v-for="s in stats" :key="s.label">
        <div class="stat-val" :style="{ color: s.color }">{{ s.val }}</div>
        <div class="stat-lbl">{{ s.label }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <div class="search-wrap">
        <Search :size="14" class="search-icon" />
        <input v-model="search" class="search-input" placeholder="Search by client, location, inspector..." />
      </div>
      <select v-model="filterStatus" class="filter-select">
        <option value="">All Status</option>
        <option value="pass">Pass</option>
        <option value="fail">Fail</option>
        <option value="conditional">Conditional</option>
        <option value="pending">Pending</option>
      </select>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <div v-if="loading" class="empty-state"><Loader2 :size="22" class="spin" /> Loading...</div>
      <div v-else-if="filtered.length === 0" class="empty-state">
        <ClipboardCheck :size="32" style="opacity:0.2;margin-bottom:8px;" />
        <p>No inspection records found</p>
      </div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>Report No</th>
            <th>Date</th>
            <th>Client / Site</th>
            <th>Inspector</th>
            <th>Lift ID</th>
            <th>Overall</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rec in filtered" :key="rec.id">
            <td><span class="mono">{{ rec.reportNo }}</span></td>
            <td>{{ fmtDate(rec.date) }}</td>
            <td>
              <div class="cell-main">{{ rec.clientName }}</div>
              <div class="cell-sub">{{ rec.siteAddress }}</div>
            </td>
            <td>{{ rec.inspectorName }}</td>
            <td>{{ rec.liftId }}</td>
            <td>
              <span class="badge" :class="statusClass(rec.overallStatus)">
                {{ rec.overallStatus || 'Pending' }}
              </span>
            </td>
            <td>
              <div class="row-actions">
                <button class="icon-btn" title="View" @click="openView(rec)"><Eye :size="14" /></button>
                <button class="icon-btn" title="Edit" @click="openForm(rec)"><Pencil :size="14" /></button>
                <button class="icon-btn" title="PDF" @click="downloadPDF(rec)"><FileText :size="14" /></button>
                <button class="icon-btn" title="Excel" @click="downloadExcelReport(rec)"><FileSpreadsheet :size="14" /></button>
                <button class="icon-btn danger" title="Delete" @click="confirmDelete(rec)"><Trash2 :size="14" /></button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── New / Edit Form Modal ──────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showForm" class="modal-backdrop" @click.self="showForm = false">
        <div class="modal-box large">
          <div class="modal-header">
            <h2>{{ editId ? 'Edit Inspection' : 'New Inspection Report' }}</h2>
            <button class="close-btn" @click="showForm = false"><X :size="18" /></button>
          </div>

          <div class="modal-body">
            <!-- Step tabs -->
            <div class="step-tabs">
              <button v-for="(s, i) in steps" :key="i"
                class="step-tab" :class="{ active: step === i, done: i < step }"
                @click="step = i">
                <span class="step-num">{{ i + 1 }}</span>
                <span class="step-label">{{ s }}</span>
              </button>
            </div>

            <!-- Step 0: Basic Info -->
            <div v-show="step === 0" class="form-grid">
              <div class="field-group">
                <label>Report No *</label>
                <input v-model="form.reportNo" class="field-input" placeholder="e.g. INS-001" />
              </div>
              <div class="field-group">
                <label>Inspection Date *</label>
                <input v-model="form.date" type="date" class="field-input" />
              </div>
              <div class="field-group">
                <label>Inspector Name *</label>
                <input v-model="form.inspectorName" class="field-input" placeholder="Name of inspector" />
              </div>
              <div class="field-group">
                <label>Client Name *</label>
                <input v-model="form.clientName" class="field-input" placeholder="Client / Owner name" />
              </div>
              <div class="field-group span2">
                <label>Site Address</label>
                <input v-model="form.siteAddress" class="field-input" placeholder="Site / installation address" />
              </div>
              <div class="field-group">
                <label>Lift / Elevator ID</label>
                <input v-model="form.liftId" class="field-input" placeholder="e.g. LFT-001" />
              </div>
              <div class="field-group">
                <label>AMC Reference</label>
                <input v-model="form.amcRef" class="field-input" placeholder="AMC No. (if applicable)" />
              </div>
            </div>

            <!-- Step 1: Elevator Details -->
            <div v-show="step === 1" class="form-grid">
              <div class="field-group">
                <label>Make / Brand</label>
                <input v-model="form.make" class="field-input" placeholder="e.g. Avant Elevators" />
              </div>
              <div class="field-group">
                <label>Model</label>
                <input v-model="form.model" class="field-input" placeholder="Model number" />
              </div>
              <div class="field-group">
                <label>Capacity (Kg)</label>
                <input v-model="form.capacityKg" class="field-input" type="number" placeholder="e.g. 680" />
              </div>
              <div class="field-group">
                <label>Capacity (Persons)</label>
                <input v-model="form.capacityPersons" class="field-input" type="number" placeholder="e.g. 8" />
              </div>
              <div class="field-group">
                <label>Speed (m/s)</label>
                <input v-model="form.speed" class="field-input" placeholder="e.g. 1.0" />
              </div>
              <div class="field-group">
                <label>Drive Type</label>
                <select v-model="form.driveType" class="field-input">
                  <option value="">Select</option>
                  <option>Gearless Traction</option>
                  <option>Geared Traction</option>
                  <option>Hydraulic</option>
                  <option>MRL Traction</option>
                  <option>VFD Drive</option>
                </select>
              </div>
              <div class="field-group">
                <label>No. of Floors</label>
                <input v-model="form.floors" class="field-input" type="number" placeholder="e.g. 6" />
              </div>
              <div class="field-group">
                <label>No. of Stops</label>
                <input v-model="form.stops" class="field-input" type="number" placeholder="e.g. 6" />
              </div>
              <div class="field-group">
                <label>Year of Installation</label>
                <input v-model="form.yearInstalled" class="field-input" type="number" placeholder="e.g. 2020" />
              </div>
              <div class="field-group">
                <label>Last Inspection Date</label>
                <input v-model="form.lastInspectionDate" type="date" class="field-input" />
              </div>
            </div>

            <!-- Step 2: Inspection Checklist -->
            <div v-show="step === 2" class="checklist-section">
              <div v-for="section in checklist" :key="section.key" class="checklist-group">
                <div class="checklist-group-header">{{ section.label }}</div>
                <div class="checklist-items">
                  <div v-for="item in section.items" :key="item.key" class="checklist-row">
                    <span class="checklist-label">{{ item.label }}</span>
                    <div class="checklist-options">
                      <label v-for="opt in ['OK', 'Defective', 'N/A']" :key="opt" class="radio-opt"
                        :class="{ selected: form.checks[item.key] === opt }">
                        <input type="radio" :name="item.key" :value="opt" v-model="form.checks[item.key]" />
                        {{ opt }}
                      </label>
                    </div>
                    <input v-model="form.checkRemarks[item.key]" class="remark-input" placeholder="Remarks..." />
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 3: Observations & Result -->
            <div v-show="step === 3" class="form-grid">
              <div class="field-group span2">
                <label>Observations</label>
                <textarea v-model="form.observations" class="field-input" rows="4"
                  placeholder="General observations during inspection..." />
              </div>
              <div class="field-group span2">
                <label>Recommendations</label>
                <textarea v-model="form.recommendations" class="field-input" rows="4"
                  placeholder="Actions recommended..." />
              </div>
              <div class="field-group">
                <label>Overall Status *</label>
                <select v-model="form.overallStatus" class="field-input">
                  <option value="">Select</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                  <option value="conditional">Conditional</option>
                  <option value="pending">Pending Review</option>
                </select>
              </div>
              <div class="field-group">
                <label>Next Inspection Due</label>
                <input v-model="form.nextInspectionDate" type="date" class="field-input" />
              </div>
              <div class="field-group span2">
                <label>Additional Notes</label>
                <textarea v-model="form.notes" class="field-input" rows="3" placeholder="Any other notes..." />
              </div>
            </div>

            <!-- Step 4: Photos -->
            <div v-show="step === 4" class="photos-section">
              <div class="photo-upload-area" @click="triggerPhotoUpload" @dragover.prevent @drop.prevent="handleDrop">
                <Camera :size="28" style="opacity:0.4;margin-bottom:8px;" />
                <p>Click or drag &amp; drop images here</p>
                <span class="upload-hint">Supports JPG, PNG, WEBP</span>
                <input ref="photoInput" type="file" accept="image/*" multiple style="display:none"
                  @change="handlePhotoSelect" />
              </div>
              <div v-if="form.photos.length" class="photo-grid">
                <div v-for="(ph, i) in form.photos" :key="i" class="photo-thumb">
                  <img :src="ph.url" :alt="ph.name" @click="lightboxIdx = i; showLightbox = true" />
                  <div class="photo-caption">
                    <input v-model="ph.caption" class="caption-input" placeholder="Caption..." />
                  </div>
                  <button class="photo-remove" @click="removePhoto(i)"><X :size="12" /></button>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" @click="step > 0 ? step-- : showForm = false">
              {{ step > 0 ? 'Back' : 'Cancel' }}
            </button>
            <div style="display:flex;gap:8px;">
              <button v-if="step < steps.length - 1" class="btn-primary" @click="step++">Next</button>
              <button v-else class="btn-primary" :disabled="saving" @click="saveInspection">
                <Loader2 v-if="saving" :size="14" class="spin" />
                {{ saving ? 'Saving...' : (editId ? 'Update' : 'Save Inspection') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── View Modal ──────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showViewModal && viewRec" class="modal-backdrop" @click.self="showViewModal = false">
        <div class="modal-box large">
          <div class="modal-header">
            <h2>Inspection Report — {{ viewRec.reportNo }}</h2>
            <div style="display:flex;gap:8px;">
              <button class="btn-secondary" @click="downloadPDF(viewRec)"><FileText :size="14" /> PDF</button>
              <button class="btn-secondary" @click="downloadExcelReport(viewRec)"><FileSpreadsheet :size="14" /> Excel</button>
              <button class="close-btn" @click="showViewModal = false"><X :size="18" /></button>
            </div>
          </div>
          <div class="modal-body view-body">
            <div class="view-section">
              <div class="view-grid">
                <div class="view-field"><span>Report No</span><strong>{{ viewRec.reportNo }}</strong></div>
                <div class="view-field"><span>Date</span><strong>{{ fmtDate(viewRec.date) }}</strong></div>
                <div class="view-field"><span>Inspector</span><strong>{{ viewRec.inspectorName }}</strong></div>
                <div class="view-field"><span>Client</span><strong>{{ viewRec.clientName }}</strong></div>
                <div class="view-field"><span>Site</span><strong>{{ viewRec.siteAddress }}</strong></div>
                <div class="view-field"><span>Lift ID</span><strong>{{ viewRec.liftId }}</strong></div>
                <div class="view-field"><span>Make</span><strong>{{ viewRec.make }}</strong></div>
                <div class="view-field"><span>Capacity</span><strong>{{ viewRec.capacityKg }} Kg / {{ viewRec.capacityPersons }} Persons</strong></div>
                <div class="view-field"><span>Speed</span><strong>{{ viewRec.speed }} m/s</strong></div>
                <div class="view-field"><span>Drive</span><strong>{{ viewRec.driveType }}</strong></div>
                <div class="view-field"><span>Overall</span>
                  <span class="badge" :class="statusClass(viewRec.overallStatus)">{{ viewRec.overallStatus }}</span>
                </div>
                <div class="view-field"><span>Next Inspection</span><strong>{{ fmtDate(viewRec.nextInspectionDate) }}</strong></div>
              </div>
            </div>
            <div class="view-section" v-if="viewRec.observations">
              <div class="section-title">Observations</div>
              <p class="view-text">{{ viewRec.observations }}</p>
            </div>
            <div class="view-section" v-if="viewRec.recommendations">
              <div class="section-title">Recommendations</div>
              <p class="view-text">{{ viewRec.recommendations }}</p>
            </div>
            <div class="view-section" v-if="viewRec.photos && viewRec.photos.length">
              <div class="section-title">Photos</div>
              <div class="photo-grid">
                <div v-for="(ph, i) in viewRec.photos" :key="i" class="photo-thumb">
                  <img :src="ph.url" :alt="ph.caption || ph.name" />
                  <div class="photo-caption-view">{{ ph.caption }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Lightbox -->
    <Teleport to="body">
      <div v-if="showLightbox" class="lightbox" @click="showLightbox = false">
        <img :src="form.photos[lightboxIdx]?.url" class="lightbox-img" @click.stop />
        <button class="lightbox-close" @click="showLightbox = false"><X :size="22" /></button>
      </div>
    </Teleport>

    <!-- Export Dialog -->
    <Teleport to="body">
      <div v-if="showExportDialog" class="modal-backdrop" @click.self="showExportDialog = false">
        <div class="modal-box small">
          <div class="modal-header">
            <h2>Export Inspections</h2>
            <button class="close-btn" @click="showExportDialog = false"><X :size="18" /></button>
          </div>
          <div class="modal-body" style="display:flex;flex-direction:column;gap:12px;padding:20px;">
            <button class="export-opt-btn" @click="exportAllPDF">
              <FileText :size="18" /> Export All as PDF
            </button>
            <button class="export-opt-btn" @click="exportAllExcel">
              <FileSpreadsheet :size="18" /> Export All as Excel
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete confirm -->
    <Teleport to="body">
      <div v-if="deleteTarget" class="modal-backdrop" @click.self="deleteTarget = null">
        <div class="modal-box small">
          <div class="modal-header">
            <h2>Confirm Delete</h2>
            <button class="close-btn" @click="deleteTarget = null"><X :size="18" /></button>
          </div>
          <div class="modal-body" style="padding:20px;">
            <p style="color:var(--ct-sub);margin-bottom:16px;">
              Delete inspection <strong>{{ deleteTarget.reportNo }}</strong>? This cannot be undone.
            </p>
            <div style="display:flex;gap:8px;justify-content:flex-end;">
              <button class="btn-secondary" @click="deleteTarget = null">Cancel</button>
              <button class="btn-danger" @click="doDelete">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  ClipboardCheck, Plus, Search, Eye, Pencil, Trash2, X, Download,
  FileText, FileSpreadsheet, Loader2, Camera
} from 'lucide-vue-next'
import { create, update, remove, getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { useActivityStore } from '@/stores/activity'
import { useUIStore } from '@/stores/ui'
import { savePDF, saveExcel } from '@/utils/saveFile'
import { useCompanyConfig } from '@/composables/useCompanyConfig'
import { exportTablePDF, drawHeader, drawFooter, sectionLabel, infoGrid } from '@/composables/usePDF'

const activity = useActivityStore()
const ui = useUIStore()
const { company, load: loadCompany } = useCompanyConfig()

// ── State ──────────────────────────────────────────────────────────────────────
const records = ref([])
const loading = ref(false)
const saving  = ref(false)
const search  = ref('')
const filterStatus = ref('')
const showForm = ref(false)
const showViewModal = ref(false)
const showExportDialog = ref(false)
const showLightbox = ref(false)
const lightboxIdx = ref(0)
const deleteTarget = ref(null)
const editId = ref(null)
const viewRec = ref(null)
const step = ref(0)
const photoInput = ref(null)

const steps = ['Basic Info', 'Lift Details', 'Checklist', 'Result', 'Photos']

// ── Checklist definition ───────────────────────────────────────────────────────
const checklist = [
  {
    key: 'machineRoom',
    label: 'A. Machine Room',
    items: [
      { key: 'mr_access',      label: 'Machine room access & lighting' },
      { key: 'mr_ventilation', label: 'Ventilation & temperature' },
      { key: 'mr_motor',       label: 'Motor condition & noise level' },
      { key: 'mr_gearbox',     label: 'Gearbox condition (if applicable)' },
      { key: 'mr_brakes',      label: 'Electromagnetic brake operation' },
      { key: 'mr_overspeed',   label: 'Overspeed governor condition' },
    ],
  },
  {
    key: 'ropes',
    label: 'B. Ropes & Suspension',
    items: [
      { key: 'rp_condition',  label: 'Wire rope / belt condition' },
      { key: 'rp_tension',    label: 'Rope tension equalization' },
      { key: 'rp_sheave',     label: 'Sheave / pulley condition' },
      { key: 'rp_shackle',    label: 'Rope terminations & shackles' },
    ],
  },
  {
    key: 'car',
    label: 'C. Car / Cabin',
    items: [
      { key: 'car_interior',    label: 'Car interior condition' },
      { key: 'car_lighting',    label: 'Car lighting & emergency light' },
      { key: 'car_buttons',     label: 'Car operating panel & buttons' },
      { key: 'car_indicators',  label: 'Floor indicators & display' },
      { key: 'car_alarm',       label: 'Alarm bell & intercom' },
      { key: 'car_fan',         label: 'Ventilation fan operation' },
      { key: 'car_ceiling',     label: 'Car ceiling & false ceiling' },
      { key: 'car_flooring',    label: 'Car flooring condition' },
    ],
  },
  {
    key: 'doors',
    label: 'D. Doors (Car & Landing)',
    items: [
      { key: 'dr_car_door',      label: 'Car door operation & alignment' },
      { key: 'dr_landing_doors', label: 'Landing doors at all floors' },
      { key: 'dr_safety_edge',   label: 'Safety edge / light curtain' },
      { key: 'dr_door_closer',   label: 'Door closer & restrictor' },
      { key: 'dr_interlock',     label: 'Door interlocks & contacts' },
      { key: 'dr_gap',           label: 'Door gap & sill clearance' },
    ],
  },
  {
    key: 'safety',
    label: 'E. Safety Devices',
    items: [
      { key: 'sf_safety_gear',    label: 'Safety gear / parachute device' },
      { key: 'sf_buffer',         label: 'Car & counterweight buffers (pit)' },
      { key: 'sf_pit_switch',     label: 'Pit stop switch & lighting' },
      { key: 'sf_overload',       label: 'Overload device' },
      { key: 'sf_limit_switch',   label: 'Final limit switches' },
      { key: 'sf_ard',            label: 'ARD (Auto Rescue Device)' },
    ],
  },
  {
    key: 'electrical',
    label: 'F. Electrical & Controls',
    items: [
      { key: 'el_panel',       label: 'Control panel condition' },
      { key: 'el_wiring',      label: 'Wiring & cable ducts' },
      { key: 'el_earthing',    label: 'Earthing / grounding' },
      { key: 'el_vfd',         label: 'VFD / drive unit condition' },
      { key: 'el_emergency',   label: 'Emergency power supply / UPS' },
      { key: 'el_hall_buttons',label: 'Hall call buttons (all floors)' },
    ],
  },
  {
    key: 'pit',
    label: 'G. Pit & Guide Rails',
    items: [
      { key: 'pt_cleanliness', label: 'Pit cleanliness & drainage' },
      { key: 'pt_guide_rails', label: 'Guide rails lubrication & alignment' },
      { key: 'pt_guides',      label: 'Car & counterweight guide shoes' },
      { key: 'pt_compensation',label: 'Compensation chains/ropes (if any)' },
    ],
  },
]

// ── Blank form ─────────────────────────────────────────────────────────────────
function blankForm() {
  const checks = {}
  const checkRemarks = {}
  checklist.forEach(sec => sec.items.forEach(it => { checks[it.key] = ''; checkRemarks[it.key] = '' }))
  return {
    reportNo: '', date: '', inspectorName: '', clientName: '', siteAddress: '',
    liftId: '', amcRef: '', make: 'Avant Elevators', model: '', capacityKg: '',
    capacityPersons: '', speed: '', driveType: '', floors: '', stops: '',
    yearInstalled: '', lastInspectionDate: '', observations: '', recommendations: '',
    overallStatus: '', nextInspectionDate: '', notes: '', photos: [],
    checks, checkRemarks,
  }
}

const form = ref(blankForm())

// ── Computed ───────────────────────────────────────────────────────────────────
const filtered = computed(() => {
  let list = records.value
  if (filterStatus.value) list = list.filter(r => r.overallStatus === filterStatus.value)
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(r =>
      (r.clientName || '').toLowerCase().includes(q) ||
      (r.siteAddress || '').toLowerCase().includes(q) ||
      (r.inspectorName || '').toLowerCase().includes(q) ||
      (r.reportNo || '').toLowerCase().includes(q) ||
      (r.liftId || '').toLowerCase().includes(q)
    )
  }
  return list
})

const stats = computed(() => [
  { label: 'Total',       val: records.value.length,                                           color: '#6366f1' },
  { label: 'Pass',        val: records.value.filter(r => r.overallStatus === 'pass').length,    color: '#22c55e' },
  { label: 'Fail',        val: records.value.filter(r => r.overallStatus === 'fail').length,    color: '#ef4444' },
  { label: 'Conditional', val: records.value.filter(r => r.overallStatus === 'conditional').length, color: '#f59e0b' },
])

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDate(v) {
  if (!v) return '—'
  try { return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return v }
}

function statusClass(s) {
  return { pass: 'badge-green', fail: 'badge-red', conditional: 'badge-amber', pending: 'badge-muted' }[s] || 'badge-muted'
}

// ── Load ───────────────────────────────────────────────────────────────────────
async function load() {
  loading.value = true
  try { records.value = await getAll(Collections.INSPECTIONS) }
  catch (e) { ui.error('Failed to load inspections') }
  finally { loading.value = false }
}

onMounted(() => { load(); loadCompany() })

// ── Open / Edit ────────────────────────────────────────────────────────────────
function openForm(rec = null) {
  if (rec) {
    editId.value = rec.id
    const blank = blankForm()
    form.value = { ...blank, ...rec,
      checks:       { ...blank.checks,       ...(rec.checks || {}) },
      checkRemarks: { ...blank.checkRemarks, ...(rec.checkRemarks || {}) },
      photos:        rec.photos ? rec.photos.map(p => ({ ...p })) : [],
    }
  } else {
    editId.value = null
    form.value = blankForm()
    // Auto-generate report number
    form.value.reportNo = 'INS-' + String(records.value.length + 1).padStart(3, '0')
    form.value.date = new Date().toISOString().slice(0, 10)
  }
  step.value = 0
  showForm.value = true
}

function openView(rec) { viewRec.value = rec; showViewModal.value = true }

// ── Photos ─────────────────────────────────────────────────────────────────────
function triggerPhotoUpload() { photoInput.value?.click() }

function readAsDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

async function handlePhotoSelect(e) {
  const files = Array.from(e.target.files || [])
  for (const f of files) {
    const url = await readAsDataURL(f)
    form.value.photos.push({ url, name: f.name, caption: '' })
  }
  e.target.value = ''
}

async function handleDrop(e) {
  const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'))
  for (const f of files) {
    const url = await readAsDataURL(f)
    form.value.photos.push({ url, name: f.name, caption: '' })
  }
}

function removePhoto(i) { form.value.photos.splice(i, 1) }

// ── Save ───────────────────────────────────────────────────────────────────────
async function saveInspection() {
  if (!form.value.reportNo || !form.value.clientName) {
    ui.error('Report No and Client Name are required'); return
  }
  saving.value = true
  try {
    const data = { ...form.value }
    if (editId.value) {
      await update(Collections.INSPECTIONS, editId.value, data)
      await activity.log('update', 'inspection', { reportNo: data.reportNo, client: data.clientName })
      ui.success('Inspection updated')
    } else {
      await create(Collections.INSPECTIONS, data)
      await activity.log('create', 'inspection', { reportNo: data.reportNo, client: data.clientName })
      ui.success('Inspection saved')
    }
    showForm.value = false
    await load()
  } catch (e) { ui.error('Save failed: ' + e.message) }
  finally { saving.value = false }
}

// ── Delete ─────────────────────────────────────────────────────────────────────
function confirmDelete(rec) { deleteTarget.value = rec }
async function doDelete() {
  try {
    await remove(Collections.INSPECTIONS, deleteTarget.value.id)
    await activity.log('delete', 'inspection', { reportNo: deleteTarget.value.reportNo })
    ui.success('Deleted')
    deleteTarget.value = null
    await load()
  } catch (e) { ui.error('Delete failed') }
}

// ── PDF Export ─────────────────────────────────────────────────────────────────
async function downloadPDF(rec) {
  try {
    const { jsPDF } = await import('jspdf')
    const { applyPlugin } = await import('jspdf-autotable')
    applyPlugin(jsPDF)

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const PAGE_W = 210
    const MARGIN = 12

    const co = company.value
    const userName = rec.inspectorName || 'Inspector'

    let y = await drawHeader(doc, {
      company: co, userName,
      title: 'ELEVATOR INSPECTION REPORT',
      subtitle: `Report No: ${rec.reportNo}`,
      accent: [37, 99, 235],
    })

    // ── Info grid ────────────────────────────────────────────────────────────
    y = sectionLabel(doc, 'Inspection Details', y)
    y = infoGrid(doc, [
      ['Report No',        rec.reportNo || '—'],
      ['Inspection Date',  fmtDate(rec.date)],
      ['Inspector',        rec.inspectorName || '—'],
      ['Client / Owner',   rec.clientName || '—'],
      ['Site Address',     rec.siteAddress || '—'],
      ['Lift ID',          rec.liftId || '—'],
      ['AMC Reference',    rec.amcRef || '—'],
      ['Last Inspection',  fmtDate(rec.lastInspectionDate)],
    ], y)

    y = sectionLabel(doc, 'Elevator Specifications', y + 2)
    y = infoGrid(doc, [
      ['Make / Brand',     rec.make || '—'],
      ['Model',            rec.model || '—'],
      ['Capacity (Kg)',    rec.capacityKg ? rec.capacityKg + ' Kg' : '—'],
      ['Capacity (Persons)', rec.capacityPersons ? rec.capacityPersons + ' Persons' : '—'],
      ['Speed',            rec.speed ? rec.speed + ' m/s' : '—'],
      ['Drive Type',       rec.driveType || '—'],
      ['No. of Floors',    rec.floors || '—'],
      ['No. of Stops',     rec.stops || '—'],
      ['Year Installed',   rec.yearInstalled || '—'],
    ], y)

    // ── Checklist ────────────────────────────────────────────────────────────
    const checks = rec.checks || {}
    const remarks = rec.checkRemarks || {}
    for (const section of checklist) {
      if (y > 240) { doc.addPage(); y = 14 }
      y = sectionLabel(doc, section.label, y + 2)

      const rows = section.items.map(it => [
        it.label,
        checks[it.key] || '—',
        remarks[it.key] || '',
      ])

      doc.autoTable({
        startY: y,
        head: [['Item', 'Status', 'Remarks']],
        body: rows,
        styles: { fontSize: 7.5, cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 }, font: 'helvetica', textColor: [17, 24, 39] },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
        columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 22 }, 2: { cellWidth: 'auto' } },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: MARGIN, right: MARGIN },
        didParseCell(data) {
          if (data.column.index === 1) {
            const v = data.cell.raw
            if (v === 'OK')       data.cell.styles.textColor = [22, 163, 74]
            if (v === 'Defective')data.cell.styles.textColor = [220, 38, 38]
            if (v === 'N/A')      data.cell.styles.textColor = [107, 114, 128]
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })
      y = doc.lastAutoTable.finalY + 3
    }

    // ── Observations ─────────────────────────────────────────────────────────
    if (rec.observations) {
      if (y > 250) { doc.addPage(); y = 14 }
      y = sectionLabel(doc, 'Observations', y + 2)
      doc.setFontSize(8.5); doc.setTextColor(17, 24, 39); doc.setFont('helvetica', 'normal')
      const obsLines = doc.splitTextToSize(rec.observations, PAGE_W - MARGIN * 2)
      doc.text(obsLines, MARGIN, y + 4)
      y += obsLines.length * 5 + 6
    }

    if (rec.recommendations) {
      if (y > 250) { doc.addPage(); y = 14 }
      y = sectionLabel(doc, 'Recommendations', y + 2)
      doc.setFontSize(8.5); doc.setTextColor(17, 24, 39); doc.setFont('helvetica', 'normal')
      const recLines = doc.splitTextToSize(rec.recommendations, PAGE_W - MARGIN * 2)
      doc.text(recLines, MARGIN, y + 4)
      y += recLines.length * 5 + 6
    }

    // ── Overall result ────────────────────────────────────────────────────────
    if (y > 240) { doc.addPage(); y = 14 }
    y = sectionLabel(doc, 'Inspection Result', y + 2)
    const statusColors = { pass: [22, 163, 74], fail: [220, 38, 38], conditional: [180, 83, 9], pending: [107, 114, 128] }
    const sc = statusColors[rec.overallStatus] || [107, 114, 128]
    doc.setFillColor(...sc)
    doc.roundedRect(MARGIN, y + 2, 60, 12, 2, 2, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255)
    doc.text((rec.overallStatus || 'PENDING').toUpperCase(), MARGIN + 30, y + 10, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(17, 24, 39)
    if (rec.nextInspectionDate)
      doc.text('Next Inspection Due: ' + fmtDate(rec.nextInspectionDate), MARGIN + 70, y + 9)
    y += 18

    // ── Notes ─────────────────────────────────────────────────────────────────
    if (rec.notes) {
      if (y > 250) { doc.addPage(); y = 14 }
      y = sectionLabel(doc, 'Notes', y + 2)
      doc.setFontSize(8); doc.setTextColor(75, 85, 99); doc.setFont('helvetica', 'normal')
      doc.text(doc.splitTextToSize(rec.notes, PAGE_W - MARGIN * 2), MARGIN, y + 4)
    }

    // ── Photos ────────────────────────────────────────────────────────────────
    const photos = rec.photos || []
    if (photos.length) {
      doc.addPage(); let py = 14
      py = sectionLabel(doc, 'Photo Evidence', py)
      py += 4
      const colW = (PAGE_W - MARGIN * 2 - 6) / 2
      const imgH = 55
      photos.forEach((ph, idx) => {
        const col = idx % 2
        const x = MARGIN + col * (colW + 6)
        if (col === 0 && idx > 0) { py += imgH + 14 }
        if (py + imgH + 14 > 275) { doc.addPage(); py = 14 }
        try {
          const ext = ph.url.startsWith('data:image/png') ? 'PNG' : 'JPEG'
          doc.addImage(ph.url, ext, x, py, colW, imgH)
        } catch (_) {
          doc.setFillColor(240, 240, 240)
          doc.rect(x, py, colW, imgH, 'F')
          doc.setFontSize(7); doc.setTextColor(150, 150, 150)
          doc.text('Image unavailable', x + colW / 2, py + imgH / 2, { align: 'center' })
        }
        if (ph.caption) {
          doc.setFontSize(7); doc.setTextColor(75, 85, 99)
          doc.text(ph.caption, x, py + imgH + 4)
        }
      })
    }

    // ── Signature block ───────────────────────────────────────────────────────
    doc.addPage()
    let sy = 20
    sy = sectionLabel(doc, 'Certification & Signatures', sy)
    sy += 8
    doc.setFontSize(8.5); doc.setTextColor(17, 24, 39); doc.setFont('helvetica', 'normal')
    doc.text('I hereby certify that this inspection has been carried out in accordance with applicable safety standards.', MARGIN, sy)
    sy += 12

    const sigBoxW = (PAGE_W - MARGIN * 2 - 10) / 2
    ;[[MARGIN, 'Inspector Signature', rec.inspectorName], [MARGIN + sigBoxW + 10, 'Authorized By', co.name || '']].forEach(([x, label, name]) => {
      doc.setDrawColor(209, 213, 219); doc.setLineWidth(0.3)
      doc.rect(x, sy, sigBoxW, 28)
      doc.setFontSize(7); doc.setTextColor(107, 114, 128)
      doc.text(label, x + 4, sy + 6)
      doc.setFontSize(8.5); doc.setTextColor(17, 24, 39); doc.setFont('helvetica', 'bold')
      doc.text(name || '', x + 4, sy + 14)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(107, 114, 128)
      doc.text('Date: ' + fmtDate(rec.date), x + 4, sy + 24)
    })

    drawFooter(doc, { company: co.name, title: 'Inspection Report — ' + rec.reportNo })
    await savePDF(doc, `Inspection-${rec.reportNo}.pdf`, ui)
    await activity.log('export_pdf', 'inspection', { reportNo: rec.reportNo })
    ui.success('PDF downloaded')
  } catch (e) { console.error(e); ui.error('PDF export failed: ' + e.message) }
}

// ── Excel Export ───────────────────────────────────────────────────────────────
async function downloadExcelReport(rec) {
  try {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    wb.creator = company.value.name || 'Avant Elevators'

    const ws = wb.addWorksheet('Inspection Report', {
      pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
    })
    ws.columns = [
      { key: 'a', width: 6 }, { key: 'b', width: 40 }, { key: 'c', width: 18 }, { key: 'd', width: 40 },
    ]

    const co = company.value
    const DARK = 'FF1F3864'; const LIGHT = 'FFD9E1F2'; const WHITE = 'FFFFFFFF'
    const thin = { style: 'thin', color: { argb: 'FF000000' } }
    const bAll = { top: thin, left: thin, bottom: thin, right: thin }

    function mergeRow(rn, text, bg = LIGHT, fgColor = 'FF000000', bold = false, sz = 11, align = 'center') {
      ws.getRow(rn).height = 20
      ws.mergeCells(rn, 1, rn, 4)
      const c = ws.getCell(rn, 1)
      c.value = text; c.font = { name: 'Arial', size: sz, bold, color: { argb: fgColor } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
      c.alignment = { horizontal: align, vertical: 'middle', wrapText: true }
      c.border = bAll
    }

    function fieldRow(rn, label, value) {
      ws.getRow(rn).height = 16
      ws.mergeCells(rn, 1, rn, 2); ws.mergeCells(rn, 3, rn, 4)
      const lc = ws.getCell(rn, 1)
      lc.value = label; lc.font = { name: 'Arial', size: 9, bold: true }
      lc.alignment = { horizontal: 'left', vertical: 'middle' }; lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }; lc.border = bAll
      const vc = ws.getCell(rn, 3)
      vc.value = value || '—'; vc.font = { name: 'Arial', size: 9 }
      vc.alignment = { horizontal: 'left', vertical: 'middle' }; vc.border = bAll
    }

    let r = 1
    mergeRow(r++, (co.name || 'Avant Elevators').toUpperCase(), DARK, WHITE, true, 14)
    mergeRow(r++, 'ELEVATOR INSPECTION REPORT', DARK, WHITE, true, 12)
    mergeRow(r++, `Report No: ${rec.reportNo}  |  Date: ${fmtDate(rec.date)}`, LIGHT, 'FF000000', false, 10)
    r++

    mergeRow(r++, 'INSPECTION DETAILS', 'FFD9E1F2', 'FF1F3864', true, 10, 'left')
    fieldRow(r++, 'Inspector', rec.inspectorName); fieldRow(r++, 'Client / Owner', rec.clientName)
    fieldRow(r++, 'Site Address', rec.siteAddress); fieldRow(r++, 'Lift ID', rec.liftId)
    fieldRow(r++, 'AMC Reference', rec.amcRef || '—'); fieldRow(r++, 'Last Inspection', fmtDate(rec.lastInspectionDate))
    r++

    mergeRow(r++, 'ELEVATOR SPECIFICATIONS', 'FFD9E1F2', 'FF1F3864', true, 10, 'left')
    fieldRow(r++, 'Make / Brand', rec.make); fieldRow(r++, 'Model', rec.model)
    fieldRow(r++, 'Capacity', (rec.capacityKg || '—') + ' Kg / ' + (rec.capacityPersons || '—') + ' Persons')
    fieldRow(r++, 'Speed', rec.speed ? rec.speed + ' m/s' : '—'); fieldRow(r++, 'Drive Type', rec.driveType)
    fieldRow(r++, 'Floors / Stops', (rec.floors || '—') + ' / ' + (rec.stops || '—')); fieldRow(r++, 'Year Installed', rec.yearInstalled || '—')
    r++

    mergeRow(r++, 'INSPECTION CHECKLIST', DARK, WHITE, true, 11)
    ws.getRow(r).height = 16
    ;['#', 'Inspection Item', 'Status', 'Remarks'].forEach((h, ci) => {
      const c = ws.getCell(r, ci + 1)
      c.value = h; c.font = { name: 'Arial', size: 9, bold: true, color: { argb: WHITE } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } }
      c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = bAll
    }); r++

    const checks = rec.checks || {}; const remarks = rec.checkRemarks || {}
    let sn = 1
    for (const section of checklist) {
      mergeRow(r++, section.label, LIGHT, 'FF1F3864', true, 9, 'left')
      for (const item of section.items) {
        ws.getRow(r).height = 14
        const vals = [sn++, item.label, checks[item.key] || '—', remarks[item.key] || '']
        vals.forEach((v, ci) => {
          const c = ws.getCell(r, ci + 1)
          c.value = v; c.font = { name: 'Arial', size: 8.5 }
          c.alignment = { horizontal: ci >= 2 ? 'center' : 'left', vertical: 'middle', wrapText: ci === 1 || ci === 3 }
          c.border = bAll
          if (ci === 2) {
            if (v === 'OK') c.font = { ...c.font, color: { argb: 'FF16A34A' }, bold: true }
            else if (v === 'Defective') c.font = { ...c.font, color: { argb: 'FFDC2626' }, bold: true }
            else c.font = { ...c.font, color: { argb: 'FF6B7280' } }
          }
        }); r++
      }
    }
    r++

    mergeRow(r++, 'OBSERVATIONS & RECOMMENDATIONS', 'FFD9E1F2', 'FF1F3864', true, 10, 'left')
    ws.getRow(r).height = Math.max(18, Math.ceil((rec.observations || '').length / 60) * 12)
    ws.mergeCells(r, 1, r, 4)
    const oc = ws.getCell(r, 1)
    oc.value = rec.observations || '—'; oc.font = { name: 'Arial', size: 9 }
    oc.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }; oc.border = bAll; r++

    ws.getRow(r).height = Math.max(18, Math.ceil((rec.recommendations || '').length / 60) * 12)
    ws.mergeCells(r, 1, r, 4)
    const rc2 = ws.getCell(r, 1)
    rc2.value = 'Recommendations: ' + (rec.recommendations || '—'); rc2.font = { name: 'Arial', size: 9 }
    rc2.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }; rc2.border = bAll; r++; r++

    mergeRow(r++, 'OVERALL STATUS: ' + (rec.overallStatus || 'PENDING').toUpperCase(), DARK, WHITE, true, 12)
    fieldRow(r++, 'Next Inspection Due', fmtDate(rec.nextInspectionDate))
    if (rec.notes) { r++; mergeRow(r++, 'Notes: ' + rec.notes, 'FFFFFCE8', 'FF000000', false, 9, 'left') }

    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `Inspection-${rec.reportNo}.xlsx`; a.click()
    URL.revokeObjectURL(url)
    await activity.log('export_excel', 'inspection', { reportNo: rec.reportNo })
    ui.success('Excel downloaded')
  } catch (e) { console.error(e); ui.error('Excel export failed: ' + e.message) }
}

// ── Bulk exports ───────────────────────────────────────────────────────────────
async function exportAllPDF() {
  showExportDialog.value = false
  await exportTablePDF({
    title: 'Inspection Records',
    columns: ['Report No', 'Date', 'Client', 'Inspector', 'Lift ID', 'Status'],
    rows: filtered.value.map(r => [r.reportNo, fmtDate(r.date), r.clientName, r.inspectorName, r.liftId, r.overallStatus || 'Pending']),
    filename: 'Inspections',
    ui,
  })
  await activity.log('export_all_pdf', 'inspection', { count: filtered.value.length })
}

async function exportAllExcel() {
  showExportDialog.value = false
  try {
    const XLSX = await import('xlsx')
    const data = [
      ['Report No', 'Date', 'Client', 'Site', 'Inspector', 'Lift ID', 'Make', 'Capacity', 'Drive', 'Overall Status', 'Next Inspection'],
      ...filtered.value.map(r => [r.reportNo, fmtDate(r.date), r.clientName, r.siteAddress, r.inspectorName, r.liftId, r.make, r.capacityKg ? r.capacityKg + ' Kg' : '', r.driveType, r.overallStatus || 'Pending', fmtDate(r.nextInspectionDate)]),
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inspections')
    await saveExcel(wb, 'Inspections.xlsx', ui)
    await activity.log('export_all_excel', 'inspection', { count: filtered.value.length })
    ui.success('Excel exported')
  } catch (e) { ui.error('Excel export failed') }
}
</script>

<style scoped>
.page-wrap { display:flex; flex-direction:column; gap:16px; padding:20px; min-height:0; }

.page-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
.header-left  { display:flex; align-items:center; gap:12px; }
.header-icon  { color:var(--ct-accent); }
.page-title   { font-size:20px; font-weight:700; color:var(--ct-primary); margin:0; }
.page-sub     { font-size:12px; color:var(--ct-muted); margin:0; }
.header-actions { display:flex; gap:8px; }

/* Stats */
.stats-row { display:flex; gap:12px; flex-wrap:wrap; }
.stat-card { flex:1; min-width:120px; background:var(--ct-surface); border:1px solid var(--ct-border); border-radius:12px; padding:14px 16px; }
.stat-val  { font-size:24px; font-weight:700; }
.stat-lbl  { font-size:11px; color:var(--ct-muted); margin-top:2px; }

/* Filter */
.filter-bar    { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.search-wrap   { position:relative; flex:1; min-width:200px; }
.search-icon   { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--ct-muted); pointer-events:none; }
.search-input  { width:100%; padding:8px 12px 8px 34px; background:var(--ct-surface); border:1px solid var(--ct-border); border-radius:8px; color:var(--ct-primary); font-size:13px; outline:none; }
.search-input:focus { border-color:var(--ct-accent); }
.filter-select { padding:8px 12px; background:var(--ct-surface); border:1px solid var(--ct-border); border-radius:8px; color:var(--ct-primary); font-size:13px; outline:none; }

/* Table */
.table-wrap { background:var(--ct-surface); border:1px solid var(--ct-border); border-radius:12px; overflow:auto; }
.data-table { width:100%; border-collapse:collapse; font-size:13px; }
.data-table th { padding:10px 14px; text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--ct-muted); border-bottom:1px solid var(--ct-border); white-space:nowrap; }
.data-table td { padding:11px 14px; border-bottom:1px solid rgba(255,255,255,.04); vertical-align:middle; }
.data-table tbody tr:hover { background:rgba(255,255,255,.03); }
.cell-main { font-weight:500; color:var(--ct-primary); }
.cell-sub  { font-size:11px; color:var(--ct-muted); margin-top:2px; }
.mono      { font-family:monospace; font-size:12px; color:var(--ct-accent); }

.row-actions { display:flex; gap:4px; }
.icon-btn { width:28px;height:28px;border-radius:7px;border:none;background:rgba(255,255,255,.06);color:var(--ct-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s; }
.icon-btn:hover { background:rgba(99,102,241,.15); color:var(--ct-accent); }
.icon-btn.danger:hover { background:rgba(239,68,68,.15); color:#f87171; }

/* Badges */
.badge        { display:inline-block; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; text-transform:capitalize; }
.badge-green  { background:rgba(34,197,94,.12); color:#22c55e; border:1px solid rgba(34,197,94,.2); }
.badge-red    { background:rgba(239,68,68,.12); color:#ef4444; border:1px solid rgba(239,68,68,.2); }
.badge-amber  { background:rgba(245,158,11,.12); color:#f59e0b; border:1px solid rgba(245,158,11,.2); }
.badge-muted  { background:rgba(107,114,128,.12); color:#6b7280; border:1px solid rgba(107,114,128,.2); }

/* Empty */
.empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; color:var(--ct-muted); font-size:13px; gap:4px; }
.spin { animation:spin 1s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }

/* Modal */
.modal-backdrop { position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px; }
.modal-box      { background:#1a2236;border:1px solid var(--ct-border);border-radius:16px;display:flex;flex-direction:column;max-height:90vh;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.6); }
[data-theme="light"] .modal-box { background:#ffffff; }
.modal-box.large { width:100%;max-width:860px; }
.modal-box.small { width:100%;max-width:420px; }
.modal-header   { display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--ct-border);flex-shrink:0; }
.modal-header h2 { font-size:16px;font-weight:700;color:var(--ct-primary);margin:0; }
.close-btn { background:none;border:none;color:var(--ct-muted);cursor:pointer;padding:4px;border-radius:6px; }
.close-btn:hover { color:var(--ct-sub); }
.modal-body  { overflow-y:auto;flex:1;padding:20px 22px; }
.modal-footer { display:flex;align-items:center;justify-content:space-between;padding:14px 22px;border-top:1px solid var(--ct-border);flex-shrink:0; }

/* Step tabs */
.step-tabs { display:flex;gap:4px;margin-bottom:20px;border-bottom:1px solid var(--ct-border);padding-bottom:12px;flex-wrap:wrap; }
.step-tab  { display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;border:none;background:none;color:var(--ct-muted);font-size:12px;cursor:pointer;transition:.15s; }
.step-tab.active { background:rgba(99,102,241,.15);color:var(--ct-accent); }
.step-tab.done   { color:var(--ct-green); }
.step-num { width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0; }
.step-tab.active .step-num { background:var(--ct-accent);color:#fff; }

/* Form grid */
.form-grid { display:grid;grid-template-columns:1fr 1fr;gap:14px; }
.span2     { grid-column:span 2; }
.field-group { display:flex;flex-direction:column;gap:5px; }
.field-group label { font-size:11px;font-weight:600;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.04em; }
.field-input { padding:9px 11px;background:var(--ct-input,rgba(255,255,255,.05));border:1px solid var(--ct-border);border-radius:8px;color:var(--ct-primary);font-size:13px;outline:none;width:100%;resize:vertical; }
.field-input:focus { border-color:var(--ct-accent); }

/* Checklist */
.checklist-section { display:flex;flex-direction:column;gap:16px; }
.checklist-group   { background:rgba(255,255,255,.02);border:1px solid var(--ct-border);border-radius:10px;overflow:hidden; }
.checklist-group-header { padding:10px 14px;font-size:12px;font-weight:700;color:var(--ct-accent);background:rgba(99,102,241,.08);border-bottom:1px solid var(--ct-border); }
.checklist-items   { display:flex;flex-direction:column; }
.checklist-row     { display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid rgba(255,255,255,.04); }
.checklist-row:last-child { border-bottom:none; }
.checklist-label   { flex:1;font-size:12.5px;color:var(--ct-sub);min-width:180px; }
.checklist-options { display:flex;gap:6px; }
.radio-opt { display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:6px;font-size:11px;cursor:pointer;border:1px solid transparent;transition:.15s; }
.radio-opt input { display:none; }
.radio-opt.selected { border-color:var(--ct-accent);background:rgba(99,102,241,.12);color:var(--ct-accent);font-weight:600; }
.remark-input { flex:1;padding:5px 9px;background:rgba(255,255,255,.04);border:1px solid var(--ct-border);border-radius:6px;color:var(--ct-primary);font-size:12px;outline:none;min-width:0; }
.remark-input:focus { border-color:var(--ct-accent); }

/* Photos */
.photos-section { display:flex;flex-direction:column;gap:16px; }
.photo-upload-area { border:2px dashed var(--ct-border);border-radius:12px;padding:32px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:var(--ct-muted);font-size:13px;transition:.2s;gap:4px; }
.photo-upload-area:hover { border-color:var(--ct-accent);color:var(--ct-sub); }
.upload-hint { font-size:11px;color:var(--ct-muted); }
.photo-grid  { display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px; }
.photo-thumb { position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--ct-border); }
.photo-thumb img { width:100%;height:110px;object-fit:cover;display:block;cursor:pointer; }
.photo-caption { padding:4px 6px; }
.caption-input { width:100%;background:none;border:none;color:var(--ct-muted);font-size:11px;outline:none; }
.photo-caption-view { padding:4px 6px;font-size:11px;color:var(--ct-muted); }
.photo-remove { position:absolute;top:5px;right:5px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,.7);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center; }

/* View modal */
.view-body    { display:flex;flex-direction:column;gap:16px; }
.view-section { background:rgba(255,255,255,.02);border:1px solid var(--ct-border);border-radius:10px;padding:14px 16px; }
.view-grid    { display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px; }
.view-field   { display:flex;flex-direction:column;gap:2px; }
.view-field span { font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.04em; }
.view-field strong { font-size:13px;color:var(--ct-primary); }
.section-title { font-size:12px;font-weight:700;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px; }
.view-text { font-size:13px;color:var(--ct-sub);line-height:1.6;margin:0; }

/* Export btn */
.export-opt-btn { display:flex;align-items:center;gap:10px;padding:14px 18px;border-radius:10px;border:1px solid var(--ct-border);background:var(--ct-surface);color:var(--ct-sub);font-size:14px;cursor:pointer;transition:.15s; }
.export-opt-btn:hover { border-color:var(--ct-accent);color:var(--ct-accent);background:rgba(99,102,241,.08); }

/* Lightbox */
.lightbox { position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:500;display:flex;align-items:center;justify-content:center; }
.lightbox-img { max-width:90vw;max-height:90vh;border-radius:8px; }
.lightbox-close { position:absolute;top:20px;right:20px;background:rgba(255,255,255,.12);border:none;color:#fff;cursor:pointer;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center; }

/* Buttons */
.btn-primary { display:inline-flex;align-items:center;gap:7px;padding:8px 16px;border-radius:8px;background:var(--ct-accent,#6366f1);color:#fff;border:none;font-size:13px;font-weight:600;cursor:pointer;transition:.15s; }
.btn-primary:hover { opacity:.88; }
.btn-primary:disabled { opacity:.5;cursor:not-allowed; }
.btn-secondary { display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:8px;background:rgba(255,255,255,.06);color:var(--ct-sub);border:1px solid var(--ct-border);font-size:13px;cursor:pointer;transition:.15s; }
.btn-secondary:hover { background:rgba(255,255,255,.1); }
.btn-danger { display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:8px;background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.2);font-size:13px;cursor:pointer;transition:.15s; }
.btn-danger:hover { background:rgba(239,68,68,.25); }

@media (max-width:640px) {
  .form-grid { grid-template-columns:1fr; }
  .span2     { grid-column:span 1; }
  .stats-row { gap:8px; }
  .stat-card { min-width:90px; }
  .checklist-row { flex-wrap:wrap; }
}
</style>
