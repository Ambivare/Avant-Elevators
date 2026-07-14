<template>
  <div class="scanner-overlay" @click.self="close">
    <div class="scanner-card">
      <!-- Header -->
      <div class="scanner-header">
        <div>
          <div class="scanner-title">
            <ScanLine :size="18" style="color:var(--ct-accent);" /> Barcode Scanner
          </div>
          <div class="scanner-sub">Point camera at barcode or QR code</div>
        </div>
        <button class="scanner-close" @click="close"><X :size="18" /></button>
      </div>

      <!-- Video viewport -->
      <div class="scanner-viewport">
        <video ref="videoEl" class="scanner-video" autoplay muted playsinline />
        <!-- scanning crosshair overlay -->
        <div class="scan-frame">
          <span class="corner tl" /><span class="corner tr" />
          <span class="corner bl" /><span class="corner br" />
          <div class="scan-line" :class="{ scanning: scanning }" />
        </div>
        <!-- state overlays -->
        <div v-if="state === 'loading'" class="scanner-state">
          <Loader2 :size="32" class="spin" style="color:var(--ct-accent);" />
          <span>Starting camera…</span>
        </div>
        <div v-if="state === 'error'" class="scanner-state error">
          <CameraOff :size="32" style="color:#f87171;" />
          <span>{{ errorMsg }}</span>
          <button class="btn-secondary btn-sm" style="margin-top:8px;" @click="startScan">Retry</button>
        </div>
        <div v-if="state === 'success'" class="scanner-state success">
          <CheckCircle :size="36" style="color:#4ade80;" />
          <span>Scanned!</span>
        </div>
      </div>

      <!-- Camera selector -->
      <div v-if="cameras.length > 1" class="scanner-cameras">
        <select v-model="selectedCamera" class="input" style="font-size:12px;" @change="switchCamera">
          <option v-for="cam in cameras" :key="cam.deviceId" :value="cam.deviceId">
            {{ cam.label || `Camera ${cameras.indexOf(cam) + 1}` }}
          </option>
        </select>
      </div>

      <!-- Last result -->
      <div v-if="lastResult" class="scanner-result">
        <div class="result-label">Last Scanned</div>
        <div class="result-value">{{ lastResult }}</div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn-primary btn-sm" @click="accept">Use This Code</button>
          <button class="btn-secondary btn-sm" @click="lastResult = ''; state = 'scanning'">Scan Again</button>
        </div>
      </div>

      <!-- Manual entry fallback -->
      <div class="scanner-manual">
        <span style="color:var(--ct-muted);font-size:12px;">Or type manually:</span>
        <input
          v-model="manualCode"
          class="input"
          style="flex:1;font-size:13px;"
          placeholder="Enter barcode / SKU…"
          @keydown.enter="acceptManual"
        />
        <button class="btn-secondary btn-sm" @click="acceptManual" :disabled="!manualCode.trim()">Use</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ScanLine, X, Loader2, CameraOff, CheckCircle } from 'lucide-vue-next'

const emit = defineEmits(['scanned', 'close'])

const videoEl = ref(null)
const cameras = ref([])
const selectedCamera = ref('')
const state = ref('loading') // loading | scanning | error | success
const scanning = ref(false)
const errorMsg = ref('')
const lastResult = ref('')
const manualCode = ref('')

let reader = null
let stream = null

// ── Init ─────────────────────────────────────────────────────────────────────
onMounted(startScan)
onUnmounted(stopScan)

async function startScan() {
  state.value = 'loading'
  errorMsg.value = ''
  lastResult.value = ''
  try {
    const { BrowserMultiFormatReader } = await import('@zxing/browser')
    reader = new BrowserMultiFormatReader()

    // List cameras
    const devices = await BrowserMultiFormatReader.listVideoInputDevices()
    cameras.value = devices
    // prefer back camera on mobile
    const back = devices.find(d => /back|rear|environment/i.test(d.label))
    selectedCamera.value = back ? back.deviceId : (devices[0]?.deviceId || undefined)

    state.value = 'scanning'
    scanning.value = true

    await reader.decodeFromVideoDevice(
      selectedCamera.value,
      videoEl.value,
      (result, err) => {
        if (result) {
          lastResult.value = result.getText()
          state.value = 'success'
          scanning.value = false
          if (navigator.vibrate) navigator.vibrate(100)
        }
        // NotFoundException fires every frame when no barcode is in view — safe to ignore
        if (err && err.name !== 'NotFoundException') {
          // non-fatal decode errors — ignore
        }
      }
    )
  } catch (e) {
    scanning.value = false
    state.value = 'error'
    if (e.name === 'NotAllowedError') {
      errorMsg.value = 'Camera permission denied. Please allow camera access and retry.'
    } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
      errorMsg.value = 'No camera found on this device.'
    } else {
      errorMsg.value = `Camera error: ${e.message || e}`
    }
  }
}

async function stopScan() {
  scanning.value = false
  if (reader) {
    try { reader.reset() } catch {}
    reader = null
  }
  if (stream) {
    stream.getTracks().forEach(t => t.stop())
    stream = null
  }
}

async function switchCamera() {
  await stopScan()
  await startScan()
}

function accept() {
  if (!lastResult.value) return
  emit('scanned', lastResult.value)
  close()
}

function acceptManual() {
  const v = manualCode.value.trim()
  if (!v) return
  emit('scanned', v)
  close()
}

function close() {
  stopScan()
  emit('close')
}
</script>

<style scoped>
.scanner-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.75);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}

.scanner-card {
  background: #0d0d1a;
  border: 1px solid rgba(99,102,241,0.25);
  border-radius: 20px;
  width: 100%; max-width: 440px;
  overflow: hidden;
  box-shadow: 0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04);
}

.scanner-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 18px 20px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.scanner-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 15px; font-weight: 700; color:var(--ct-primary);
}
.scanner-sub { font-size: 11px; color:var(--ct-muted); margin-top: 4px; }
.scanner-close {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 9px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  color:var(--ct-muted); cursor: pointer;
  transition: all 0.15s;
}
.scanner-close:hover { background: rgba(239,68,68,0.15); color: #f87171; }

.scanner-viewport {
  position: relative; width: 100%; aspect-ratio: 4/3;
  background: #000; overflow: hidden;
}
.scanner-video {
  width: 100%; height: 100%; object-fit: cover; display: block;
}

/* Corner brackets */
.scan-frame {
  position: absolute; inset: 20px; pointer-events: none;
}
.corner {
  position: absolute; width: 22px; height: 22px;
  border-color:var(--ct-accent); border-style: solid; border-width: 0;
}
.corner.tl { top: 0; left: 0;  border-top-width: 3px; border-left-width: 3px; border-radius: 3px 0 0 0; }
.corner.tr { top: 0; right: 0; border-top-width: 3px; border-right-width: 3px; border-radius: 0 3px 0 0; }
.corner.bl { bottom: 0; left: 0;  border-bottom-width: 3px; border-left-width: 3px; border-radius: 0 0 0 3px; }
.corner.br { bottom: 0; right: 0; border-bottom-width: 3px; border-right-width: 3px; border-radius: 0 0 3px 0; }

.scan-line {
  position: absolute; left: 0; right: 0; top: 0;
  height: 2px; background: linear-gradient(90deg, transparent, #a5b4fc, transparent);
  opacity: 0;
}
.scan-line.scanning {
  opacity: 1;
  animation: scanMove 2s linear infinite;
}
@keyframes scanMove {
  0%   { top: 0;    }
  100% { top: 100%; }
}

/* State overlays */
.scanner-state {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; background: rgba(0,0,0,0.65);
  font-size: 13px; color:var(--ct-sub);
}
.scanner-state.error { background: rgba(0,0,0,0.8); }
.scanner-state.success { background: rgba(0,20,0,0.7); }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.scanner-cameras { padding: 10px 20px 0; }

.scanner-result {
  margin: 14px 20px;
  padding: 14px;
  background: rgba(99,102,241,0.1);
  border: 1px solid rgba(99,102,241,0.25);
  border-radius: 12px;
}
.result-label { font-size: 10px; color: #6366f1; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
.result-value { font-size: 17px; font-weight: 700; color:var(--ct-primary); margin-top: 4px; word-break: break-all; }

.scanner-manual {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid rgba(255,255,255,0.05);
}

/* Light theme */
[data-theme="light"] .scanner-card { background: #f8fafc; border-color: rgba(99,102,241,0.3); }
[data-theme="light"] .scanner-title { color: #1e293b; }
[data-theme="light"] .scanner-close { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.1); color:var(--ct-muted); }
[data-theme="light"] .result-value { color: #1e293b; }
</style>
