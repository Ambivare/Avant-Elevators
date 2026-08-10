<template>
  <div class="selfie-overlay" @click.self="$emit('cancel')">
    <div class="selfie-shell">

      <!-- Header -->
      <div class="selfie-header">
        <div>
          <div class="selfie-title">{{ title }}</div>
          <div class="selfie-sub">{{ instruction || 'Face the front camera clearly' }}</div>
        </div>
        <button class="selfie-close" @click="$emit('cancel')"><X :size="18" /></button>
      </div>

      <!-- Camera / Preview viewport -->
      <div class="selfie-viewport">

        <!-- Live feed — always uses our custom getUserMedia UI -->
        <template v-if="phase !== 'preview'">
          <video ref="videoEl" class="selfie-video" autoplay muted playsinline />
          <div class="face-guide">
            <svg viewBox="0 0 200 240" class="face-oval">
              <ellipse cx="100" cy="120" rx="75" ry="95"
                fill="none" stroke="rgba(99,102,241,0.7)" stroke-width="2" stroke-dasharray="6 4"/>
            </svg>
          </div>
          <div class="flash-overlay" :class="{ active: flashing }" />
          <div v-if="phase === 'loading'" class="cam-state">
            <Loader2 :size="32" class="spin" style="color:var(--ct-accent);" />
            <span>Starting camera…</span>
          </div>
          <div v-if="phase === 'error'" class="cam-state cam-error">
            <CameraOff :size="36" style="color:#f87171;" />
            <span style="text-align:center;max-width:220px;line-height:1.5;">{{ errorMsg }}</span>
            <button class="btn-sm btn-secondary" style="margin-top:8px;" @click="startCamera">Retry</button>
          </div>
          <div v-if="countdown > 0" class="countdown">{{ countdown }}</div>
        </template>

        <!-- Preview -->
        <template v-if="phase === 'preview'">
          <img :src="previewUrl" class="selfie-preview-img" alt="selfie preview" />
          <div class="preview-badge">
            <CheckCircle :size="20" style="color:#4ade80;" /> Preview
          </div>
        </template>
      </div>

      <!-- Controls -->
      <div class="selfie-controls">
        <template v-if="phase === 'live'">
          <div class="capture-hint">Look straight into the camera</div>
          <button class="capture-btn" @click="capture" :disabled="capturing">
            <div class="capture-inner" />
          </button>
        </template>

        <template v-else-if="phase === 'preview'">
          <div style="display:flex;gap:12px;width:100%;justify-content:center;">
            <button class="btn-secondary" @click="retake">
              <RotateCcw :size="14" /> Retake
            </button>
            <button class="btn-primary" @click="useSelfie">
              <CheckCircle :size="14" /> Use This Photo
            </button>
          </div>
        </template>
      </div>

      <canvas ref="canvasEl" style="display:none;" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { X, Loader2, CameraOff, CheckCircle, RotateCcw } from 'lucide-vue-next'
import { Capacitor } from '@capacitor/core'

const props = defineProps({
  title:       { type: String, default: 'Take Selfie' },
  instruction: { type: String, default: '' },
})
const emit = defineEmits(['captured', 'cancel'])

const videoEl   = ref(null)
const canvasEl  = ref(null)
const phase     = ref('loading')
const flashing  = ref(false)
const capturing = ref(false)
const countdown = ref(0)
const errorMsg  = ref('')
const previewUrl = ref('')
let capturedBlob = null
let stream = null

onMounted(startCamera)
onUnmounted(stopCamera)

async function startCamera() {
  phase.value    = 'loading'
  errorMsg.value = ''

  // On Android APK: request camera permission via Capacitor before getUserMedia.
  // getUserMedia is handled by Capacitor's WebView but needs manifest + pre-request.
  if (Capacitor.isNativePlatform()) {
    try {
      const { Camera } = await import('@capacitor/camera')
      const status = await Camera.requestPermissions({ permissions: ['camera'] })
      if (status.camera === 'denied') {
        phase.value    = 'error'
        errorMsg.value = 'Camera permission denied. Go to Settings → Apps → Avant Elevators → Permissions → Camera → Allow.'
        return
      }
    } catch { /* proceed — WebView will handle its own permission dialog */ }
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
      audio: false,
    })
    videoEl.value.srcObject = stream
    await videoEl.value.play()
    phase.value = 'live'
  } catch (e) {
    stopCamera()
    phase.value = 'error'
    if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
      errorMsg.value = Capacitor.isNativePlatform()
        ? 'Camera permission denied. Go to Settings → Apps → Avant Elevators → Permissions → Camera → Allow.'
        : 'Camera permission denied. Allow camera access in your browser settings and retry.'
    } else if (e.name === 'NotFoundError') {
      errorMsg.value = 'No front camera found on this device.'
    } else {
      errorMsg.value = `Camera error: ${e.message || e.name}`
    }
  }
}

function stopCamera() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
}

async function capture() {
  if (capturing.value) return
  capturing.value = true
  for (let i = 3; i >= 1; i--) { countdown.value = i; await sleep(900) }
  countdown.value = 0
  flashing.value = true; await sleep(120); flashing.value = false

  const video = videoEl.value, canvas = canvasEl.value
  canvas.width  = video.videoWidth  || 720
  canvas.height = video.videoHeight || 960
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
  canvas.toBlob(blob => {
    capturedBlob     = blob
    previewUrl.value = URL.createObjectURL(blob)
    stopCamera()
    phase.value     = 'preview'
    capturing.value = false
  }, 'image/jpeg', 0.88)
}

function retake() {
  previewUrl.value = ''
  capturedBlob     = null
  startCamera()
}

function useSelfie() {
  if (capturedBlob) emit('captured', capturedBlob)
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
</script>

<style scoped>
.selfie-overlay {
  position: fixed; inset: 0; z-index: 1100;
  /* 100svh = height when mobile browser chrome (Safari's toolbar, etc.) is fully
     shown — guarantees the overlay (and the controls pinned to its bottom) never
     render underneath/behind that chrome, unlike 100vh or the default inset:0 sizing. */
  height: 100svh;
  background: rgba(0,0,0,0.88); backdrop-filter: blur(10px);
  display: flex; align-items: flex-end; justify-content: center;
}
@media (min-width: 600px) {
  .selfie-overlay { align-items: center; padding: 24px; }
}
.selfie-shell {
  background: #0d0d1a; border: 1px solid rgba(99,102,241,0.2);
  border-radius: 28px 28px 0 0; width: 100%; max-width: 420px;
  overflow: hidden; display: flex; flex-direction: column;
  max-height: 95svh; box-shadow: 0 -20px 60px rgba(0,0,0,0.7);
}
@media (min-width: 600px) { .selfie-shell { border-radius: 24px; max-height: 90vh; } }
.selfie-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 20px 20px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); flex-shrink: 0;
}
.selfie-title { font-size: 16px; font-weight: 700; color: var(--ct-primary, #e2e8f0); }
.selfie-sub   { font-size: 12px; color: var(--ct-muted, #64748b); margin-top: 3px; }
.selfie-close {
  width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
  border-radius: 9px; background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08); color: var(--ct-muted, #64748b);
  cursor: pointer; flex-shrink: 0; transition: all 0.15s;
}
.selfie-close:hover { background: rgba(239,68,68,0.15); color: #f87171; }
.selfie-viewport {
  position: relative; width: 100%;
  /* aspect-ratio is a sizing preference, not a hard floor: flex-shrink + min-height:0
     let this shrink below it on short viewports (iPhone Safari with its address/tab
     bar chrome eating vertical space), so the header and controls below — which hold
     the actual capture button — are never pushed past the shell's max-height and
     clipped by its overflow:hidden. */
  flex: 1 1 auto; min-height: 0;
  aspect-ratio: 3/4;
  background: #000; overflow: hidden;
}
.selfie-video, .selfie-preview-img {
  width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);
}
.face-guide {
  position: absolute; inset: 0; display: flex; align-items: center;
  justify-content: center; pointer-events: none;
}
.face-oval { width: 60%; max-width: 220px; }
.flash-overlay {
  position: absolute; inset: 0; background: #fff; opacity: 0;
  transition: opacity 0.05s; pointer-events: none;
}
.flash-overlay.active { opacity: 0.85; }
.cam-state {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px;
  background: rgba(0,0,0,0.75); font-size: 13px; color: #94a3b8; padding: 24px; text-align: center;
}
.cam-error { background: rgba(0,0,0,0.88); }
.countdown {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 96px; font-weight: 900; color: rgba(255,255,255,0.9);
  text-shadow: 0 4px 20px rgba(0,0,0,0.8); pointer-events: none;
  animation: countPop 0.9s ease-out;
}
@keyframes countPop {
  0%   { transform: scale(1.8); opacity: 0; }
  30%  { transform: scale(1);   opacity: 1; }
  80%  { transform: scale(1);   opacity: 1; }
  100% { transform: scale(0.7); opacity: 0; }
}
.preview-badge {
  position: absolute; bottom: 14px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,0.65); border: 1px solid rgba(74,222,128,0.4);
  border-radius: 99px; padding: 6px 16px; display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 600; color: #4ade80; backdrop-filter: blur(6px);
}
.selfie-controls {
  padding: 20px 24px calc(28px + env(safe-area-inset-bottom, 0px));
  display: flex; flex-direction: column;
  align-items: center; gap: 12px; flex-shrink: 0;
}
.capture-hint { font-size: 12px; color: var(--ct-muted, #64748b); }
.capture-btn {
  width: 72px; height: 72px; border-radius: 50%;
  background: rgba(255,255,255,0.1); border: 3px solid rgba(255,255,255,0.5);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: transform 0.12s, background 0.15s;
}
.capture-btn:hover  { background: rgba(255,255,255,0.18); transform: scale(1.06); }
.capture-btn:active { transform: scale(0.94); }
.capture-btn:disabled { opacity: 0.4; cursor: wait; }
.capture-inner {
  width: 54px; height: 54px; border-radius: 50%;
  background: #fff; transition: transform 0.12s;
}
.capture-btn:active .capture-inner { transform: scale(0.88); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
