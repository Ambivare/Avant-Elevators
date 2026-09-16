import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { useActivityStore } from './activity'
import { initFCM, removeFCMToken } from '@/firebase/fcm'
import { scheduleAttendanceNotifications, cancelAttendanceNotifications } from '@/composables/useAttendanceNotifications'
import { syncCallLogs } from '@/utils/callLogFirestoreSync'
import { requestMediaAccess } from '@/utils/mediaAccess'
import { auth as firebaseAuth } from '@/firebase/config'
import { signInAnonymously, signOut as firebaseSignOut } from 'firebase/auth'

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
    tabs: ['dashboard','sales','projects','amc','billing','tasks','complaints','tracking','attendance','leave','gallery','inspection','reminders','lifts','tickets','licenses'],
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
  const user    = ref(null)
  const loading = ref(false)
  const error   = ref('')

  const isLoggedIn  = computed(() => !!user.value)
  const role        = computed(() => user.value?.role || null)
  const permissions = computed(() => ROLES[role.value] || ROLES.user)
  const canAccess   = (tab) => permissions.value.tabs?.includes(tab)
  const can         = (perm) => !!permissions.value[perm]

  function saveSession(u) {
    user.value = u
    localStorage.setItem(SESSION_KEY, JSON.stringify(u))
  }

  function clearSession() {
    user.value = null
    localStorage.removeItem(SESSION_KEY)
  }

  async function ensureFirebaseAuth() {
    if (!firebaseAuth.currentUser) {
      await signInAnonymously(firebaseAuth)
    }
  }

  async function login(username, password) {
    loading.value = true
    error.value = ''
    await new Promise(r => setTimeout(r, 0))
    try {
      try {
        await ensureFirebaseAuth()
      } catch {
        error.value = 'Auth service unavailable. Enable Anonymous Authentication in Firebase Console.'
        return { success: false }
      }

      // Check employees first (all staff, including admins)
      const employees = await getAll(Collections.EMPLOYEES)
      const emp = employees.find(e =>
        e.username?.toLowerCase() === username.trim().toLowerCase() &&
        e.password === password &&
        e.status !== 'inactive'
      )
      if (emp) {
        const { password: _, ...safe } = emp
        const session = { ...safe, role: safe.role || 'user' }
        saveSession(session)
        initFCM(session.id, session.role, session.fullName || session.username).catch(e => console.warn('[FCM]', e))
        scheduleAttendanceNotifications().catch(() => {})
        syncCallLogs(session.id, session.fullName || session.username).catch(() => {})
        requestMediaAccess().catch(() => {})
        return { success: true }
      }

      // Fallback: legacy users collection
      const users = await getAll(Collections.USERS)
      const found = users.find(u =>
        u.username?.toLowerCase() === username.trim().toLowerCase() &&
        u.password === password &&
        u.status !== 'inactive'
      )
      if (found) {
        const { password: _, ...safe } = found
        const session = { ...safe, role: safe.role || 'user' }
        saveSession(session)
        initFCM(session.id, session.role, session.fullName || session.username).catch(e => console.warn('[FCM]', e))
        scheduleAttendanceNotifications().catch(() => {})
        syncCallLogs(session.id, session.fullName || session.username).catch(() => {})
        requestMediaAccess().catch(() => {})
        return { success: true }
      }

      error.value = 'Invalid credentials or account inactive.'
      return { success: false }
    } catch (e) {
      error.value = e?.code === 'permission-denied' || e?.message?.includes('permission')
        ? 'Permission denied. Check Firestore rules are published correctly.'
        : 'Login failed. Please try again.'
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
        const u = user.value
        if (u?.id) {
          initFCM(u.id, u.role, u.fullName || u.username).catch(e => console.warn('[FCM]', e))
          scheduleAttendanceNotifications().catch(() => {})
          syncCallLogs(u.id, u.fullName || u.username).catch(() => {})
          requestMediaAccess().catch(() => {})
        }
      }
    } catch { /* ignore */ }
  }

  function logout() {
    const uid = user.value?.id
    clearSession()
    if (uid) removeFCMToken(uid).catch(() => {})
    cancelAttendanceNotifications().catch(() => {})
    firebaseSignOut(firebaseAuth).catch(() => {})
  }

  return {
    user, loading, error, isLoggedIn, role, permissions, canAccess, can,
    loadSession, login, logout,
  }
})
