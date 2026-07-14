<template>
  <div class="login-page">
    <div class="blob blob-1" /><div class="blob blob-2" /><div class="blob blob-3" />

    <!-- hidden recaptcha container for Firebase Phone Auth -->
    <div id="recaptcha-container" style="display:none;"></div>

    <div class="login-wrapper">
      <!-- Left branding -->
      <div class="login-brand">
        <div class="brand-logo">
          <img src="/favicon.svg" alt="Avant Elevators" style="width:36px;height:36px;object-fit:contain;" onerror="this.style.display='none'" />
        </div>
        <h1 class="brand-title">Avant Elevators</h1>
        <p class="brand-subtitle">Enterprise Management System</p>
        <div class="brand-stats">
          <div class="brand-stat" v-for="s in stats" :key="s.label">
            <div class="stat-val">{{ s.val }}</div>
            <div class="stat-lbl">{{ s.label }}</div>
          </div>
        </div>
        <div class="brand-features">
          <div class="feature-item" v-for="f in features" :key="f">
            <Check :size="13" class="feature-check" /><span>{{ f }}</span>
          </div>
        </div>
      </div>

      <!-- Right panel -->
      <div class="login-card">
        <transition name="step" mode="out-in">
        <div :key="step" class="step-content">

        <!-- ── STEP 1: Credentials ── -->
        <template v-if="step === 'credentials'">
          <div class="card-header">
            <h2 class="card-title">Welcome back</h2>
            <p class="card-sub">Sign in to your account</p>
          </div>
          <form class="login-form" @submit.prevent="handleLogin">
            <div class="form-group">
              <label class="label">Username</label>
              <div class="input-icon-wrap">
                <User :size="15" class="input-icon" />
                <input v-model="form.username" type="text" class="input pl-input"
                  placeholder="Enter your username" autocomplete="username" required />
              </div>
            </div>
            <div class="form-group">
              <label class="label">Password</label>
              <div class="input-icon-wrap">
                <Lock :size="15" class="input-icon" />
                <input v-model="form.password" :type="showPass ? 'text' : 'password'"
                  class="input pl-input pr-input" placeholder="Enter your password"
                  autocomplete="current-password" required />
                <button type="button" class="input-icon-right" @click="showPass = !showPass">
                  <component :is="showPass ? EyeOff : Eye" :size="15" />
                </button>
              </div>
            </div>
            <transition name="slide-up">
              <div class="error-msg" v-if="auth.error">
                <AlertCircle :size="14" /> {{ auth.error }}
              </div>
            </transition>
            <button type="submit" class="btn-primary w-full justify-center py-3" :disabled="signingIn || auth.loading">
              <Loader2 v-if="signingIn || auth.loading" :size="15" class="spin" />
              <LogIn v-else :size="15" />
              {{ signingIn || auth.loading ? 'Signing in…' : 'Sign In' }}
            </button>
          </form>
        </template>

        <!-- ── STEP 2: Channel Selection ── -->
        <template v-else-if="step === 'channel'">
          <div style="text-align:center;margin-bottom:24px;">
            <div class="otp-shield"><ShieldCheck :size="36" style="color:#a5b4fc;" /></div>
            <h2 class="card-title" style="margin-bottom:6px;">Verify Your Identity</h2>
            <p class="card-sub" style="margin:0;">Choose where to receive your OTP</p>
          </div>

          <transition name="slide-up">
            <div class="error-msg" v-if="auth.otpError" style="margin-bottom:16px;">
              <AlertCircle :size="14" /> {{ auth.otpError }}
            </div>
          </transition>

          <div class="channel-options">
            <button
              v-if="auth.pendingUser?.email"
              class="channel-btn"
              :disabled="!!channelLoading"
              @click="selectChannel('email')"
            >
              <div class="channel-icon email-icon"><Mail :size="22" /></div>
              <div class="channel-info">
                <div class="channel-label">Send via Email</div>
                <div class="channel-sub">{{ auth.maskEmail(auth.pendingUser.email) }}</div>
              </div>
              <Loader2 v-if="channelLoading === 'email'" :size="16" class="spin" style="color:#a5b4fc;margin-left:auto;" />
              <ChevronRight v-else :size="16" style="color:#475569;margin-left:auto;" />
            </button>

            <button
              v-if="auth.pendingUser?.phone && !isNative"
              class="channel-btn"
              :disabled="!!channelLoading"
              @click="selectChannel('phone')"
            >
              <div class="channel-icon phone-icon"><Smartphone :size="22" /></div>
              <div class="channel-info">
                <div class="channel-label">Send via SMS</div>
                <div class="channel-sub">{{ auth.maskPhone(auth.pendingUser.phone) }}</div>
              </div>
              <Loader2 v-if="channelLoading === 'phone'" :size="16" class="spin" style="color:#a5b4fc;margin-left:auto;" />
              <ChevronRight v-else :size="16" style="color:#475569;margin-left:auto;" />
            </button>

            <p v-if="isNative && !auth.pendingUser?.email && auth.pendingUser?.phone"
              style="color:#f97316;font-size:13px;text-align:center;padding:12px;">
              SMS OTP is not supported in the app. Add an email address to your admin account to log in on mobile.
            </p>
            <p v-else-if="!auth.pendingUser?.email && !auth.pendingUser?.phone"
              style="color:#ef4444;font-size:13px;text-align:center;padding:12px;">
              No email or phone registered on this admin account. Contact IT.
            </p>
          </div>

          <div style="margin-top:20px;text-align:center;">
            <button class="resend-btn" @click="handleCancel">← Back to login</button>
          </div>
        </template>

        <!-- ── STEP 3: OTP Input ── -->
        <template v-else>
          <div style="text-align:center;margin-bottom:24px;">
            <div class="otp-shield"><ShieldCheck :size="36" style="color:#a5b4fc;" /></div>
            <h2 class="card-title" style="margin-bottom:6px;">Enter OTP</h2>
            <p class="card-sub" style="margin-bottom:0;">6-digit code sent to:</p>
            <div class="otp-channels">
              <span v-if="otpChannel === 'email'"><Mail :size="13" /> {{ auth.otpMeta.maskedEmail }}</span>
              <span v-if="otpChannel === 'phone'"><Smartphone :size="13" /> {{ auth.otpMeta.maskedPhone }}</span>
            </div>
          </div>

          <div class="otp-boxes" @paste.prevent="handlePaste">
            <input
              v-for="i in 6" :key="i"
              :ref="el => { if (el) boxes[i-1] = el }"
              v-model="digits[i-1]"
              type="text" inputmode="numeric" maxlength="1"
              class="otp-box" :class="{ filled: digits[i-1] }"
              @input="onDigitInput(i-1)"
              @keydown.backspace="onBackspace(i-1)"
              @keydown.left="boxes[i-2]?.focus()"
              @keydown.right="boxes[i]?.focus()"
            />
          </div>

          <transition name="slide-up">
            <div class="error-msg" v-if="auth.otpError" style="margin-bottom:12px;">
              <AlertCircle :size="14" /> {{ auth.otpError }}
            </div>
          </transition>

          <div class="otp-timer" v-if="timeLeft > 0">OTP expires in <strong>{{ timerDisplay }}</strong></div>
          <div class="otp-timer" v-else style="color:#ef4444;">OTP expired —
            <button class="resend-btn" @click="resendOtp" :disabled="auth.otpSending">resend</button>
          </div>

          <button class="btn-primary w-full justify-center py-3" style="margin-top:16px;"
            :disabled="fullOtp.length < 6 || auth.otpVerifying" @click="handleVerifyOtp">
            <Loader2 v-if="auth.otpVerifying" :size="15" class="spin" />
            <ShieldCheck v-else :size="15" />
            {{ auth.otpVerifying ? 'Verifying...' : 'Verify OTP' }}
          </button>

          <div style="margin-top:16px;text-align:center;">
            <button class="resend-btn" @click="goBackToChannel">← Change method</button>
            <span style="color:#475569;margin:0 8px;">·</span>
            <button class="resend-btn" @click="resendOtp"
              :disabled="auth.otpSending || resendCooldown > 0">
              {{ resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP' }}
            </button>
          </div>
        </template>

        </div>
        </transition>

        <div class="login-footer">
          <span>v3.0.0</span><span>·</span><span>Powered by Ambivare</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { RecaptchaVerifier } from 'firebase/auth'
import { Capacitor } from '@capacitor/core'
import { auth as firebaseAuth } from '@/firebase/config'
import { useAuthStore } from '@/stores/auth'
import {
  User, Lock, Eye, EyeOff, AlertCircle, LogIn, Loader2, Check,
  ShieldCheck, Mail, Smartphone, ChevronRight,
} from 'lucide-vue-next'

const auth   = useAuthStore()
const router = useRouter()

const step            = ref('credentials')
const signingIn       = ref(false)     // persistent loading from Sign In click → OTP visible
const otpChannel      = ref('')        // 'email' | 'phone'
const selectedChannel = ref('')
const channelLoading  = ref('')        // set immediately on tap for instant spinner
const isNative        = Capacitor.isNativePlatform()  // phone OTP needs SHA-1 in APK
const form            = ref({ username: '', password: '' })
const showPass        = ref(false)
const digits          = ref(['', '', '', '', '', ''])
const boxes           = ref([])
let   recaptchaVerifier = null
let   recaptchaSeq      = 0            // unique ID per verifier to avoid stale widgets

const OTP_TTL         = 5 * 60
const timeLeft        = ref(OTP_TTL)
const resendCooldown  = ref(0)
let   countdownTimer  = null
let   resendTimer     = null

const timerDisplay = computed(() => {
  const m = Math.floor(timeLeft.value / 60)
  const s = String(timeLeft.value % 60).padStart(2, '0')
  return `${m}:${s}`
})
const fullOtp = computed(() => digits.value.join(''))

const stats    = [{ val: '21', label: 'Modules' }, { val: '5', label: 'User Roles' }, { val: '∞', label: 'Scale' }]
const features = ['Real-time elevator tracking', 'AMC contract management', 'Complete billing pipeline', 'HR & payroll management', 'Multi-role access control']

function startCountdown() {
  clearInterval(countdownTimer)
  timeLeft.value = OTP_TTL
  countdownTimer = setInterval(() => { if (timeLeft.value > 0) timeLeft.value--; else clearInterval(countdownTimer) }, 1000)
}
function startResendCooldown() {
  resendCooldown.value = 60
  clearInterval(resendTimer)
  resendTimer = setInterval(() => { if (resendCooldown.value > 0) resendCooldown.value--; else clearInterval(resendTimer) }, 1000)
}

async function handleLogin() {
  signingIn.value = true
  try {
    const result = await auth.login(form.value.username, form.value.password)
    if (result.success) {
      router.push('/dashboard')
    } else if (result.otpRequired) {
      // Always show channel step so the user can choose and see errors clearly.
      // Auto-selecting and silently failing hides Cloud Function errors from the user.
      step.value = 'channel'
    }
  } finally {
    signingIn.value = false
  }
}

function initRecaptcha() {
  // Tear down previous verifier entirely
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear() } catch {}
    recaptchaVerifier = null
  }
  // Remove ALL previously managed containers so no "already rendered" ghost remains
  document.querySelectorAll('[data-rcv]').forEach(el => el.remove())

  // Append a brand-new element with a unique ID — Firebase holds a ref by ID,
  // so a fresh ID guarantees no stale token is ever reused
  recaptchaSeq++
  const id = `rcv-${recaptchaSeq}`
  const el = document.createElement('div')
  el.id = id
  el.setAttribute('data-rcv', '1')
  el.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;bottom:0;left:0;'
  document.body.appendChild(el)

  // Use visible reCAPTCHA in native APK — invisible hangs in Capacitor WebView
  const rcSize = Capacitor.isNativePlatform() ? 'normal' : 'invisible'
  if (Capacitor.isNativePlatform()) {
    // Make the container visible and centred so the user can tap the checkbox
    el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99999;'
  }
  recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, id, { size: rcSize })
  // Do NOT call render() here — signInWithPhoneNumber will trigger it fresh,
  // preventing stale/reused tokens that cause auth/invalid-app-credential
}

async function selectChannel(channel) {
  if (channelLoading.value) return          // debounce double-tap
  channelLoading.value = channel            // instant spinner — no await before this
  selectedChannel.value = channel
  otpChannel.value = channel
  let sent
  if (channel === 'email') {
    sent = await auth.sendEmailOtp()
  } else {
    initRecaptcha()                         // sync — no delay
    sent = await auth.sendPhoneOtp(recaptchaVerifier)
  }
  if (sent?.sent) {
    digits.value = ['', '', '', '', '', '']
    step.value = 'otp'
    startCountdown()
    startResendCooldown()
    setTimeout(() => boxes.value[0]?.focus(), 150)
  }
  channelLoading.value = ''
  selectedChannel.value = ''
}

async function handleVerifyOtp() {
  const result = otpChannel.value === 'phone'
    ? await auth.verifyPhoneOtp(fullOtp.value)
    : await auth.verifyEmailOtp(fullOtp.value)
  if (result.success) {
    clearInterval(countdownTimer)
    clearInterval(resendTimer)
    router.push('/dashboard')
  }
}

async function resendOtp() {
  digits.value = ['', '', '', '', '', '']
  await selectChannel(otpChannel.value)
}

function goBackToChannel() {
  step.value = auth.pendingUser ? 'channel' : 'credentials'
  digits.value = ['', '', '', '', '', '']
  clearInterval(countdownTimer)
  clearInterval(resendTimer)
}

function handleCancel() {
  clearInterval(countdownTimer)
  clearInterval(resendTimer)
  try { recaptchaVerifier?.clear() } catch {}
  auth.cancelOtp()
  step.value = 'credentials'
  digits.value = ['', '', '', '', '', '']
}

function onDigitInput(i) {
  digits.value[i] = digits.value[i].replace(/\D/g, '').slice(-1)
  if (digits.value[i] && i < 5) boxes.value[i + 1]?.focus()
}
function onBackspace(i) {
  if (!digits.value[i] && i > 0) { digits.value[i - 1] = ''; boxes.value[i - 1]?.focus() }
}
function handlePaste(e) {
  const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '')
  for (let i = 0; i < 6; i++) digits.value[i] = text[i] || ''
  boxes.value[Math.min(text.length, 5)]?.focus()
}

onBeforeUnmount(() => {
  clearInterval(countdownTimer)
  clearInterval(resendTimer)
  try { recaptchaVerifier?.clear(); recaptchaVerifier = null } catch {}
  document.querySelectorAll('[data-rcv]').forEach(el => el.remove())
})
</script>

<style scoped>
.login-page {
  min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;
  padding:24px;background:url('/background.png') center/cover no-repeat fixed;
  position:relative;overflow:hidden;
}
.login-page::before { content:'';position:absolute;inset:0;background:rgba(0,0,0,.35);z-index:0; }

.blob { position:absolute;border-radius:50%;filter:blur(80px);pointer-events:none; }
.blob-1 { width:500px;height:500px;background:rgba(99,102,241,.07);top:-100px;left:-100px; }
.blob-2 { width:400px;height:400px;background:rgba(168,85,247,.06);bottom:-80px;right:0; }
.blob-3 { width:300px;height:300px;background:rgba(59,130,246,.05);top:40%;left:40%; }

.login-wrapper {
  display:flex;width:100%;max-width:900px;border-radius:24px;overflow:hidden;
  border:1px solid rgba(255,255,255,.18);box-shadow:0 40px 120px rgba(0,0,0,.6);
  position:relative;z-index:1;backdrop-filter:blur(18px);
}

.login-brand {
  flex:1;padding:48px 40px;
  background:linear-gradient(145deg,rgba(30,30,60,.82),rgba(15,15,35,.88));
  border-right:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;
}
.brand-logo {
  width:52px;height:52px;border-radius:16px;
  background:linear-gradient(135deg,rgba(99,102,241,.3),rgba(168,85,247,.2));
  border:1px solid rgba(99,102,241,.3);display:flex;align-items:center;justify-content:center;margin-bottom:20px;
}
.brand-title { font-size:24px;font-weight:700;color:#f1f5f9;margin:0 0 6px;letter-spacing:-.5px; }
.brand-subtitle { font-size:13px;color:var(--ct-muted);margin:0 0 36px; }
.brand-stats { display:flex;gap:24px;margin-bottom:36px;padding-bottom:28px;border-bottom:1px solid rgba(255,255,255,.06); }
.stat-val { font-size:24px;font-weight:700;color:#6366f1;letter-spacing:-.5px; }
.stat-lbl { font-size:11px;color:var(--ct-muted);margin-top:2px; }
.brand-features { display:flex;flex-direction:column;gap:12px; }
.feature-item { display:flex;align-items:center;gap:10px;font-size:13px;color:var(--ct-sub); }
.feature-check { color:var(--ct-green);flex-shrink:0; }

.login-card {
  width:380px;padding:48px 40px;
  background:rgba(8,8,22,.88);backdrop-filter:blur(24px);display:flex;flex-direction:column;
}
.card-title { font-size:22px;font-weight:700;color:#f1f5f9;margin:0 0 6px;letter-spacing:-.4px; }
.card-sub { font-size:13px;color:var(--ct-muted);margin:0 0 32px; }

.login-form { display:flex;flex-direction:column;gap:18px; }
.form-group { display:flex;flex-direction:column;gap:6px; }
.input-icon-wrap { position:relative; }
.input-icon { position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--ct-muted);pointer-events:none; }
.input-icon-right { position:absolute;right:12px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:var(--ct-muted);cursor:pointer;padding:0;display:flex; }
.pl-input { padding-left:38px !important; }
.pr-input { padding-right:38px !important; }

.error-msg {
  display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;
  background:rgba(239,68,68,.1);color:#f87171;border:1px solid rgba(239,68,68,.2);font-size:13px;
}

/* ── Channel Selection ── */
.otp-shield {
  width:72px;height:72px;border-radius:50%;background:rgba(165,180,252,.1);
  border:1px solid rgba(165,180,252,.2);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;
}
.channel-options { display:flex;flex-direction:column;gap:12px; }
.channel-btn {
  display:flex;align-items:center;gap:14px;padding:16px;
  background:rgba(255,255,255,.04);border:1.5px solid rgba(255,255,255,.1);
  border-radius:14px;cursor:pointer;width:100%;text-align:left;
  transition:border-color .15s,background .15s;
}
.channel-btn:hover:not(:disabled) { border-color:rgba(165,180,252,.5);background:rgba(165,180,252,.06); }
.channel-btn:disabled { opacity:.6;cursor:not-allowed; }
.channel-icon {
  width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;
}
.email-icon { background:rgba(99,102,241,.15);color:#a5b4fc; }
.phone-icon { background:rgba(52,211,153,.15);color:#34d399; }
.channel-label { font-size:14px;font-weight:600;color:#f1f5f9;margin-bottom:2px; }
.channel-sub { font-size:12px;color:#64748b; }

/* ── OTP Input ── */
.otp-channels { display:flex;justify-content:center;gap:16px;margin-top:10px;flex-wrap:wrap; }
.otp-channels span { display:flex;align-items:center;gap:6px;font-size:13px;color:#a5b4fc;font-weight:500; }
.otp-boxes { display:flex;gap:10px;justify-content:center;margin-bottom:18px; }
.otp-box {
  width:44px;height:52px;text-align:center;font-size:22px;font-weight:700;color:#f1f5f9;
  background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.12);
  border-radius:12px;outline:none;transition:border-color .15s,background .15s;caret-color:#a5b4fc;
}
.otp-box:focus { border-color:#6366f1;background:rgba(99,102,241,.08); }
.otp-box.filled { border-color:rgba(165,180,252,.4); }
.otp-timer { text-align:center;font-size:13px;color:#64748b;margin-bottom:4px; }
.otp-timer strong { color:#f1f5f9; }
.resend-btn { background:none;border:none;color:#6366f1;cursor:pointer;font-size:13px;padding:0;text-decoration:underline; }
.resend-btn:disabled { color:#475569;cursor:not-allowed;text-decoration:none; }

.w-full { width:100%; }
.justify-center { justify-content:center; }
.py-3 { padding-top:12px !important;padding-bottom:12px !important; }
.spin { animation:spin 1s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }

.login-footer { display:flex;gap:8px;align-items:center;margin-top:auto;padding-top:32px;font-size:11px;color:#334155; }
.slide-up-enter-active,.slide-up-leave-active { transition:all .2s ease; }
.slide-up-enter-from,.slide-up-leave-to { opacity:0;transform:translateY(-4px); }

.step-content { display:flex;flex-direction:column;gap:0; }
.step-enter-active { transition:opacity .22s ease,transform .22s ease; }
.step-leave-active { transition:opacity .14s ease,transform .14s ease; }
.step-enter-from { opacity:0;transform:translateY(12px); }
.step-leave-to { opacity:0;transform:translateY(-6px); }

@media (max-width:700px) {
  .login-page { padding:0;align-items:stretch; }
  .login-wrapper { flex-direction:column;border-radius:0;border:none;box-shadow:none;max-width:100%;min-height:100dvh; }
  .login-brand { padding:36px 24px 24px;flex:0;border-right:none;border-bottom:1px solid rgba(255,255,255,.1); }
  .brand-title { font-size:20px; }
  .brand-subtitle { margin-bottom:20px; }
  .brand-stats { margin-bottom:0;padding-bottom:0;border-bottom:none;gap:20px; }
  .brand-features { display:none; }
  .login-card { width:100%;padding:28px 24px 36px;flex:1; }
  .card-sub { margin-bottom:24px; }
  .otp-box { width:40px;height:48px;font-size:20px; }
}
</style>
