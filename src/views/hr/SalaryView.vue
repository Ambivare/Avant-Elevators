<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">Salary</h1>
        <p class="page-sub">Fair pay, processed right, every cycle.</p>
      </div>
    </div>

    <!-- Tab bar -->
    <div class="tab-bar">
      <button v-for="t in tabs" :key="t.key"
        class="tab-btn" :class="{ active: activeTab === t.key }"
        @click="activeTab = t.key">
        <component :is="t.icon" :size="14" />{{ t.label }}
      </button>
    </div>

    <!-- ═══════════════════ SALARY SETUP ═══════════════════ -->
    <template v-if="activeTab === 'setup'">
      <div class="glass section">
        <div class="section-header">
          <div>
            <h3 class="section-title">Salary Configuration</h3>
            <p class="section-sub">Set monthly salary and overtime rules per employee</p>
          </div>
          <button class="btn-primary btn-sm" @click="saveAllConfigs" :disabled="saving">
            <Save :size="13" />{{ saving ? 'Saving…' : 'Save All' }}
          </button>
        </div>

        <div v-if="employees.length === 0" class="empty-state">
          <Users :size="28" style="opacity:.3;" />
          <p>No employees found.</p>
        </div>

        <div v-else class="setup-table-wrap">
          <table class="setup-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Monthly Salary (₹)</th>
                <th>Working Days</th>
                <th>Hours / Day</th>
                <th>OT Multiplier</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="emp in employees" :key="emp.id">
                <td>
                  <div class="emp-name">{{ emp.fullName || emp.name || emp.username }}</div>
                  <div class="emp-role">{{ emp.empId || emp.employeeId || '' }} {{ emp.designation || emp.role || '' }}</div>
                </td>
                <td>
                  <input type="number" class="input input-sm cell-input"
                    v-model.number="configMap[emp.id].monthlySalary"
                    placeholder="0" min="0" />
                </td>
                <td>
                  <input type="number" class="input input-sm cell-input"
                    v-model.number="configMap[emp.id].workingDaysPerMonth"
                    placeholder="26" min="1" max="31" />
                </td>
                <td>
                  <input type="number" class="input input-sm cell-input"
                    v-model.number="configMap[emp.id].workingHoursPerDay"
                    placeholder="8" min="1" max="24" />
                </td>
                <td>
                  <input type="number" class="input input-sm cell-input"
                    v-model.number="configMap[emp.id].overtimeMultiplier"
                    placeholder="1.5" min="1" max="5" step="0.1" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- ═══════════════════ MONTHLY REPORT ═══════════════════ -->
    <template v-if="activeTab === 'report'">
      <div class="glass section">
        <div class="section-header">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <input type="month" class="input input-sm" v-model="reportMonth" />
            <button class="btn-secondary btn-sm" @click="loadReport" :disabled="loadingReport">
              <RefreshCw :size="13" :class="{ spin: loadingReport }" />
              {{ loadingReport ? 'Loading…' : 'Load Report' }}
            </button>
            <span style="font-size:11px;color:var(--ct-muted);padding:4px 10px;background:rgba(99,102,241,0.08);border-radius:6px;border:1px solid rgba(99,102,241,0.15);">
              Period: {{ calcPeriodLabel }}
            </span>
          </div>
          <button class="btn-primary btn-sm" @click="generateAllSlips"
            :disabled="generatingSlips || reportRows.length === 0">
            <FileText :size="13" />{{ generatingSlips ? 'Generating…' : 'Generate All Slips' }}
          </button>
        </div>

        <div v-if="!loadingReport && reportRows.length === 0" class="empty-state">
          <IndianRupee :size="28" style="opacity:.3;" />
          <p>Select a month and click Load Report.</p>
          <span>Salary configs must be set up first.</span>
        </div>

        <div v-if="loadingReport" style="display:flex;justify-content:center;padding:48px;">
          <Loader2 :size="24" class="spin" style="color:#6366f1;" />
        </div>

        <div v-if="!loadingReport && reportRows.length > 0">
          <!-- Summary chips -->
          <div class="report-summary-row">
            <div class="rs-chip">
              <div class="rs-val">{{ reportRows.length }}</div>
              <div class="rs-lbl">Employees</div>
            </div>
            <div class="rs-chip">
              <div class="rs-val">₹{{ fmtNum(reportTotals.basicEarned) }}</div>
              <div class="rs-lbl">Total Basic</div>
            </div>
            <div class="rs-chip rs-chip-ot">
              <div class="rs-val">₹{{ fmtNum(reportTotals.overtimePay) }}</div>
              <div class="rs-lbl">Total OT Pay</div>
            </div>
            <div class="rs-chip rs-chip-net">
              <div class="rs-val">₹{{ fmtNum(reportTotals.netSalary) }}</div>
              <div class="rs-lbl">Total Payout</div>
            </div>
          </div>

          <div class="report-table-wrap">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Daily Rate</th>
                  <th>Basic Earned</th>
                  <th>OT Hours</th>
                  <th>OT Pay</th>
                  <th>Net Salary</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in reportRows" :key="row.employeeId">
                  <td>
                    <div class="emp-name">{{ row.employeeName }}</div>
                  </td>
                  <td class="td-present">{{ row.presentDays }}</td>
                  <td class="td-absent">{{ row.absentDays }}</td>
                  <td>₹{{ fmtNum(row.dailyRate) }}</td>
                  <td class="td-basic">₹{{ fmtNum(row.basicEarned) }}</td>
                  <td class="td-ot">{{ row.overtimeHours }}h</td>
                  <td class="td-ot">₹{{ fmtNum(row.overtimePay) }}</td>
                  <td class="td-net"><strong>₹{{ fmtNum(row.netSalary) }}</strong></td>
                  <td>
                    <button class="btn-secondary btn-xs" @click="generateSlip(row)" :disabled="generatingSlips">
                      <Download :size="11" /> Slip
                    </button>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4"><strong>Total</strong></td>
                  <td class="td-basic"><strong>₹{{ fmtNum(reportTotals.basicEarned) }}</strong></td>
                  <td class="td-ot"><strong>{{ reportTotals.overtimeHours }}h</strong></td>
                  <td class="td-ot"><strong>₹{{ fmtNum(reportTotals.overtimePay) }}</strong></td>
                  <td class="td-net"><strong>₹{{ fmtNum(reportTotals.netSalary) }}</strong></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </template>

    <!-- ═══════════════════ SALARY SLIPS ═══════════════════ -->
    <template v-if="activeTab === 'slips'">
      <div class="glass section">
        <div class="section-header">
          <h3 class="section-title">Salary Slips</h3>
          <input type="month" class="input input-sm" v-model="slipsFilterMonth" />
        </div>

        <div v-if="filteredSlips.length === 0" class="empty-state">
          <FileText :size="28" style="opacity:.3;" />
          <p>No salary slips found{{ slipsFilterMonth ? ' for ' + monthLabel(slipsFilterMonth) : '' }}.</p>
          <span>Generate slips from the Monthly Report tab.</span>
        </div>

        <div class="slips-list">
          <div v-for="slip in filteredSlips" :key="slip.id" class="slip-card glass-inner">
            <div class="slip-avatar">{{ initials(slip.employeeName) }}</div>
            <div class="slip-info">
              <div class="slip-name">{{ slip.employeeName }}</div>
              <div class="slip-meta">
                {{ monthLabel(slip.month) }} &middot;
                {{ slip.presentDays }}d present &middot;
                <span class="slip-net">₹{{ fmtNum(slip.netSalary) }}</span>
              </div>
            </div>
            <div class="slip-actions">
              <button class="btn-secondary btn-xs" @click="downloadSlipPdf(slip)">
                <Download :size="11" /> PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ═══════════════════ DATE CONFIG ═══════════════════ -->
    <template v-if="activeTab === 'date-config'">
      <div class="glass section">
        <div class="section-header">
          <div>
            <h3 class="section-title">Salary Date Configuration</h3>
            <p class="section-sub">Define the salary calculation period and slip generation date</p>
          </div>
          <div v-if="dateConfig.locked" style="display:flex;align-items:center;gap:8px;">
            <span style="display:flex;align-items:center;gap:5px;font-size:12px;color:#fbbf24;background:rgba(251,191,36,0.1);padding:5px 10px;border-radius:8px;border:1px solid rgba(251,191,36,0.2);">
              <Lock :size="13" /> Locked
            </span>
            <button class="btn-secondary btn-sm" @click="showUnlockModal = true">
              <Unlock :size="13" /> Change Config
            </button>
          </div>
        </div>

        <!-- Active config summary chip (when locked) -->
        <div v-if="dateConfig.locked" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:24px;">
          <div class="glass-inner" style="padding:16px;border-radius:12px;text-align:center;">
            <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Calculation Period</div>
            <div style="font-size:18px;font-weight:700;color:var(--ct-primary);">
              {{ dateConfig.calcStartDay }}{{ ordinal(dateConfig.calcStartDay) }}
              <span style="font-size:13px;color:var(--ct-muted);"> to </span>
              {{ dateConfig.calcEndDay === 0 ? 'Month End' : dateConfig.calcEndDay + ordinal(dateConfig.calcEndDay) }}
            </div>
            <div style="font-size:11px;color:var(--ct-muted);margin-top:4px;">of each month</div>
          </div>
          <div class="glass-inner" style="padding:16px;border-radius:12px;text-align:center;">
            <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Slip Generation</div>
            <div style="font-size:18px;font-weight:700;color:var(--ct-accent);">
              {{ dateConfig.generationDay }}{{ ordinal(dateConfig.generationDay) }}
            </div>
            <div style="font-size:11px;color:var(--ct-muted);margin-top:4px;">of every month</div>
          </div>
          <div class="glass-inner" style="padding:16px;border-radius:12px;text-align:center;">
            <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Last Updated</div>
            <div style="font-size:13px;font-weight:600;color:var(--ct-sub);">{{ dateConfig.lockedBy || '—' }}</div>
            <div style="font-size:11px;color:var(--ct-muted);margin-top:4px;">{{ dateConfig.lockedAt ? fmtTs(dateConfig.lockedAt) : '—' }}</div>
          </div>
        </div>

        <!-- Edit form (when unlocked) -->
        <div v-else class="form-grid" style="max-width:600px;">
          <div class="form-group">
            <label class="label">Calculation Start Day <span style="color:var(--ct-muted);font-size:11px;">(day of month)</span></label>
            <input v-model.number="dcForm.calcStartDay" type="number" class="input" min="1" max="28" placeholder="1" />
            <div style="font-size:11px;color:var(--ct-muted);margin-top:4px;">Attendance counting starts from this day each month.</div>
          </div>
          <div class="form-group">
            <label class="label">Calculation End Day <span style="color:var(--ct-muted);font-size:11px;">(0 = last day of month)</span></label>
            <input v-model.number="dcForm.calcEndDay" type="number" class="input" min="0" max="31" placeholder="0" />
            <div style="font-size:11px;color:var(--ct-muted);margin-top:4px;">0 means the last day of the calendar month.</div>
          </div>
          <div class="form-group form-full">
            <label class="label">Salary Slip Generation Day <span style="color:var(--ct-muted);font-size:11px;">(day of following month)</span></label>
            <input v-model.number="dcForm.generationDay" type="number" class="input" min="1" max="28" placeholder="10" />
            <div style="font-size:11px;color:var(--ct-muted);margin-top:4px;">Slips should be generated and distributed on this day each month (for reference only — does not auto-generate).</div>
          </div>

          <!-- Period preview -->
          <div class="form-group form-full">
            <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.18);border-radius:10px;padding:14px 16px;">
              <div style="font-size:11px;font-weight:600;color:var(--ct-accent);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Preview</div>
              <div style="font-size:13px;color:var(--ct-primary);">
                Salary for <strong>June 2026</strong> will be calculated from
                <strong>{{ dcForm.calcStartDay }} Jun</strong> to
                <strong>{{ dcForm.calcEndDay === 0 ? '30 Jun (last day)' : dcForm.calcEndDay + ' Jun' }}</strong>.
              </div>
              <div style="font-size:12px;color:var(--ct-muted);margin-top:6px;">
                Slips to be generated on <strong>{{ dcForm.generationDay }} Jul</strong>.
              </div>
            </div>
          </div>

          <div class="form-group form-full" style="margin-top:4px;">
            <div style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.2);border-radius:10px;">
              <AlertTriangle :size="16" style="color:#fbbf24;flex-shrink:0;margin-top:1px;" />
              <div style="font-size:12px;color:var(--ct-sub);">
                Once saved, this configuration is <strong>locked</strong>. Changing it later will require your admin password.
                Make sure the dates are correct before saving.
              </div>
            </div>
          </div>

          <div class="form-group form-full">
            <button class="btn-primary" :disabled="dateConfigSaving" @click="saveDateConfig">
              <Lock :size="14" /> {{ dateConfigSaving ? 'Saving…' : 'Save & Lock Configuration' }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Unlock modal ── -->
    <AppModal v-model="showUnlockModal" title="Unlock Salary Date Config" width="420px">
      <div style="padding-bottom:8px;">
        <p style="font-size:13px;color:var(--ct-sub);margin-bottom:16px;">
          Enter your admin password to edit the salary date configuration.
        </p>
        <label class="label">Password</label>
        <input v-model="unlockPassword" type="password" class="input" placeholder="Enter admin password"
          @keydown.enter="verifyAndUnlock" />
        <div v-if="unlockError" style="color:#f87171;font-size:12px;margin-top:8px;">{{ unlockError }}</div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showUnlockModal = false; unlockPassword = ''; unlockError = ''">Cancel</button>
        <button class="btn-primary" :disabled="unlockChecking" @click="verifyAndUnlock">
          <Unlock :size="14" /> {{ unlockChecking ? 'Verifying…' : 'Unlock' }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import {
  IndianRupee, FileText, Settings2, Save, RefreshCw, Download, Loader2, Users,
  Calendar, Lock, Unlock, AlertTriangle,
} from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { useActivityStore } from '@/stores/activity'
import { getAll, subscribe } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { db } from '@/firebase/config'
import { doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore'

const auth     = useAuthStore()
const ui       = useUIStore()
const activity = useActivityStore()

const tabs = [
  { key: 'setup',       label: 'Salary Setup',   icon: Settings2 },
  { key: 'report',      label: 'Monthly Report', icon: FileText },
  { key: 'slips',       label: 'Salary Slips',   icon: IndianRupee },
  { key: 'date-config', label: 'Date Config',    icon: Calendar },
]
const activeTab = ref('setup')

// ── Date config ───────────────────────────────────────────────────────────────
const DATE_CONFIG_DOC = '__date_config__'
const dateConfig = reactive({
  calcStartDay:  1,
  calcEndDay:    0,
  generationDay: 10,
  locked:        false,
  lockedBy:      '',
  lockedAt:      null,
})
const dcForm = reactive({ calcStartDay: 1, calcEndDay: 0, generationDay: 10 })
const dateConfigSaving = ref(false)
const showUnlockModal  = ref(false)
const unlockPassword   = ref('')
const unlockError      = ref('')
const unlockChecking   = ref(false)

async function loadDateConfig() {
  try {
    const snap = await getDoc(doc(db, Collections.SALARY_CONFIG, DATE_CONFIG_DOC))
    if (snap.exists()) {
      const d = snap.data()
      Object.assign(dateConfig, d)
      dcForm.calcStartDay  = d.calcStartDay  ?? 1
      dcForm.calcEndDay    = d.calcEndDay    ?? 0
      dcForm.generationDay = d.generationDay ?? 10
    }
  } catch { /* use defaults */ }
}

async function saveDateConfig() {
  const s = Number(dcForm.calcStartDay) || 1
  const e = Number(dcForm.calcEndDay)
  const g = Number(dcForm.generationDay) || 10
  if (s < 1 || s > 28)         { ui.error('Start day must be between 1 and 28.'); return }
  if (e !== 0 && (e < 1 || e > 31)) { ui.error('End day must be 0 (month end) or 1–31.'); return }
  if (e !== 0 && e < s)        { ui.error('End day must be after start day.'); return }
  if (g < 1 || g > 28)         { ui.error('Generation day must be between 1 and 28.'); return }
  dateConfigSaving.value = true
  try {
    const payload = {
      calcStartDay:  s,
      calcEndDay:    e,
      generationDay: g,
      locked:   true,
      lockedBy: auth.user?.fullName || auth.user?.username || 'Admin',
      lockedAt: serverTimestamp(),
    }
    await setDoc(doc(db, Collections.SALARY_CONFIG, DATE_CONFIG_DOC), payload)
    Object.assign(dateConfig, { ...payload, lockedAt: new Date() })
    ui.success('Salary date configuration saved and locked.')
  } catch (err) {
    ui.error('Failed to save: ' + err.message)
  }
  dateConfigSaving.value = false
}

async function verifyAndUnlock() {
  unlockError.value   = ''
  unlockChecking.value = true
  try {
    const userId = auth.user?.id
    if (!userId) { unlockError.value = 'No logged-in user found.'; return }
    // Re-fetch employee to verify password (password is stripped from session)
    const empSnap = await getDocs(
      query(collection(db, Collections.EMPLOYEES), where('__name__', '==', userId))
    )
    let verified = false
    empSnap.forEach(d => {
      if (d.data().password === unlockPassword.value) verified = true
    })
    if (!verified) {
      // Also check users collection as fallback
      const userSnap = await getDocs(
        query(collection(db, Collections.USERS), where('__name__', '==', userId))
      )
      userSnap.forEach(d => {
        if (d.data().password === unlockPassword.value) verified = true
      })
    }
    if (!verified) { unlockError.value = 'Incorrect password.'; return }
    // Unlock
    await setDoc(doc(db, Collections.SALARY_CONFIG, DATE_CONFIG_DOC), { locked: false }, { merge: true })
    dateConfig.locked = false
    showUnlockModal.value  = false
    unlockPassword.value   = ''
    ui.success('Configuration unlocked. You can now edit the salary dates.')
  } catch (err) {
    unlockError.value = 'Verification failed: ' + (err.message || err)
  } finally {
    unlockChecking.value = false
  }
}

// ── Data ──────────────────────────────────────────────────────────────────────
const employees   = ref([])
const configMap   = reactive({})
const salarySlips = ref([])
const saving      = ref(false)

// ── Report state ──────────────────────────────────────────────────────────────
const now           = new Date()
const reportMonth   = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
const loadingReport = ref(false)
const generatingSlips = ref(false)
const reportRows    = ref([])

const slipsFilterMonth = ref(reportMonth.value)

const filteredSlips = computed(() => {
  const m = slipsFilterMonth.value
  const all = salarySlips.value.slice().sort((a, b) => (b.generatedAt?.seconds ?? 0) - (a.generatedAt?.seconds ?? 0))
  return m ? all.filter(s => s.month === m) : all
})

const reportTotals = computed(() => ({
  basicEarned:   reportRows.value.reduce((s, r) => s + r.basicEarned,   0),
  overtimeHours: Math.round(reportRows.value.reduce((s, r) => s + r.overtimeHours, 0) * 100) / 100,
  overtimePay:   reportRows.value.reduce((s, r) => s + r.overtimePay,   0),
  netSalary:     reportRows.value.reduce((s, r) => s + r.netSalary,     0),
}))

// ── Init config map for an employee (with defaults) ────────────────────────────
function initConfigMap(empId, existing = {}) {
  configMap[empId] = {
    monthlySalary:       existing.monthlySalary       ?? 0,
    workingDaysPerMonth: existing.workingDaysPerMonth  ?? 26,
    workingHoursPerDay:  existing.workingHoursPerDay   ?? 8,
    overtimeMultiplier:  existing.overtimeMultiplier   ?? 1.5,
  }
}

onMounted(async () => {
  const [empDocs] = await Promise.all([
    getAll(Collections.EMPLOYEES),
    loadDateConfig(),
  ])
  employees.value = empDocs
    .filter(e => (e.fullName || e.name || e.username) && e.status !== 'inactive')
    .sort((a, b) => (a.fullName || a.name || a.username).localeCompare(b.fullName || b.name || b.username))

  employees.value.forEach(emp => initConfigMap(emp.id, { monthlySalary: emp.salary || 0 }))

  const configs = await getAll(Collections.SALARY_CONFIG)
  configs.forEach(cfg => {
    if (cfg.id === DATE_CONFIG_DOC) return   // skip global config doc
    if (configMap[cfg.id]) Object.assign(configMap[cfg.id], cfg)
    else initConfigMap(cfg.id, cfg)
  })

  subscribe(Collections.SALARY_SLIPS, docs => { salarySlips.value = docs })
})

// ── Save all salary configs to Firestore ───────────────────────────────────────
async function saveAllConfigs() {
  saving.value = true
  try {
    for (const emp of employees.value) {
      const cfg = configMap[emp.id]
      if (!cfg || !Number(cfg.monthlySalary)) continue
      await setDoc(doc(db, Collections.SALARY_CONFIG, emp.id), {
        employeeId:          emp.id,
        employeeName:        emp.fullName || emp.name || emp.username,
        monthlySalary:       Number(cfg.monthlySalary)       || 0,
        workingDaysPerMonth: Number(cfg.workingDaysPerMonth)  || 26,
        workingHoursPerDay:  Number(cfg.workingHoursPerDay)   || 8,
        overtimeMultiplier:  Number(cfg.overtimeMultiplier)   || 1.5,
        updatedAt: serverTimestamp(),
      })
    }
    ui.success('Salary configs saved')
  } catch (e) {
    ui.error('Save failed: ' + e.message)
  }
  saving.value = false
}

// ── Load attendance records using the configured calculation period ─────────────
async function loadMonthAttendance(ym) {
  const [y, m] = ym.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const startDay = Number(dateConfig.calcStartDay) || 1
  const endDay   = Number(dateConfig.calcEndDay)  === 0
    ? daysInMonth
    : Math.min(Number(dateConfig.calcEndDay), daysInMonth)
  const pad = n => String(n).padStart(2, '0')
  const start = `${y}-${pad(m)}-${pad(startDay)}`
  const end   = `${y}-${pad(m)}-${pad(endDay)}`
  const snap = await getDocs(
    query(collection(db, 'attendance'), where('date', '>=', start), where('date', '<=', end))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ── Salary calculation for one employee ───────────────────────────────────────
function calcSalary(employeeId, allRecords, cfg) {
  const recs = allRecords.filter(r => r.employeeId === employeeId)
  const presentDays = recs.filter(r => r.checkInTime || r.status === 'present').length

  const workingDays  = Number(cfg.workingDaysPerMonth) || 26
  const hoursPerDay  = Number(cfg.workingHoursPerDay)  || 8
  const otMultiplier = Number(cfg.overtimeMultiplier)  || 1.5
  const salary       = Number(cfg.monthlySalary)       || 0

  const dailyRate   = salary / workingDays
  const basicEarned = dailyRate * presentDays

  let otHours = 0
  recs.forEach(r => {
    // Regular OT: time worked beyond duty hours from punch-in
    if (r.checkInTime && r.checkOutTime) {
      const ci = r.checkInTime?.toDate ? r.checkInTime.toDate() : new Date(r.checkInTime)
      const co = r.checkOutTime?.toDate ? r.checkOutTime.toDate() : new Date(r.checkOutTime)
      if (!isNaN(ci.getTime()) && !isNaN(co.getTime())) {
        const workedMins = (co - ci) / 60000
        const dutyMins   = hoursPerDay * 60
        if (workedMins > dutyMins) otHours += (workedMins - dutyMins) / 60
      }
    }
    // Dedicated overtime punch (re-punch after checkout)
    if (r.otHours) otHours += Number(r.otHours) || 0
  })

  const hourlyRate  = dailyRate / hoursPerDay
  const overtimePay = otHours * hourlyRate * otMultiplier

  return {
    presentDays,
    absentDays:    Math.max(0, workingDays - presentDays),
    dailyRate:     Math.round(dailyRate   * 100) / 100,
    basicEarned:   Math.round(basicEarned * 100) / 100,
    overtimeHours: Math.round(otHours     * 100) / 100,
    overtimePay:   Math.round(overtimePay * 100) / 100,
    netSalary:     Math.round((basicEarned + overtimePay) * 100) / 100,
  }
}

// ── Load monthly report ────────────────────────────────────────────────────────
async function loadReport() {
  loadingReport.value = true
  reportRows.value = []
  try {
    const attendance = await loadMonthAttendance(reportMonth.value)
    const rows = []
    for (const emp of employees.value) {
      const cfg = configMap[emp.id]
      if (!cfg || !Number(cfg.monthlySalary)) continue
      const calc = calcSalary(emp.id, attendance, cfg)
      rows.push({
        employeeId:          emp.id,
        employeeName:        emp.fullName || emp.name || emp.username,
        month:               reportMonth.value,
        monthlySalary:       Number(cfg.monthlySalary),
        workingDaysPerMonth: Number(cfg.workingDaysPerMonth) || 26,
        calcPeriod:          calcPeriodLabel.value,
        ...calc,
      })
    }
    reportRows.value = rows
    if (!rows.length) ui.info('No salary configs found — set them up in Salary Setup first.')
  } catch (e) {
    ui.error('Failed to load report: ' + e.message)
  }
  loadingReport.value = false
}

// ── Generate / save a salary slip ──────────────────────────────────────────────
async function generateSlip(row) {
  generatingSlips.value = true
  try {
    const slipId = `${row.employeeId}_${row.month}`
    await setDoc(doc(db, Collections.SALARY_SLIPS, slipId), {
      ...row,
      generatedAt: serverTimestamp(),
      generatedBy: auth.user?.fullName || auth.user?.username,
    })
    activity.log({ action: 'created', module: 'salarySlips', tab: 'HR', summary: `Generated salary slip for ${row.employeeName} (${row.month})`, details: { employeeName: row.employeeName, month: row.month, netSalary: row.netSalary, presentDays: row.presentDays } })
    ui.success(`Slip saved for ${row.employeeName}`)
  } catch (e) {
    ui.error('Failed to generate slip: ' + e.message)
  }
  generatingSlips.value = false
}

async function generateAllSlips() {
  generatingSlips.value = true
  for (const row of reportRows.value) {
    try {
      const slipId = `${row.employeeId}_${row.month}`
      await setDoc(doc(db, Collections.SALARY_SLIPS, slipId), {
        ...row,
        generatedAt: serverTimestamp(),
        generatedBy: auth.user?.fullName || auth.user?.username,
      })
    } catch { /* continue */ }
  }
  activity.log({ action: 'created', module: 'salarySlips', tab: 'HR', summary: `Generated ${reportRows.value.length} salary slips for ${reportMonth.value}`, details: { month: reportMonth.value, count: reportRows.value.length, totalNetSalary: reportRows.value.reduce((s, r) => s + r.netSalary, 0) } })
  ui.success(`Generated ${reportRows.value.length} salary slips`)
  generatingSlips.value = false
}

// ── PDF download ───────────────────────────────────────────────────────────────
async function downloadSlipPdf(slip) {
  const { jsPDF } = await import('jspdf')
  const autoTable  = (await import('jspdf-autotable')).default
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' })
  const W = pdf.internal.pageSize.getWidth()
  const mLabel = monthLabel(slip.month)

  // Header bar
  pdf.setFillColor(30, 41, 59)
  pdf.rect(0, 0, W, 30, 'F')
  pdf.setTextColor(241, 245, 249)
  pdf.setFontSize(15)
  pdf.setFont(undefined, 'bold')
  pdf.text('SALARY SLIP', W / 2, 13, { align: 'center' })
  pdf.setFontSize(9)
  pdf.setFont(undefined, 'normal')
  pdf.text(mLabel, W / 2, 22, { align: 'center' })

  // Employee info
  pdf.setTextColor(30, 41, 59)
  pdf.setFontSize(11)
  pdf.setFont(undefined, 'bold')
  pdf.text(slip.employeeName, 10, 41)
  pdf.setFont(undefined, 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(100, 116, 139)
  pdf.text(
    `Working Days: ${slip.workingDaysPerMonth || 26}  ·  Present: ${slip.presentDays}  ·  Absent: ${slip.absentDays}  ·  Period: ${slip.calcPeriod || calcPeriodLabel.value}`,
    10, 47,
  )
  pdf.setTextColor(30, 41, 59)

  // Earnings table
  autoTable(pdf, {
    startY: 54,
    head: [['Description', 'Details', 'Amount (₹)']],
    body: [
      ['Monthly CTC',   `${slip.workingDaysPerMonth || 26} working days`, `₹${fmtNum(slip.monthlySalary)}`],
      ['Basic Earned',  `${slip.presentDays} days present`,               `₹${fmtNum(slip.basicEarned)}`],
      ['Overtime Pay',  `${slip.overtimeHours}h × OT rate`,               `₹${fmtNum(slip.overtimePay)}`],
    ],
    foot: [['NET SALARY', '', `₹${fmtNum(slip.netSalary)}`]],
    styles:             { fontSize: 9,  cellPadding: 4 },
    headStyles:         { fillColor: [30, 41, 59], textColor: [241, 245, 249], fontStyle: 'bold' },
    footStyles:         { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 11 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles:       { 2: { halign: 'right' } },
  })

  const finalY = pdf.lastAutoTable?.finalY ?? 110
  pdf.setFontSize(8)
  pdf.setTextColor(148, 163, 184)
  pdf.text('This is a computer-generated salary slip.', W / 2, finalY + 12, { align: 'center' })

  pdf.save(`Salary_Slip_${(slip.employeeName || 'Employee').replace(/\s+/g, '_')}_${slip.month}.pdf`)
  ui.success('Slip downloaded')
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtNum(n) {
  if (n === null || n === undefined) return '0'
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function monthLabel(ym) {
  if (!ym) return ''
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

function fmtTs(ts) {
  if (!ts) return ''
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Computed label for the calculation period shown in the report tab
const calcPeriodLabel = computed(() => {
  const s = Number(dateConfig.calcStartDay) || 1
  const e = Number(dateConfig.calcEndDay)
  const end = e === 0 ? 'Month End' : `${e}${ordinal(e)}`
  return `${s}${ordinal(s)} – ${end}`
})
</script>

<style scoped>
.page-container { padding: 24px; max-width: 1400px; margin: 0 auto; }
.page-sub { font-size: 13px; color: var(--ct-muted); margin-top: 4px; }

/* ── Tab bar ─────────────────────────────────────────────────────────────── */
.tab-bar {
  display: flex; gap: 4px; margin-top: 20px;
  border-bottom: 1px solid rgba(255,255,255,0.07); padding-bottom: 0;
}
.tab-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 16px; font-size: 12px; font-weight: 500;
  border: none; background: transparent; color: var(--ct-muted);
  cursor: pointer; border-bottom: 2px solid transparent;
  border-radius: 6px 6px 0 0; transition: all 0.15s;
}
.tab-btn:hover { color: var(--ct-sub); }
.tab-btn.active { color: var(--ct-accent); border-bottom-color: #6366f1; background: rgba(99,102,241,0.06); }

/* ── Section card ────────────────────────────────────────────────────────── */
.section { margin-top: 16px; padding: 24px; border-radius: 16px; }
.section-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 12px; margin-bottom: 20px; flex-wrap: wrap;
}
.section-title { font-size: 15px; font-weight: 600; color: var(--ct-primary); }
.section-sub   { font-size: 12px; color: var(--ct-muted); margin-top: 4px; }

/* ── Setup table ─────────────────────────────────────────────────────────── */
.setup-table-wrap { overflow-x: auto; }
.setup-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.setup-table thead tr { background: rgba(255,255,255,0.04); }
.setup-table th {
  padding: 10px 14px; text-align: left;
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--ct-muted);
}
.setup-table td { padding: 10px 14px; border-top: 1px solid rgba(255,255,255,0.04); }
.setup-table tbody tr:hover { background: rgba(255,255,255,0.02); }

.cell-input { width: 100px; }

.emp-name { font-size: 13px; font-weight: 500; color: var(--ct-primary); }
.emp-role { font-size: 11px; color: var(--ct-muted); margin-top: 2px; text-transform: capitalize; }

/* ── Report summary chips ─────────────────────────────────────────────────── */
.report-summary-row {
  display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;
}
.rs-chip {
  flex: 1; min-width: 110px; padding: 14px 16px; border-radius: 12px; text-align: center;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
}
.rs-chip-ot  { border-color: rgba(245,158,11,0.2);  background: rgba(245,158,11,0.05);  }
.rs-chip-net { border-color: rgba(99,102,241,0.25); background: rgba(99,102,241,0.08); }
.rs-val { font-size: 18px; font-weight: 700; color: var(--ct-primary); }
.rs-chip-ot .rs-val  { color: #fbbf24; }
.rs-chip-net .rs-val { color: var(--ct-accent); }
.rs-lbl { font-size: 10px; color: var(--ct-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 4px; }

/* ── Report table ────────────────────────────────────────────────────────── */
.report-table-wrap { overflow-x: auto; }
.report-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.report-table thead tr { background: rgba(255,255,255,0.05); }
.report-table th {
  padding: 10px 12px; text-align: left;
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--ct-muted);
}
.report-table td { padding: 10px 12px; border-top: 1px solid rgba(255,255,255,0.04); color: var(--ct-sub); }
.report-table tbody tr:hover { background: rgba(255,255,255,0.02); }
.report-table tfoot tr { background: rgba(99,102,241,0.08); }
.report-table tfoot td { border-top: 1px solid rgba(99,102,241,0.2); color: var(--ct-primary); }

.td-present { color: #10b981 !important; font-weight: 600; }
.td-absent  { color: #f87171 !important; }
.td-basic   { color: var(--ct-accent) !important; font-weight: 600; }
.td-ot      { color: #fbbf24 !important; }
.td-net     { color: var(--ct-primary) !important; font-size: 13px !important; }

/* ── Slips list ──────────────────────────────────────────────────────────── */
.slips-list { display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }

.slip-card {
  display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 12px;
}
.glass-inner {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
}
.slip-avatar {
  width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
  background: linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.25));
  border: 1px solid rgba(99,102,241,0.2);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; color: var(--ct-accent);
}
.slip-info { flex: 1; min-width: 0; }
.slip-name { font-size: 13px; font-weight: 600; color: var(--ct-primary); }
.slip-meta { font-size: 11px; color: var(--ct-muted); margin-top: 3px; }
.slip-net  { color: var(--ct-accent); font-weight: 600; }
.slip-actions { flex-shrink: 0; }

/* ── Utilities ───────────────────────────────────────────────────────────── */
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 48px; color: var(--ct-muted); text-align: center;
}
.empty-state p    { font-size: 14px; color: var(--ct-muted); margin: 10px 0 4px; }
.empty-state span { font-size: 12px; }

.btn-xs {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 5px 10px; font-size: 11px; border-radius: 8px; font-weight: 500;
}

.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
</style>
