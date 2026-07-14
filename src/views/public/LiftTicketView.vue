<template>
  <div class="ticket-shell">
    <!-- Loading state -->
    <div v-if="loading" class="ticket-center">
      <div class="ticket-spinner"></div>
      <p style="color:#94a3b8;margin-top:16px;font-size:14px;">Loading lift info…</p>
    </div>

    <!-- Not found -->
    <div v-else-if="!lift && !loading" class="ticket-center">
      <div style="font-size:48px;margin-bottom:16px;">🔍</div>
      <h2 style="color:#f1f5f9;margin-bottom:8px;">Lift not found</h2>
      <p style="color:#94a3b8;font-size:14px;">This QR code may be outdated. Contact the building manager.</p>
    </div>

    <!-- Success state -->
    <div v-else-if="submitted" class="ticket-center">
      <div style="width:64px;height:64px;background:rgba(74,222,128,0.12);border:1px solid rgba(74,222,128,0.3);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px;">✓</div>
      <h2 style="color:#4ade80;margin-bottom:8px;">Ticket Submitted</h2>
      <p style="color:#94a3b8;font-size:14px;margin-bottom:24px;">Our team has been notified and will address your complaint soon.</p>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;text-align:left;">
        <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Ticket Reference</div>
        <div style="font-size:16px;font-weight:700;color:#818cf8;font-family:monospace;">{{ ticketRef }}</div>
      </div>
      <button class="tk-btn-primary" style="margin-top:24px;width:100%;" @click="resetForm">Submit Another</button>
    </div>

    <!-- Main form -->
    <div v-else class="ticket-card">
      <!-- Header -->
      <div class="tk-header">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <div class="tk-logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="8" height="18" rx="1.5" fill="rgba(99,102,241,0.9)"/>
              <rect x="13" y="3" width="8" height="11" rx="1.5" fill="rgba(168,85,247,0.7)"/>
              <rect x="13" y="16" width="8" height="5" rx="1.5" fill="rgba(99,102,241,0.5)"/>
            </svg>
          </div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#f1f5f9;">Avant Elevators</div>
            <div style="font-size:11px;color:#64748b;">Complaint Portal</div>
          </div>
        </div>

        <!-- Lift info banner -->
        <div class="tk-lift-banner">
          <div style="font-size:10px;color:#818cf8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;">
            {{ projectName }}
          </div>
          <div style="font-size:18px;font-weight:800;color:#f1f5f9;font-family:monospace;letter-spacing:.05em;">{{ liftId }}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:3px;">{{ liftLocation }}</div>
          <div v-if="liftType" style="display:inline-flex;align-items:center;gap:4px;margin-top:8px;padding:3px 10px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.2);border-radius:99px;font-size:11px;color:#818cf8;">
            {{ liftType }}
          </div>
        </div>
      </div>

      <!-- Form -->
      <form class="tk-form" @submit.prevent="submitTicket">
        <div class="tk-section-label">Your Details</div>

        <div class="tk-field">
          <label class="tk-label">Your Name <span style="color:#f87171;">*</span></label>
          <input v-model="form.reporterName" class="tk-input" placeholder="Enter your name" required />
        </div>
        <div class="tk-field">
          <label class="tk-label">Phone Number</label>
          <input v-model="form.reporterPhone" class="tk-input" type="tel" placeholder="+91 98765 43210" inputmode="tel" />
        </div>
        <div class="tk-field">
          <label class="tk-label">Flat / Unit No.</label>
          <input v-model="form.unit" class="tk-input" placeholder="e.g. A-402" />
        </div>

        <div class="tk-section-label" style="margin-top:20px;">Issue Details</div>

        <div class="tk-field">
          <label class="tk-label">Issue Type <span style="color:#f87171;">*</span></label>
          <select v-model="form.issueType" class="tk-input" required>
            <option value="">Select issue type</option>
            <option v-for="t in issueTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="tk-field">
          <label class="tk-label">Description <span style="color:#f87171;">*</span></label>
          <textarea v-model="form.description" class="tk-input tk-textarea" placeholder="Describe the problem in detail…" rows="4" required></textarea>
        </div>

        <!-- Photo upload -->
        <div class="tk-field">
          <label class="tk-label">Photos (optional, max 3)</label>
          <div class="tk-photo-row">
            <div
              v-for="(photo, i) in form.photos"
              :key="i"
              class="tk-photo-thumb"
            >
              <img :src="photo" alt="photo" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />
              <button type="button" class="tk-photo-remove" @click="removePhoto(i)">✕</button>
            </div>
            <label v-if="form.photos.length < 3" class="tk-photo-add">
              <input type="file" accept="image/*" multiple capture="environment" style="display:none;" @change="addPhotos" />
              <span style="font-size:24px;color:#64748b;">📷</span>
              <span style="font-size:11px;color:#64748b;margin-top:4px;">Add Photo</span>
            </label>
          </div>
        </div>

        <div v-if="submitError" style="padding:12px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:10px;color:#f87171;font-size:13px;margin-top:8px;">
          {{ submitError }}
        </div>

        <button type="submit" class="tk-btn-primary" :disabled="submitting" style="margin-top:24px;width:100%;">
          <span v-if="submitting">Submitting…</span>
          <span v-else>Submit Complaint</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { signInAnonymously } from 'firebase/auth'
import { auth as firebaseAuth } from '@/firebase/config'
import { getOne, create } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { notifyTicketCreated } from '@/composables/useWorkerNotify'

const route = useRoute()
const projectId = route.query.projectId || ''
const liftId    = route.query.liftId    || ''

const loading  = ref(true)
const lift     = ref(null)
const projectName = ref('')
const liftLocation = ref('')
const liftType = ref('')
const submitted = ref(false)
const ticketRef = ref('')
const submitting = ref(false)
const submitError = ref('')

const form = ref({
  reporterName: '',
  reporterPhone: '',
  unit: '',
  issueType: '',
  description: '',
  photos: [],
})

const issueTypes = [
  'Lift not moving', 'Door not opening/closing', 'Strange noise',
  'Lift stuck between floors', 'Overloading alarm', 'Display/panel issue',
  'Slow operation', 'Emergency alarm', 'Power failure', 'Other',
]

onMounted(async () => {
  try {
    await signInAnonymously(firebaseAuth)
    const proj = await getOne(Collections.PROJECTS, projectId)
    if (!proj) { loading.value = false; return }
    projectName.value = proj.projectName || ''
    // Find only the specific lift inside this project's buildings
    outer: for (const bld of (proj.buildings || [])) {
      for (const wing of (bld.wings || [])) {
        const found = (wing.lifts || []).find(l => l.id === liftId)
        if (found) {
          lift.value = { id: found.id }
          liftType.value = found.type || ''
          liftLocation.value = [bld.name, wing.name].filter(Boolean).join(' › ')
          break outer
        }
      }
    }
  } catch (e) {
    console.error('[LiftTicket] load error:', e)
  } finally {
    loading.value = false
  }
})

function generateRef() {
  return 'TKT-' + Date.now().toString(36).toUpperCase()
}

async function compressImage(dataUrl, maxDim = 800, quality = 0.65) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = dataUrl
  })
}

function addPhotos(e) {
  const files = Array.from(e.target.files || []).slice(0, 3 - form.value.photos.length)
  files.forEach(file => {
    const reader = new FileReader()
    reader.onload = async ev => {
      const compressed = await compressImage(ev.target.result)
      form.value.photos.push(compressed)
    }
    reader.readAsDataURL(file)
  })
  e.target.value = ''
}

function removePhoto(i) { form.value.photos.splice(i, 1) }

async function submitTicket() {
  if (!form.value.reporterName.trim()) { submitError.value = 'Please enter your name.'; return }
  if (!form.value.issueType) { submitError.value = 'Please select an issue type.'; return }
  if (!form.value.description.trim()) { submitError.value = 'Please describe the issue.'; return }
  submitError.value = ''
  submitting.value = true
  try {
    const ref = generateRef()
    const docId = await create(Collections.TICKETS, {
      ticketRef: ref,
      projectId,
      liftId,
      projectName: projectName.value,
      liftLocation: liftLocation.value,
      liftType: liftType.value,
      reporterName: form.value.reporterName.trim(),
      reporterPhone: form.value.reporterPhone.trim(),
      unit: form.value.unit.trim(),
      issueType: form.value.issueType,
      description: form.value.description.trim(),
      photos: form.value.photos,
      status: 'new',
      createdAt: new Date(),
    })
    ticketRef.value = ref
    submitted.value = true
    notifyTicketCreated({ id: docId, ticketRef: ref, projectId, liftId, projectName: projectName.value, liftLocation: liftLocation.value, reporterName: form.value.reporterName.trim(), issueType: form.value.issueType })
  } catch (e) {
    submitError.value = 'Failed to submit. Please try again.'
    console.error('[LiftTicket] submit error:', e)
  } finally {
    submitting.value = false
  }
}

function resetForm() {
  submitted.value = false
  ticketRef.value = ''
  form.value = { reporterName: '', reporterPhone: '', unit: '', issueType: '', description: '', photos: [] }
}
</script>

<style>
.ticket-shell {
  min-height: 100vh;
  min-height: 100dvh;
  background: #070714;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 20px 16px 48px;
}
.ticket-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
}
.ticket-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(99,102,241,0.2);
  border-top-color: #818cf8;
  border-radius: 50%;
  animation: tk-spin 0.8s linear infinite;
}
@keyframes tk-spin { to { transform: rotate(360deg); } }
.ticket-card {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
}
.tk-header { margin-bottom: 4px; }
.tk-logo {
  width: 38px;
  height: 38px;
  background: rgba(99,102,241,0.12);
  border: 1px solid rgba(99,102,241,0.2);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.tk-lift-banner {
  background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.06));
  border: 1px solid rgba(99,102,241,0.2);
  border-radius: 14px;
  padding: 16px 18px;
  margin-bottom: 20px;
}
.tk-form { display: flex; flex-direction: column; gap: 4px; }
.tk-section-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .07em;
  color: #64748b;
  margin-bottom: 8px;
  margin-top: 4px;
}
.tk-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.tk-label { font-size: 13px; font-weight: 500; color: #94a3b8; }
.tk-input {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 12px 14px;
  color: #f1f5f9;
  font-size: 14px;
  width: 100%;
  box-sizing: border-box;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  font-family: inherit;
}
.tk-input:focus { border-color: rgba(99,102,241,0.5); background: rgba(99,102,241,0.06); }
.tk-input option { background: #1e293b; color: #f1f5f9; }
.tk-textarea { resize: vertical; min-height: 100px; }
.tk-photo-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.tk-photo-thumb {
  width: 80px;
  height: 80px;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
}
.tk-photo-remove {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 20px;
  height: 20px;
  background: rgba(0,0,0,0.6);
  border: none;
  border-radius: 50%;
  color: #fff;
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tk-photo-add {
  width: 80px;
  height: 80px;
  border-radius: 10px;
  background: rgba(255,255,255,0.03);
  border: 1.5px dashed rgba(255,255,255,0.15);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  gap: 2px;
}
.tk-btn-primary {
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 14px 24px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: opacity .15s;
}
.tk-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.tk-btn-primary:not(:disabled):active { opacity: .85; }
</style>
