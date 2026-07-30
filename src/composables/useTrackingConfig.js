import { ref } from 'vue'
import { getAll } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'

const ROLE_KEYS = ['admin', 'technician', 'sales', 'reception', 'user']
const DEFAULTS = { admin: true, technician: true, sales: true, reception: false, user: false }

const trackingRoles = ref(null) // null = not loaded yet
let loadPromise = null

export function useTrackingConfig() {
  function load() {
    if (!loadPromise) {
      loadPromise = getAll(Collections.CONFIGURATIONS)
        .then(docs => {
          if (docs.length) {
            const sorted = [...docs].sort((a, b) => {
              const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
              const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
              return tb - ta
            })
            const saved = sorted[0].trackingRoles
            trackingRoles.value = saved ? { ...DEFAULTS, ...saved } : { ...DEFAULTS }
          } else {
            trackingRoles.value = { ...DEFAULTS }
          }
        })
        .catch(() => { trackingRoles.value = { ...DEFAULTS } })
    }
    return loadPromise
  }

  function refresh() {
    loadPromise = null
    trackingRoles.value = null
    return load()
  }

  function isRoleEnabled(role) {
    if (!role) return false
    if (trackingRoles.value === null) return role === 'admin' || role === 'technician' || role === 'sales'
    return !!trackingRoles.value[role]
  }

  function enabledRoles() {
    if (!trackingRoles.value) return ['admin', 'technician', 'sales']
    return ROLE_KEYS.filter(r => !!trackingRoles.value[r])
  }

  return { trackingRoles, ROLE_KEYS, DEFAULTS, load, refresh, isRoleEnabled, enabledRoles }
}
