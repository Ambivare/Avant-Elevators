import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { useActivityStore } from './activity'
import { initFCM, removeFCMToken } from '@/firebase/fcm'
import { scheduleAttendanceNotifications, cancelAttendanceNotifications } from '@/composables/useAttendanceNotifications'
import { auth as firebaseAuth } from '@/firebase/config'
import { signInAnonymously, signOut as firebaseSignOut, signInWithPhoneNumber } from 'firebase/auth'
import { sendAdminOtpFn, verifyAdminOtpFn } from '@/firebase/functions'

const SESSION_KEY = 'me_session_v3'

// Role definitions
export const ROLES = {
  admin: {
    label: 'Admin',
    tabs: ['dashboard','warehouse','service-van','office','projects','repairs','complaints','installation','modernisation','amc','tasks','tracking','billing','sales','activities','hr','attendance','leave','salary','vendors','bom','settings','maintenance','configurations','ai-assistant','gallery','inspection','reminders','lifts','tickets','dispatch','licenses'],
    canDelete: true,
    canCreateTasks: true,
    canApproveLeave: true,
    canViewHR: true,
    canCreateService: true,
  },
  sales: {
    label: 'Sales',
    tabs: ['dashboard','sales','projects','amc','billing','tasks','complaints','attendance','leave','gallery','inspection','reminders','lifts','tickets','licenses'],
    canDelete: false,
    canCreateTasks: true,
    canApproveLeave: false,
    canViewHR: false,
    canCreateService: true,
  },
  technician: {
    label: 'Technician',
    tabs: ['dashboard','tasks','installation','modernisation','repairs','complaints','amc','tracking','service-van','attendance','leave','gallery','inspection','reminders','lifts','tickets'],
    canDelete: false,
    canCreateTasks: false,
    canApproveLeave: false,
    canViewHR: false,
    canCreateService: false,
  },
  reception: {
    label: 'Reception',
    tabs: ['dashboard','warehouse','service-van','office','projects','repairs','complaints','installation','modernisation','amc','tasks','tracking','billing','sales','activities','attendance','leave','vendors','bom','maintenance','configurations','ai-assistant','gallery','inspection','reminders','lifts','tickets','dispatch','licenses'],
    canDelete: true,
    canCreateTasks: true,
    canApproveLeave: false,
    canViewHR: false,
    canCreateService: true,
  },
  user: {
    label: 'User',
    tabs: ['dashboard','projects','tasks','office','attendance','leave','gallery','reminders'],
    canDelete: false,
    canCreateTasks: false,
    canApproveLeave: false,
    canViewHR: false,
    canCreateService: false,
  },
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const loading = ref(false)
  const error = ref('')

  // OTP step state (admin-only 2FA)
  const pendingUser         = ref(null)   // validated user waiting for OTP
  const pendingConfirmation = ref(null)   // Firebase phone auth confirmation result
  const otpSending          = ref(false)
  const otpVerifying        = ref(false)
  const otpError            = ref('')
  const otpMeta             = ref({ maskedEmail: '', maskedPhone: '' })

  function toE164(phone) {
    const d = String(phone || '').replace(/\D/g, '')
    if (d.length === 10) return '+91' + d
    if (d.startsWith('91') && d.length === 12) return '+' + d
    if (d.startsWith('0') && d.length === 11) return '+91' + d.slice(1)
    return '+' + d
  }

  function maskPhone(phone) {
    const d = String(phone || '').replace(/\D/g, '')
    const n = d.length === 10 ? '91' + d : d
    return '+' + n.slice(0, 2) + ' ****' + n.slice(-4)
  }

  function maskEmail(email) {
    if (!email?.includes('@')) return ''
    const [local, domain] = email.split('@')
    return local.slice(0, 2) + '***@' + domain
  }

  const isLoggedIn = computed(() => !!user.value)
  const role = computed(() => user.value?.role || null)
  const permissions = computed(() => ROLES[role.value] || ROLES.user)
  const canAccess = (tab) => permissions.value.tabs?.includes(tab)
  const can = (perm) => !!permissions.value[perm]

  function saveSession(u) {
    user.value = u
    localStorage.setItem(SESSION_KEY, JSON.stringify(u))
  }

  function clearSession() {
    user.value = null
    localStorage.removeItem(SESSION_KEY)
  }

  // Ensure Firebase anonymous auth is active so request.auth != null in Firestore rules
  async function ensureFirebaseAuth() {
    if (!firebaseAuth.currentUser) {
      await signInAnonymously(firebaseAuth)
    }
  }

  async function login(username, password) {
    loading.value = true
    error.value = ''
    await new Promise(r => setTimeout(r, 0))  // yield so loading state paints before Firestore reads
    try {
      // Ensure anonymous Firebase Auth session exists before any Firestore reads
      try {
        await ensureFirebaseAuth()
      } catch (authErr) {
        error.value = 'Auth service unavailable. Enable Anonymous Authentication in Firebase Console.'
        return { success: false }
      }

      // Check EMPLOYEES first — all staff including admins must be in employees collection.
      // This ensures a single consistent ID is used for attendance, tasks, etc.
      const employees = await getAll(Collections.EMPLOYEES)
      const emp = employees.find(e =>
        e.username?.toLowerCase() === username.trim().toLowerCase() &&
        e.password === password &&
        e.status !== 'inactive'
      )
      if (emp) {
        const { password: _, ...safeEmp } = emp
        const sessionEmp = { ...safeEmp, role: safeEmp.role || 'user' }
        if (sessionEmp.role === 'admin') {
          if (sessionEmp.email || sessionEmp.phone) {
            pendingUser.value = sessionEmp
            return { success: false, otpRequired: true }
          }
          // No contact info — bypass OTP and log in directly
        }
        saveSession(sessionEmp)
        initFCM(sessionEmp.id, sessionEmp.role, sessionEmp.fullName || sessionEmp.username).catch(e => console.warn('[FCM] login init failed:', e))
        scheduleAttendanceNotifications().catch(() => {})
        return { success: true }
      }

      // Fallback: check users collection (legacy accounts not yet in employees)
      const users = await getAll(Collections.USERS)
      const found = users.find(u =>
        u.username?.toLowerCase() === username.trim().toLowerCase() &&
        u.password === password &&
        u.status !== 'inactive'
      )
      if (found) {
        const { password: _, ...safeUser } = found
        if (safeUser.role === 'admin') {
          if (safeUser.email || safeUser.phone) {
            pendingUser.value = safeUser
            return { success: false, otpRequired: true }
          }
          // No contact info — bypass OTP and log in directly
        }
        saveSession(safeUser)
        initFCM(safeUser.id, safeUser.role, safeUser.fullName || safeUser.username).catch(e => console.warn('[FCM] login init failed:', e))
        scheduleAttendanceNotifications().catch(() => {})
        return { success: true }
      }

      error.value = 'Invalid credentials or account inactive.'
      return { success: false }
    } catch (e) {
      if (e?.code === 'permission-denied' || e?.message?.includes('permission')) {
        error.value = 'Permission denied. Check Firestore rules are published correctly.'
      } else {
        error.value = 'Login failed. Please try again.'
      }
      return { success: false }
    } finally {
      loading.value = false
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (raw) {
        user.value = JSON.parse(raw)
        ensureFirebaseAuth().catch(() => {})
        // Re-register FCM token on every app open so tokens stay fresh
        const u = user.value
        if (u?.id) {
          initFCM(u.id, u.role, u.fullName || u.username)
            .catch(e => console.warn('[FCM] loadSession init failed:', e))
          scheduleAttendanceNotifications().catch(() => {})
        }
      }
    } catch { /* ignore */ }
  }

  // ── Email OTP via Cloud Function ──────────────────────────────────
  async function sendEmailOtp() {
    if (!pendingUser.value) return { sent: false }
    otpSending.value = true
    otpError.value = ''
    try {
      const res = await sendAdminOtpFn({ userId: pendingUser.value.id, email: pendingUser.value.email || '' })
      otpMeta.value = { maskedEmail: res.data.maskedEmail || maskEmail(pendingUser.value.email), maskedPhone: '' }
      return { sent: true }
    } catch (e) {
      otpError.value = e.message || 'Failed to send email OTP.'
      return { sent: false }
    } finally {
      otpSending.value = false
    }
  }

  async function verifyEmailOtp(code) {
    if (!pendingUser.value) return { success: false }
    otpVerifying.value = true
    otpError.value = ''
    try {
      const res = await verifyAdminOtpFn({ userId: pendingUser.value.id, otp: String(code) })
      if (res.data.valid) {
        const u = pendingUser.value
        pendingUser.value = null
        saveSession(u)
        initFCM(u.id, u.role, u.fullName || u.username).catch(() => {})
        scheduleAttendanceNotifications().catch(() => {})
        return { success: true }
      }
      otpError.value = res.data.reason || 'Invalid OTP.'
      return { success: false }
    } catch (e) {
      otpError.value = e.message || 'Verification failed. Try again.'
      return { success: false }
    } finally {
      otpVerifying.value = false
    }
  }

  // ── Phone OTP via Firebase Phone Auth ────────────────────────────
  async function sendPhoneOtp(recaptchaVerifier) {
    if (!pendingUser.value?.phone) return { sent: false }
    otpSending.value = true
    otpError.value = ''
    try {
      const e164 = toE164(pendingUser.value.phone)
      console.log('[PhoneAuth] sending to', e164)
      const confirmation = await Promise.race([
        signInWithPhoneNumber(firebaseAuth, e164, recaptchaVerifier),
        new Promise((_, reject) => setTimeout(() => reject({ code: 'auth/timeout' }), 20000)),
      ])
      pendingConfirmation.value = confirmation
      otpMeta.value = { maskedEmail: '', maskedPhone: maskPhone(pendingUser.value.phone) }
      return { sent: true }
    } catch (e) {
      const code = e.code || ''
      console.error('[PhoneAuth] error:', code, e.message)
      otpError.value =
        code === 'auth/operation-not-allowed'
          ? 'Phone sign-in is not enabled. Go to Firebase Console → Authentication → Sign-in method → Phone → Enable.'
        : code === 'auth/invalid-phone-number'
          ? 'Phone number on this account is invalid. Update it in HR settings.'
        : code === 'auth/too-many-requests'
          ? 'Too many SMS attempts. Wait a few minutes and try again.'
        : code === 'auth/captcha-check-failed' || code === 'auth/internal-error'
          ? 'reCAPTCHA failed — add this domain to Firebase Console → Authentication → Authorized Domains, then try email OTP.'
        : code === 'auth/invalid-app-credential'
          ? 'Verification token expired — tap Send via SMS again to retry.'
        : code === 'auth/timeout'
          ? 'Verification timed out. Check internet connection and try again, or use email OTP.'
        : `SMS failed (${code || e.message}). Try email OTP instead.`
      return { sent: false }
    } finally {
      otpSending.value = false
    }
  }

  async function verifyPhoneOtp(code) {
    if (!pendingConfirmation.value) return { success: false }
    otpVerifying.value = true
    otpError.value = ''
    try {
      await pendingConfirmation.value.confirm(String(code))
      const u = pendingUser.value
      pendingUser.value = null
      pendingConfirmation.value = null
      saveSession(u)
      initFCM(u.id, u.role, u.fullName || u.username).catch(() => {})
      scheduleAttendanceNotifications().catch(() => {})
      return { success: true }
    } catch (e) {
      otpError.value = e.code === 'auth/invalid-verification-code' ? 'Incorrect OTP. Try again.'
        : e.code === 'auth/code-expired' ? 'OTP expired. Please resend.'
        : 'Verification failed. Try again.'
      return { success: false }
    } finally {
      otpVerifying.value = false
    }
  }

  function cancelOtp() {
    pendingUser.value = null
    pendingConfirmation.value = null
    otpError.value = ''
    otpMeta.value = { maskedEmail: '', maskedPhone: '' }
  }

  function logout() {
    const uid = user.value?.id
    clearSession()
    pendingUser.value = null
    if (uid) removeFCMToken(uid).catch(() => {})
    cancelAttendanceNotifications().catch(() => {})
    firebaseSignOut(firebaseAuth).catch(() => {})
  }

  return {
    user, loading, error, isLoggedIn, role, permissions, canAccess, can,
    pendingUser, otpSending, otpVerifying, otpError, otpMeta,
    loadSession, login, cancelOtp, logout,
    sendEmailOtp, verifyEmailOtp,
    sendPhoneOtp, verifyPhoneOtp,
    maskEmail, maskPhone,
  }
})
