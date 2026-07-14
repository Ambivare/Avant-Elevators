<template>
  <div>
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <ShieldCheck :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;color:#818cf8;" />
          Lift Licenses &amp; Certificates
        </h1>
        <p class="page-sub">Compliance credentials, always current and on file.</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button v-if="isAdmin" class="btn-primary" @click="openAdd">
          <Plus :size="15" /> Add Record
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:20px;">
      <div class="glass" style="padding:16px;text-align:center;">
        <div style="font-size:22px;font-weight:700;color:var(--ct-accent);">{{ items.length }}</div>
        <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Total Lifts</div>
      </div>
      <div class="glass" style="padding:16px;text-align:center;">
        <div style="font-size:22px;font-weight:700;color:#4ade80;">{{ validCount }}</div>
        <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">All Valid</div>
      </div>
      <div class="glass" style="padding:16px;text-align:center;">
        <div style="font-size:22px;font-weight:700;color:#fbbf24;">{{ expiringCount }}</div>
        <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Expiring Soon</div>
      </div>
      <div class="glass" style="padding:16px;text-align:center;">
        <div style="font-size:22px;font-weight:700;color:#f87171;">{{ expiredCount }}</div>
        <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:4px;">Expired</div>
      </div>
    </div>

    <!-- Filter tabs -->
    <div class="tabs-nav" style="margin-bottom:20px;">
      <button :class="['tab-btn', statusTab === '' && 'active']" @click="statusTab = ''">
        All <span class="badge badge-info" style="margin-left:4px;">{{ items.length }}</span>
      </button>
      <button :class="['tab-btn', statusTab === 'expiring' && 'active']" @click="statusTab = 'expiring'">
        Expiring Soon
        <span v-if="expiringCount" class="badge badge-warning" style="margin-left:4px;">{{ expiringCount }}</span>
      </button>
      <button :class="['tab-btn', statusTab === 'expired' && 'active']" @click="statusTab = 'expired'">
        Expired
        <span v-if="expiredCount" class="badge badge-danger" style="margin-left:4px;">{{ expiredCount }}</span>
      </button>
      <button :class="['tab-btn', statusTab === 'missing' && 'active']" @click="statusTab = 'missing'">
        Missing Info
      </button>
    </div>

    <!-- Search + filters -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;align-items:center;">
      <div class="search-box" style="flex:1;min-width:220px;">
        <Search :size="14" class="search-icon" />
        <input v-model="search" class="input" placeholder="Search project, client, lift #, cert number…" />
      </div>
      <select v-model="projectFilter" class="input" style="width:200px;">
        <option value="">All Projects</option>
        <option v-for="p in allProjects" :key="p.id" :value="p.id">{{ p.projectName }}</option>
      </select>
    </div>

    <!-- Empty -->
    <div v-if="loading" class="glass empty-state" style="padding:60px;text-align:center;">
      <div style="opacity:.5;">Loading…</div>
    </div>
    <div v-else-if="!filtered.length" class="glass empty-state" style="padding:60px;text-align:center;">
      <ShieldCheck :size="36" style="opacity:.3;margin:0 auto 16px;" />
      <p>No records found.</p>
      <button v-if="isAdmin && !items.length" class="btn-primary" style="margin-top:16px;" @click="openAdd">
        <Plus :size="14" /> Add First Record
      </button>
    </div>

    <!-- Cards grid -->
    <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;">
      <div
        v-for="rec in filtered" :key="rec.id"
        class="glass" style="padding:18px;cursor:pointer;"
        :style="overallBorderStyle(rec)"
        @click="openView(rec)"
      >
        <!-- Card header -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;">
          <div>
            <div style="font-size:10px;color:var(--ct-accent);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px;">
              {{ getProjectName(rec.projectId) || rec.projectName || '—' }}
            </div>
            <div style="font-weight:600;color:var(--ct-primary);font-size:14px;">{{ rec.clientName || '—' }}</div>
            <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">
              Lift {{ rec.liftNumber || '—' }}
              <span v-if="rec.liftSerial"> · {{ rec.liftSerial }}</span>
            </div>
          </div>
          <span :class="['badge', overallBadge(rec)]" style="flex-shrink:0;">{{ overallLabel(rec) }}</span>
        </div>

        <!-- Certificate rows -->
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;">
          <CertRow label="EI Certificate" :number="rec.eiCertNumber" :expiry="rec.eiExpiryDate" :doc-url="rec.eiDocUrl" />
          <CertRow label="PWD License" :number="rec.pwdLicenseNumber" :expiry="rec.pwdExpiryDate" :doc-url="rec.pwdDocUrl" />
          <CertRow label="Insurance" :number="rec.policyNumber" :expiry="rec.insuranceExpiryDate" :doc-url="rec.insuranceDocUrl" />
        </div>

        <!-- Actions -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;" @click.stop>
          <!-- Per-cert download buttons -->
          <a v-if="rec.eiDocUrl" :href="rec.eiDocUrl" target="_blank" class="btn-secondary btn-sm" style="display:flex;align-items:center;gap:4px;text-decoration:none;" title="EI Certificate">
            <Download :size="11" /> EI
          </a>
          <a v-if="rec.pwdDocUrl" :href="rec.pwdDocUrl" target="_blank" class="btn-secondary btn-sm" style="display:flex;align-items:center;gap:4px;text-decoration:none;" title="PWD License">
            <Download :size="11" /> PWD
          </a>
          <a v-if="rec.insuranceDocUrl" :href="rec.insuranceDocUrl" target="_blank" class="btn-secondary btn-sm" style="display:flex;align-items:center;gap:4px;text-decoration:none;" title="Insurance Policy">
            <Download :size="11" /> Ins.
          </a>
          <div style="flex:1;"></div>
          <button v-if="isAdmin" class="btn-secondary btn-sm" @click="openEdit(rec)"><Pencil :size="12" /></button>
          <button v-if="isAdmin" class="btn-danger btn-sm" @click="confirmDel(rec)"><Trash2 :size="12" /></button>
        </div>
      </div>
    </div>

    <!-- Add / Edit Modal -->
    <AppModal
      v-model="showModal"
      :title="editing ? 'Edit Certificate Record' : 'New Certificate Record'"
      :subtitle="editing ? (editing.clientName || '') : ''"
      width="720px"
    >
      <div class="form-grid" style="margin-bottom:20px;">
        <!-- Project link -->
        <div class="form-group form-full">
          <label class="label">Project</label>
          <div style="position:relative;">
            <input v-model="projectSearch" class="input" placeholder="Search project name…"
              @focus="showProjectDd = true" @blur="delayClose" />
            <div v-if="showProjectDd && filteredProjectOptions.length" class="proj-dropdown">
              <div v-for="p in filteredProjectOptions" :key="p.id" @mousedown.prevent="selectProject(p)" class="proj-dropdown-item">
                <div style="font-weight:500;">{{ p.projectName }}</div>
                <div style="font-size:11px;color:var(--ct-muted);margin-top:2px;">{{ p.clientName }}</div>
              </div>
            </div>
          </div>
          <div v-if="form.projectId" style="margin-top:5px;font-size:12px;color:var(--ct-green);">✓ Linked: {{ form.projectName }}</div>
          <!-- Lift selector — shown when project has structured building/wing/lift data -->
          <div v-if="form.projectId && selectedProject && selectedProject.buildings && selectedProject.buildings.length" style="margin-top:12px;">
            <label class="label">Select Building / Wing / Lift</label>
            <LiftSelector :model-value="form.liftSelection" @update:model-value="onLiftSelectionChange" :project="selectedProject" />
          </div>
        </div>

        <div class="form-group">
          <label class="label">Client Name *</label>
          <input v-model="form.clientName" class="input" placeholder="Client / Society name" />
        </div>
        <div class="form-group">
          <label class="label">Lift ID</label>
          <input
            v-model="form.liftNumber"
            class="input"
            placeholder="e.g. L-01 (auto-filled from lift directory)"
            :readonly="form.liftSelection.liftIds.length > 0"
            :style="form.liftSelection.liftIds.length > 0 ? 'background:rgba(99,102,241,0.06);cursor:default;' : ''"
          />
          <div v-if="form.liftSelection.liftIds.length > 1" style="font-size:11px;color:#fbbf24;margin-top:4px;">
            Multiple lifts selected — this record uses the first lift ID. Create separate records for each lift.
          </div>
        </div>
        <div class="form-group form-full">
          <label class="label">Government Registration / Serial Number</label>
          <input v-model="form.liftSerial" class="input" placeholder="Govt. registration number" />
        </div>
      </div>

      <!-- EI Certificate -->
      <div class="glass" style="padding:16px;border-radius:12px;margin-bottom:14px;border-color:rgba(99,102,241,0.2);">
        <div style="font-size:12px;font-weight:700;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;">
          <FileCheck :size="13" style="display:inline;margin-right:5px;vertical-align:-2px;" /> Electrical Inspector (EI) Certificate
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label class="label">Certificate Number</label>
            <input v-model="form.eiCertNumber" class="input" placeholder="EI-XXXX-XXXX" />
          </div>
          <div class="form-group">
            <label class="label">Issue Date</label>
            <input v-model="form.eiIssueDate" class="input" type="date" />
          </div>
          <div class="form-group">
            <label class="label">Expiry Date *</label>
            <input v-model="form.eiExpiryDate" class="input" type="date" />
          </div>
          <div class="form-group">
            <label class="label">Document</label>
            <div style="display:flex;gap:6px;">
              <input v-model="form.eiDocUrl" class="input" placeholder="https://… (paste PDF link)" style="flex:1;" />
              <label class="btn-secondary btn-sm" style="cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:4px;padding:0 10px;">
                <Upload :size="12" /> {{ uploading.ei ? '…' : 'Upload' }}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none;" :disabled="uploading.ei" @change="e => uploadDoc(e, 'ei')" />
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- PWD License -->
      <div class="glass" style="padding:16px;border-radius:12px;margin-bottom:14px;border-color:rgba(16,185,129,0.2);">
        <div style="font-size:12px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;">
          <FileCheck :size="13" style="display:inline;margin-right:5px;vertical-align:-2px;" /> PWD / Lift License
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label class="label">License Number</label>
            <input v-model="form.pwdLicenseNumber" class="input" placeholder="PWD-XXXX" />
          </div>
          <div class="form-group">
            <label class="label">Issue Date</label>
            <input v-model="form.pwdIssueDate" class="input" type="date" />
          </div>
          <div class="form-group">
            <label class="label">Expiry Date *</label>
            <input v-model="form.pwdExpiryDate" class="input" type="date" />
          </div>
          <div class="form-group">
            <label class="label">Document</label>
            <div style="display:flex;gap:6px;">
              <input v-model="form.pwdDocUrl" class="input" placeholder="https://… (paste PDF link)" style="flex:1;" />
              <label class="btn-secondary btn-sm" style="cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:4px;padding:0 10px;">
                <Upload :size="12" /> {{ uploading.pwd ? '…' : 'Upload' }}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none;" :disabled="uploading.pwd" @change="e => uploadDoc(e, 'pwd')" />
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Insurance -->
      <div class="glass" style="padding:16px;border-radius:12px;margin-bottom:14px;border-color:rgba(251,191,36,0.2);">
        <div style="font-size:12px;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;">
          <FileCheck :size="13" style="display:inline;margin-right:5px;vertical-align:-2px;" /> Insurance Policy
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label class="label">Insurer Name</label>
            <input v-model="form.insurerName" class="input" placeholder="Insurance company" />
          </div>
          <div class="form-group">
            <label class="label">Policy Number</label>
            <input v-model="form.policyNumber" class="input" placeholder="Policy number" />
          </div>
          <div class="form-group">
            <label class="label">Expiry Date *</label>
            <input v-model="form.insuranceExpiryDate" class="input" type="date" />
          </div>
          <div class="form-group">
            <label class="label">Document</label>
            <div style="display:flex;gap:6px;">
              <input v-model="form.insuranceDocUrl" class="input" placeholder="https://… (paste PDF link)" style="flex:1;" />
              <label class="btn-secondary btn-sm" style="cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:4px;padding:0 10px;">
                <Upload :size="12" /> {{ uploading.insurance ? '…' : 'Upload' }}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none;" :disabled="uploading.insurance" @change="e => uploadDoc(e, 'insurance')" />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div class="form-group form-full">
        <label class="label">Notes</label>
        <textarea v-model="form.notes" class="input" rows="2" placeholder="Any remarks…"></textarea>
      </div>

      <template #footer>
        <button class="btn-secondary" @click="showModal = false">Cancel</button>
        <button class="btn-primary" :disabled="saving" @click="save">
          <Save :size="14" /> {{ saving ? 'Saving…' : (editing ? 'Update' : 'Save Record') }}
        </button>
      </template>
    </AppModal>

    <!-- View Modal -->
    <AppModal v-model="showViewModal" :title="viewTarget ? (viewTarget.clientName || 'Record') : ''" width="640px">
      <template v-if="viewTarget">
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="padding:14px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:12px;">
            <div style="font-size:10px;color:var(--ct-accent);font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">
              {{ getProjectName(viewTarget.projectId) || viewTarget.projectName || '—' }}
            </div>
            <div style="font-size:16px;font-weight:700;color:var(--ct-primary);">{{ viewTarget.clientName }}</div>
            <div style="font-size:12px;color:var(--ct-muted);margin-top:3px;">
              Lift {{ viewTarget.liftNumber || '—' }}<span v-if="viewTarget.liftSerial"> · Serial: {{ viewTarget.liftSerial }}</span>
            </div>
          </div>

          <CertDetail label="EI Certificate" color="#818cf8"
            :number="viewTarget.eiCertNumber" :issue="viewTarget.eiIssueDate"
            :expiry="viewTarget.eiExpiryDate" :doc-url="viewTarget.eiDocUrl" />
          <CertDetail label="PWD License" color="#10b981"
            :number="viewTarget.pwdLicenseNumber" :issue="viewTarget.pwdIssueDate"
            :expiry="viewTarget.pwdExpiryDate" :doc-url="viewTarget.pwdDocUrl" />
          <CertDetail label="Insurance" color="#fbbf24"
            :number="viewTarget.policyNumber" :issue="null"
            :expiry="viewTarget.insuranceExpiryDate" :doc-url="viewTarget.insuranceDocUrl"
            :extra="viewTarget.insurerName ? ('Insurer: ' + viewTarget.insurerName) : ''" />

          <div v-if="viewTarget.notes" class="glass" style="padding:12px 14px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Notes</div>
            <div style="font-size:13px;color:var(--ct-sub);">{{ viewTarget.notes }}</div>
          </div>
        </div>
      </template>
      <template #footer>
        <button class="btn-secondary" @click="showViewModal = false">Close</button>
        <a v-if="viewTarget?.eiDocUrl" :href="viewTarget.eiDocUrl" target="_blank" class="btn-secondary" style="display:flex;align-items:center;gap:5px;text-decoration:none;">
          <Download :size="13" /> EI PDF
        </a>
        <a v-if="viewTarget?.pwdDocUrl" :href="viewTarget.pwdDocUrl" target="_blank" class="btn-secondary" style="display:flex;align-items:center;gap:5px;text-decoration:none;">
          <Download :size="13" /> PWD PDF
        </a>
        <a v-if="viewTarget?.insuranceDocUrl" :href="viewTarget.insuranceDocUrl" target="_blank" class="btn-secondary" style="display:flex;align-items:center;gap:5px;text-decoration:none;">
          <Download :size="13" /> Ins. PDF
        </a>
        <button v-if="isAdmin" class="btn-primary" @click="showViewModal = false; openEdit(viewTarget)">
          <Pencil :size="13" /> Edit
        </button>
      </template>
    </AppModal>

    <ConfirmDialog ref="confirmRef" title="Delete Record" @confirm="doDelete" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ShieldCheck, Plus, Search, Pencil, Trash2, Save, FileCheck, Upload, Download, ExternalLink } from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import LiftSelector from '@/components/ui/LiftSelector.vue'
import { useCollection } from '@/composables/useCollection'
import { useUIStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { Collections } from '@/firebase/collections'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '@/firebase/config'

const route = useRoute()
const router = useRouter()

const ui = useUIStore()
const authStore = useAuthStore()
const isAdmin = computed(() => authStore.role === 'admin')

const { items, loading, add, edit, del } = useCollection(Collections.LIFT_CERTIFICATES)
const { items: allProjects } = useCollection(Collections.PROJECTS)

// ── Status helpers ────────────────────────────────────────────────────────────
const TODAY = () => { const d = new Date(); d.setHours(0,0,0,0); return d }
const SOON  = () => { const d = TODAY(); d.setDate(d.getDate() + 30); return d }

function certStatus(dateStr) {
  if (!dateStr) return 'missing'
  const d = new Date(dateStr)
  if (d < TODAY()) return 'expired'
  if (d <= SOON())  return 'expiring'
  return 'valid'
}

function overallStatus(rec) {
  const statuses = [certStatus(rec.eiExpiryDate), certStatus(rec.pwdExpiryDate), certStatus(rec.insuranceExpiryDate)]
  if (statuses.includes('expired'))  return 'expired'
  if (statuses.includes('expiring')) return 'expiring'
  if (statuses.includes('missing'))  return 'missing'
  return 'valid'
}

function overallBadge(rec) {
  return { expired: 'badge-danger', expiring: 'badge-warning', missing: 'badge-inactive', valid: 'badge-active' }[overallStatus(rec)] || 'badge-inactive'
}
function overallLabel(rec) {
  return { expired: 'Expired', expiring: 'Expiring Soon', missing: 'Incomplete', valid: 'Valid' }[overallStatus(rec)] || '—'
}
function overallBorderStyle(rec) {
  const s = overallStatus(rec)
  if (s === 'expired')  return 'border-color:rgba(248,113,113,0.35);'
  if (s === 'expiring') return 'border-color:rgba(251,191,36,0.35);'
  if (s === 'missing')  return 'border-color:rgba(148,163,184,0.2);'
  return 'border-color:rgba(74,222,128,0.2);'
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr) - TODAY()
  return Math.ceil(diff / 86400000)
}

function formatDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt)) return d
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
}

// ── Project helpers ───────────────────────────────────────────────────────────
function getProjectName(id) {
  return allProjects.value.find(p => p.id === id)?.projectName || ''
}

const selectedProject = computed(() => allProjects.value.find(p => p.id === form.value.projectId) || null)

// ── Stats ─────────────────────────────────────────────────────────────────────
const validCount    = computed(() => items.value.filter(r => overallStatus(r) === 'valid').length)
const expiringCount = computed(() => items.value.filter(r => overallStatus(r) === 'expiring').length)
const expiredCount  = computed(() => items.value.filter(r => overallStatus(r) === 'expired').length)

// ── Filters ───────────────────────────────────────────────────────────────────
const search        = ref('')
const statusTab     = ref('')
const projectFilter = ref('')

const filtered = computed(() => {
  let list = items.value
  if (statusTab.value) list = list.filter(r => overallStatus(r) === statusTab.value)
  if (projectFilter.value) list = list.filter(r => r.projectId === projectFilter.value)
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(r =>
      (r.clientName || '').toLowerCase().includes(q) ||
      (r.liftNumber || '').toLowerCase().includes(q) ||
      (r.liftSerial || '').toLowerCase().includes(q) ||
      (r.eiCertNumber || '').toLowerCase().includes(q) ||
      (r.pwdLicenseNumber || '').toLowerCase().includes(q) ||
      (r.policyNumber || '').toLowerCase().includes(q) ||
      (getProjectName(r.projectId) || r.projectName || '').toLowerCase().includes(q)
    )
  }
  return list.sort((a, b) => {
    const order = { expired: 0, expiring: 1, missing: 2, valid: 3 }
    return (order[overallStatus(a)] ?? 4) - (order[overallStatus(b)] ?? 4)
  })
})

// ── Form ──────────────────────────────────────────────────────────────────────
const showModal = ref(false)
const showViewModal = ref(false)
const viewTarget = ref(null)
const editing = ref(null)
const saving = ref(false)
const confirmRef = ref(null)
const deleteTarget = ref(null)

const projectSearch = ref('')
const showProjectDd = ref(false)
const filteredProjectOptions = computed(() => {
  const q = projectSearch.value.toLowerCase()
  return allProjects.value.filter(p =>
    (p.projectName || '').toLowerCase().includes(q) ||
    (p.clientName || '').toLowerCase().includes(q)
  )
})
function selectProject(p) {
  form.value.projectId   = p.id
  form.value.projectName = p.projectName || ''
  form.value.clientName  = form.value.clientName || p.clientName || ''
  projectSearch.value    = p.projectName
  showProjectDd.value    = false
}
function delayClose() { setTimeout(() => { showProjectDd.value = false }, 200) }

const emptyForm = () => ({
  projectId: '', projectName: '', clientName: '', liftNumber: '', liftSerial: '',
  liftSelection: { buildingIndexes: [], wingKeys: [], liftIds: [], buildings: [], wings: [] },
  eiCertNumber: '', eiIssueDate: '', eiExpiryDate: '', eiDocUrl: '',
  pwdLicenseNumber: '', pwdIssueDate: '', pwdExpiryDate: '', pwdDocUrl: '',
  insurerName: '', policyNumber: '', insuranceExpiryDate: '', insuranceDocUrl: '',
  notes: '',
})

function onLiftSelectionChange(sel) {
  form.value.liftSelection = sel
  // Always sync liftNumber from lift directory selection
  if (sel.liftIds.length >= 1) {
    form.value.liftNumber = sel.liftIds[0]
  }
}

// ── Document upload ───────────────────────────────────────────────────────────
const uploading = ref({ ei: false, pwd: false, insurance: false })

async function uploadDoc(event, certKey) {
  const file = event.target.files?.[0]
  if (!file) return
  uploading.value[certKey] = true
  try {
    const ext = file.name.split('.').pop()
    const pid = form.value.projectId || 'unknown'
    const lid = (form.value.liftNumber || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_')
    const path = `lift-certificates/${pid}/${lid}/${certKey}-${Date.now()}.${ext}`
    const sRef = storageRef(storage, path)
    await uploadBytes(sRef, file)
    const url = await getDownloadURL(sRef)
    if (certKey === 'ei') form.value.eiDocUrl = url
    else if (certKey === 'pwd') form.value.pwdDocUrl = url
    else form.value.insuranceDocUrl = url
    ui.success('Document uploaded successfully.')
  } catch { ui.error('Upload failed. Check Firebase Storage rules.') }
  finally {
    uploading.value[certKey] = false
    event.target.value = ''
  }
}
const form = ref(emptyForm())

function openAdd() {
  editing.value      = null
  form.value         = emptyForm()
  projectSearch.value = ''
  showModal.value    = true
}
function openEdit(rec) {
  editing.value       = rec
  form.value          = { ...emptyForm(), ...rec }
  projectSearch.value = rec.projectName || getProjectName(rec.projectId) || ''
  showModal.value     = true
}
function openView(rec) { viewTarget.value = rec; showViewModal.value = true }

// ── Deep link: auto-open cert modal from /licenses?liftId=X&projectId=Y ──────
watch([() => route.query.liftId, () => route.query.projectId, () => items.value.length], () => {
  const qLid = route.query.liftId
  const qPid = route.query.projectId
  if (!qLid || !items.value.length) return
  const found = items.value.find(c =>
    (c.liftNumber === qLid || (c.liftSelection?.liftIds || []).includes(qLid)) &&
    (!qPid || !c.projectId || c.projectId === qPid)
  )
  if (found) {
    openView(found)
    // Clear query params without reload
    router.replace({ path: '/licenses' })
  }
}, { immediate: true })

async function save() {
  if (!form.value.clientName) { ui.error('Client name is required.'); return }
  saving.value = true
  try {
    const data = { ...form.value, updatedAt: new Date() }
    if (editing.value) {
      await edit(editing.value.id, data, { action: 'updated', module: 'liftCertificates', tab: 'Licenses', summary: `Updated certificates for ${data.clientName} Lift ${data.liftNumber}`, details: { clientName: data.clientName } })
      ui.success('Record updated.')
    } else {
      data.createdAt = new Date()
      await add(data, { action: 'created', module: 'liftCertificates', tab: 'Licenses', summary: `Added certificate record for ${data.clientName} Lift ${data.liftNumber}`, details: { clientName: data.clientName } })
      ui.success('Record saved.')
    }
    showModal.value = false
  } catch { ui.error('Failed to save.') }
  finally { saving.value = false }
}

function confirmDel(rec) { deleteTarget.value = rec; confirmRef.value?.open(`Delete certificate record for ${rec.clientName} Lift ${rec.liftNumber || '—'}?`) }
async function doDelete() {
  try { await del(deleteTarget.value.id, { action: 'deleted', module: 'liftCertificates', tab: 'Licenses', summary: 'Deleted certificate record', details: { clientName: deleteTarget.value.clientName } }); ui.success('Record deleted.') }
  catch { ui.error('Failed to delete.') }
}

// ── Sub-components ────────────────────────────────────────────────────────────
// CertRow — compact single-line cert status shown on the card
const CertRow = {
  props: ['label', 'number', 'expiry', 'docUrl'],
  setup(props) {
    const status = computed(() => {
      if (!props.expiry) return 'missing'
      const today = new Date(); today.setHours(0,0,0,0)
      const d = new Date(props.expiry)
      if (d < today) return 'expired'
      const soon = new Date(today); soon.setDate(soon.getDate() + 30)
      if (d <= soon) return 'expiring'
      return 'valid'
    })
    const color = computed(() => ({ expired: '#f87171', expiring: '#fbbf24', missing: '#94a3b8', valid: '#4ade80' })[status.value])
    const icon  = computed(() => ({ expired: '✗', expiring: '⚠', missing: '—', valid: '✓' })[status.value])
    const days  = computed(() => {
      if (!props.expiry) return null
      return Math.ceil((new Date(props.expiry) - new Date().setHours(0,0,0,0)) / 86400000)
    })
    function fmt(d) {
      if (!d) return '—'
      const dt = new Date(d)
      return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
    }
    return { status, color, icon, days, fmt }
  },
  template: `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:rgba(255,255,255,0.03);border-radius:6px;font-size:11px;">
      <span style="color:var(--ct-muted);min-width:100px;">{{ label }}</span>
      <span :style="'color:' + color + ';font-weight:600;min-width:14px;text-align:center;'">{{ icon }}</span>
      <span v-if="expiry" :style="'color:' + color + ';'">
        {{ fmt(expiry) }}
        <span v-if="status === 'expiring' && days !== null" style="font-size:10px;opacity:.8;"> ({{ days }}d)</span>
        <span v-if="status === 'expired'" style="font-size:10px;opacity:.8;"> ({{ Math.abs(days) }}d ago)</span>
      </span>
      <span v-else style="color:var(--ct-muted);">Not set</span>
      <a v-if="docUrl" :href="docUrl" target="_blank" @click.stop style="color:var(--ct-accent);font-size:10px;text-decoration:underline;margin-left:6px;">PDF</a>
    </div>
  `,
}

// CertDetail — expanded view inside the view modal
const CertDetail = {
  props: ['label', 'color', 'number', 'issue', 'expiry', 'docUrl', 'extra'],
  setup(props) {
    const status = computed(() => {
      if (!props.expiry) return 'missing'
      const today = new Date(); today.setHours(0,0,0,0)
      const d = new Date(props.expiry)
      if (d < today) return 'expired'
      const soon = new Date(today); soon.setDate(soon.getDate() + 30)
      if (d <= soon) return 'expiring'
      return 'valid'
    })
    const badge = computed(() => ({ expired: 'badge-danger', expiring: 'badge-warning', missing: 'badge-inactive', valid: 'badge-active' })[status.value])
    const badgeLabel = computed(() => ({ expired: 'Expired', expiring: 'Expiring Soon', missing: 'Not Set', valid: 'Valid' })[status.value])
    const days = computed(() => {
      if (!props.expiry) return null
      return Math.ceil((new Date(props.expiry) - new Date().setHours(0,0,0,0)) / 86400000)
    })
    function fmt(d) {
      if (!d) return '—'
      const dt = new Date(d)
      return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
    }
    return { status, badge, badgeLabel, days, fmt }
  },
  template: `
    <div class="glass" style="padding:12px 14px;border-radius:10px;" :style="'border-color:' + color + '22;'">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div :style="'font-size:11px;font-weight:700;color:' + color + ';text-transform:uppercase;letter-spacing:.05em;'">{{ label }}</div>
        <span :class="['badge', badge]">{{ badgeLabel }}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
        <div v-if="number">
          <div style="font-size:10px;color:var(--ct-muted);margin-bottom:2px;">Number</div>
          <div style="color:var(--ct-primary);font-weight:500;">{{ number }}</div>
        </div>
        <div v-if="issue">
          <div style="font-size:10px;color:var(--ct-muted);margin-bottom:2px;">Issued</div>
          <div style="color:var(--ct-sub);">{{ fmt(issue) }}</div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--ct-muted);margin-bottom:2px;">Expires</div>
          <div :style="status === 'expired' ? 'color:#f87171;font-weight:600;' : status === 'expiring' ? 'color:#fbbf24;font-weight:600;' : 'color:var(--ct-sub);'">
            {{ fmt(expiry) }}
            <span v-if="status === 'expiring' && days !== null" style="font-size:10px;opacity:.8;"> ({{ days }} days left)</span>
            <span v-if="status === 'expired' && days !== null" style="font-size:10px;"> ({{ Math.abs(days) }} days ago)</span>
          </div>
        </div>
        <div v-if="extra">
          <div style="font-size:10px;color:var(--ct-muted);margin-bottom:2px;">Details</div>
          <div style="color:var(--ct-sub);">{{ extra }}</div>
        </div>
      </div>
      <a v-if="docUrl" :href="docUrl" target="_blank"
        style="display:inline-flex;align-items:center;gap:4px;margin-top:8px;font-size:11px;color:var(--ct-accent);text-decoration:underline;">
        View Document PDF ↗
      </a>
      <div v-else style="margin-top:8px;font-size:11px;color:var(--ct-muted);">No document uploaded</div>
    </div>
  `,
}
</script>

<style scoped>
.proj-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #1e293b;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  z-index: 200;
  max-height: 220px;
  overflow-y: auto;
  margin-top: 4px;
  box-shadow: 0 8px 24px rgba(0,0,0,.35);
}
.proj-dropdown-item {
  padding: 10px 14px;
  cursor: pointer;
  font-size: 13px;
  color: #f1f5f9;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.proj-dropdown-item:last-child { border-bottom: none; }
.proj-dropdown-item:hover { background: rgba(99,102,241,0.15); }

[data-theme="light"] .proj-dropdown {
  background: #ffffff;
  border-color: rgba(0,0,0,0.12);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}
[data-theme="light"] .proj-dropdown-item {
  color: #1e293b;
  border-bottom-color: rgba(0,0,0,0.06);
}
[data-theme="light"] .proj-dropdown-item:hover { background: rgba(99,102,241,0.08); }
</style>
