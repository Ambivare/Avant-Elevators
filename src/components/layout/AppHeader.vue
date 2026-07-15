<template>
  <header class="app-header">
    <div class="header-left">
      <button class="mobile-menu-btn" @click="ui.toggleSidebar()">
        <Menu :size="18" />
      </button>
      <!-- Breadcrumb -->
      <div class="breadcrumb">
        <span class="bc-module">{{ currentModuleLabel }}</span>
      </div>
    </div>

    <div class="header-right">
      <!-- Mobile search toggle button -->
      <button class="mobile-search-btn" @click="openMobileSearch" aria-label="Search">
        <Search :size="17" />
      </button>

      <!-- Global Search (desktop inline / mobile fullscreen overlay) -->
      <div class="header-search-wrap" :class="{ 'mobile-active': mobileSearchOpen }" ref="searchWrapRef">
        <!-- Mobile close button -->
        <button v-if="mobileSearchOpen" class="mobile-search-close" @click="closeMobileSearch">
          <X :size="16" />
        </button>
        <div class="header-search" :class="{ active: searchFocused || gs.open.value }">
          <Search :size="14" class="search-icon" />
          <input
            v-model="gs.query.value"
            ref="searchInputRef"
            type="text"
            placeholder="Search anything…"
            class="search-input"
            autocomplete="off"
            @focus="searchFocused = true"
            @blur="searchFocused = false"
            @input="gs.onQueryChange(gs.query.value)"
            @keydown.esc="gs.clear(); closeMobileSearch(); searchFocused = false"
          />
          <Loader2 v-if="gs.searching.value" :size="13" class="search-spin" />
          <kbd v-else-if="!searchFocused && !gs.query.value" class="search-kbd">⌘K</kbd>
          <button v-else-if="gs.query.value" class="search-clear" @mousedown.prevent="gs.clear()">
            <X :size="12" />
          </button>
        </div>

        <!-- Results dropdown -->
        <transition name="search-drop">
          <div v-if="gs.open.value && gs.results.value.length" class="search-results">
            <div v-for="group in gs.results.value" :key="group.group" class="search-group">
              <div class="search-group-label" :style="`color:${group.color}`">
                {{ group.group }}
              </div>
              <button
                v-for="item in group.items"
                :key="item.id"
                class="search-item"
                @mousedown.prevent="navigateTo(item.route); gs.clear(); closeMobileSearch()"
              >
                <div class="search-item-icon" :style="`background:${group.color}22;border-color:${group.color}44;`">
                  <component :is="iconMap[group.icon]" :size="12" :style="`color:${group.color}`" />
                </div>
                <div class="search-item-text">
                  <div class="search-item-title">{{ item.title }}</div>
                  <div class="search-item-sub">{{ item.sub }}</div>
                </div>
                <span v-if="item.badge" class="search-item-badge">{{ item.badge }}</span>
              </button>
            </div>
            <div class="search-footer">
              {{ totalResults }} result{{ totalResults !== 1 ? 's' : '' }} for "{{ gs.query.value }}"
            </div>
          </div>
        </transition>
      </div>

      <!-- Offline badge -->
      <div v-if="!online.isOnline.value" class="offline-badge" title="You are offline. Changes will sync when reconnected.">
        <WifiOff :size="13" /><span class="badge-text"> Offline</span>
      </div>
      <div v-else-if="online.pendingCount.value > 0" class="sync-badge" :class="{ syncing: online.isSyncing.value }" @click="online.flushQueue()" title="Pending changes — click to sync">
        <RefreshCw :size="13" :class="{ 'spin-slow': online.isSyncing.value }" />
        <span class="badge-text">{{ online.pendingCount.value }} pending</span>
      </div>

      <!-- QR Scanner -->
      <button class="icon-btn tooltip" data-tip="Scan Lift QR" @click="openScanner" :style="showScanner ? 'border-color:rgba(255,255,255,0.5);background:rgba(255,255,255,0.25);' : ''">
        <ScanLine :size="17" />
      </button>

      <!-- Notifications bell -->
      <button class="icon-btn tooltip" data-tip="Notifications" @click="showNotifs = !showNotifs" :style="showNotifs ? 'border-color:rgba(255,255,255,0.5);background:rgba(255,255,255,0.25);' : ''">
        <Bell :size="17" />
        <span class="notif-dot" v-if="notifCount > 0">{{ notifCount > 99 ? '99+' : notifCount }}</span>
      </button>

      <NotificationsPanel v-model="showNotifs" @count="notifCount = $event" />

      <!-- QR Scanner modal (fullscreen) -->
      <Teleport to="body">
        <div v-if="showScanner" class="qr-overlay" @click.self="closeScanner">
          <div class="qr-modal">
            <div class="qr-modal-header">
              <span style="font-size:14px;font-weight:600;color:var(--ct-primary);">Scan Lift QR Code</span>
              <button class="qr-close-btn" @click="closeScanner"><X :size="16" /></button>
            </div>
            <div class="qr-viewport">
              <video ref="videoRef" class="qr-video" autoplay playsinline muted></video>
              <canvas ref="canvasRef" style="display:none;"></canvas>
              <!-- Scanning frame overlay -->
              <div class="qr-frame">
                <div class="qr-corner tl"></div>
                <div class="qr-corner tr"></div>
                <div class="qr-corner bl"></div>
                <div class="qr-corner br"></div>
                <div class="qr-scanline"></div>
              </div>
              <div v-if="scanStatus === 'scanning'" class="qr-hint">Point at a lift QR code</div>
              <div v-if="scanStatus === 'found'" class="qr-success-flash">✓ QR Detected!</div>
              <div v-if="scanStatus === 'error'" class="qr-error-msg">{{ scanError }}</div>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Theme toggle -->
      <button class="icon-btn tooltip" :data-tip="ui.theme === 'dark' ? 'Light mode' : 'Dark mode'" @click="ui.toggleTheme()">
        <Sun v-if="ui.theme === 'dark'" :size="17" />
        <Moon v-else :size="17" />
      </button>

      <!-- User menu -->
      <div class="user-menu-wrapper" ref="userMenuRef">
        <button class="user-pill" @click="showUserMenu = !showUserMenu">
          <div class="user-ava">{{ initials }}</div>
          <ChevronDown :size="13" class="user-chevron" />
        </button>

        <transition name="slide-up">
          <div class="user-dropdown" v-if="showUserMenu">
            <div class="dropdown-user-info">
              <div class="dropdown-name">{{ auth.user?.fullName || auth.user?.username }}</div>
              <div class="dropdown-role">{{ roleLabel }}</div>
            </div>
            <hr class="dropdown-divider" />
            <router-link to="/settings" class="dropdown-item" @click="showUserMenu = false">
              <Settings :size="14" /> Settings
            </router-link>
            <button class="dropdown-item danger" @click="handleLogout">
              <LogOut :size="14" /> Sign out
            </button>
          </div>
        </transition>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useAuthStore, ROLES } from '@/stores/auth'
import { onClickOutside } from '@vueuse/core'
import {
  Menu, Search, Bell, ChevronDown, Settings, LogOut, Sun, Moon,
  X, Loader2, WifiOff, RefreshCw, ScanLine,
  Building2, Package, AlertTriangle, Wrench, User, FileText, CheckSquare, TrendingUp,
} from 'lucide-vue-next'
import jsQR from 'jsqr'
import NotificationsPanel from './NotificationsPanel.vue'
import { useGlobalSearch } from '@/composables/useGlobalSearch'
import { useOfflineSync } from '@/composables/useOfflineSync'

const ui = useUIStore()
const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const searchFocused = ref(false)
const showUserMenu = ref(false)
const showNotifs = ref(false)
const userMenuRef = ref(null)
const searchWrapRef = ref(null)
const searchInputRef = ref(null)
const notifCount = ref(0)
const mobileSearchOpen = ref(false)

// ── QR Scanner ────────────────────────────────────────────────────────────────
const videoRef = ref(null)
const canvasRef = ref(null)
const showScanner = ref(false)
const scanStatus = ref('scanning') // 'scanning' | 'found' | 'error'
const scanError = ref('')
let stream = null
let scanInterval = null

async function openScanner() {
  showScanner.value = true
  scanStatus.value = 'scanning'
  scanError.value = ''
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    await nextTick()
    videoRef.value.srcObject = stream
    await videoRef.value.play()
    scanInterval = setInterval(scanFrame, 200)
  } catch {
    scanStatus.value = 'error'
    scanError.value = 'Camera access denied. Please allow camera permission.'
  }
}

function scanFrame() {
  if (!videoRef.value || !canvasRef.value) return
  const video = videoRef.value
  if (video.readyState !== video.HAVE_ENOUGH_DATA) return
  const canvas = canvasRef.value
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const code = jsQR(imageData.data, imageData.width, imageData.height)
  if (!code) return
  scanStatus.value = 'found'
  clearInterval(scanInterval)
  try {
    const url = new URL(code.data)
    const projectId = url.searchParams.get('projectId')
    const liftId = url.searchParams.get('liftId')
    if (projectId && liftId) {
      setTimeout(() => {
        closeScanner()
        router.push({ path: '/lifts', query: { projectId, liftId } })
      }, 600)
    } else {
      scanStatus.value = 'error'
      scanError.value = 'Not a valid lift QR code.'
      scanInterval = setInterval(scanFrame, 200)
    }
  } catch {
    scanStatus.value = 'error'
    scanError.value = 'Not a valid QR code.'
    scanInterval = setInterval(scanFrame, 200)
  }
}

function closeScanner() {
  clearInterval(scanInterval)
  scanInterval = null
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null }
  showScanner.value = false
  scanStatus.value = 'scanning'
  scanError.value = ''
}

function openMobileSearch() {
  mobileSearchOpen.value = true
  setTimeout(() => searchInputRef.value?.focus(), 80)
}
function closeMobileSearch() {
  mobileSearchOpen.value = false
  gs.clear()
}

const gs = useGlobalSearch()
gs.setUser(auth.user)
const online = useOfflineSync()

onClickOutside(userMenuRef, () => { showUserMenu.value = false })
onClickOutside(searchWrapRef, () => { gs.open.value = false })

const iconMap = {
  building: Building2,
  package:  Package,
  alert:    AlertTriangle,
  tool:     Wrench,
  user:     User,
  file:     FileText,
  check:    CheckSquare,
  trending: TrendingUp,
}

const totalResults = computed(() =>
  gs.results.value.reduce((sum, g) => sum + g.items.length, 0)
)

const initials = computed(() => {
  const n = auth.user?.fullName || auth.user?.username || '?'
  return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
})

const roleLabel = computed(() => ROLES[auth.user?.role]?.label || 'User')

const MODULE_LABELS = {
  dashboard: 'Dashboard', warehouse: 'Warehouse', 'service-van': 'Service Van',
  office: 'Office', projects: 'Projects', maintenance: 'Maintenance',
  repairs: 'Repairs', complaints: 'Complaints', installation: 'Installation',
  modernisation: 'Modernisation', amc: 'AMC Contracts', tasks: 'Tasks',
  tracking: 'Live Tracking', billing: 'Billing', sales: 'Sales Pipeline',
  activities: 'Activity Log', hr: 'Human Resources', leave: 'Leave Management',
  vendors: 'Vendors', bom: 'Bill of Materials', settings: 'Settings',
}

const currentModuleLabel = computed(() => {
  const seg = route.path.split('/')[1]
  return MODULE_LABELS[seg] || 'Dashboard'
})

function navigateTo(path) {
  router.push(path)
}

async function handleLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: env(safe-area-inset-top, 0) 20px 0;
  height: calc(60px + env(safe-area-inset-top, 0));
  background: #000000;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 30;
  box-sizing: border-box;
}

.header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.header-right { display: flex; align-items: center; gap: 6px; }

/* Mobile search toggle (icon-only button) */
.mobile-search-btn {
  display: none;
  align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 10px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.85); cursor: pointer;
}
.mobile-search-close {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.18);
  color: rgba(255,255,255,0.8); cursor: pointer;
}

.mobile-menu-btn {
  display: none;
  align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 10px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.85); cursor: pointer;
}
@media (max-width: 1024px) { .mobile-menu-btn { display: flex; } }

.breadcrumb { display: flex; align-items: center; gap: 6px; }
.bc-module { font-size: 14px; font-weight: 700; color: #fff; letter-spacing: 0.01em; }

/* ── Search ───────────────────────────────────────────────────────────────── */
.header-search-wrap { position: relative; }

.header-search {
  display: flex; align-items: center; gap: 8px;
  padding: 0 12px;
  height: 36px; border-radius: 12px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.2);
  transition: all 0.2s;
  min-width: 200px;
}
.header-search.active {
  background: rgba(255,255,255,0.18);
  border-color: rgba(255,255,255,0.35);
  min-width: 300px;
}
.search-icon { color: rgba(255,255,255,0.65); flex-shrink: 0; }
.search-input {
  background: transparent; border: none; outline: none;
  color: #fff; font-size: 13px; flex: 1; min-width: 0;
}
.search-input::placeholder { color: rgba(255,255,255,0.55); }
.search-kbd {
  font-size: 10px; color: rgba(255,255,255,0.6);
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.18);
  padding: 2px 6px; border-radius: 5px;
  font-family: monospace; white-space: nowrap;
}
.search-spin { color: rgba(255,255,255,0.8); flex-shrink: 0; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.search-clear {
  display: flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 50%;
  background: rgba(255,255,255,0.15); border: none;
  color: rgba(255,255,255,0.8); cursor: pointer; flex-shrink: 0;
  transition: all 0.15s;
}
.search-clear:hover { background: rgba(255,255,255,0.25); color: #fff; }

.search-results {
  position: absolute; top: calc(100% + 8px); left: 0; right: 0;
  min-width: 360px;
  background: rgba(10,10,20,0.98);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 10px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.6);
  z-index: 200;
  max-height: 480px; overflow-y: auto;
}
.search-results::-webkit-scrollbar { width: 4px; }
.search-results::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

.search-group { margin-bottom: 10px; }
.search-group-label {
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .08em; padding: 4px 8px; margin-bottom: 2px;
}
.search-item {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 8px 10px; border-radius: 10px;
  background: transparent; border: none; cursor: pointer;
  text-align: left; transition: background 0.12s;
}
.search-item:hover { background: rgba(255,255,255,0.05); }
.search-item-icon {
  width: 28px; height: 28px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 8px; border: 1px solid transparent;
}
.search-item-text { flex: 1; min-width: 0; }
.search-item-title { font-size: 13px; color:var(--ct-primary); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.search-item-sub   { font-size: 11px; color:var(--ct-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
.search-item-badge {
  font-size: 9px; padding: 2px 7px; border-radius: 20px;
  background: rgba(255,255,255,0.07); color:var(--ct-muted); flex-shrink: 0;
  text-transform: capitalize;
}
.search-footer {
  font-size: 10px; color: #334155; text-align: center;
  padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 6px;
}
.search-drop-enter-active, .search-drop-leave-active { transition: all 0.18s; }
.search-drop-enter-from, .search-drop-leave-to { opacity: 0; transform: translateY(-6px); }

/* ── Offline / Sync badges ───────────────────────────────────────────────── */
.offline-badge, .sync-badge {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 600; padding: 4px 10px;
  border-radius: 20px; white-space: nowrap;
}
.offline-badge {
  background: rgba(239,68,68,0.15);
  border: 1px solid rgba(239,68,68,0.3);
  color: #f87171;
}
.sync-badge {
  background: rgba(245,158,11,0.12);
  border: 1px solid rgba(245,158,11,0.25);
  color: #fbbf24; cursor: pointer;
  transition: background 0.15s;
}
.sync-badge:hover { background: rgba(245,158,11,0.2); }
.sync-badge.syncing { color: #fff; border-color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.15); }
.spin-slow { animation: spin 1.2s linear infinite; }

/* ── Icon button ─────────────────────────────────────────────────────────── */
.icon-btn {
  position: relative;
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 10px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.85); cursor: pointer;
  transition: all 0.18s;
}
.icon-btn:hover { background: rgba(255,255,255,0.22); color: #fff; }
.notif-dot {
  position: absolute; top: 4px; right: 4px;
  width: 16px; height: 16px; border-radius: 50%;
  background: #fff; color: #dc2626;
  font-size: 9px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid #dc2626;
}

/* ── User menu ──────────────────────────────────────────────────────────── */
.user-menu-wrapper { position: relative; }
.user-pill {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px 4px 4px;
  border-radius: 12px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(255,255,255,0.2);
  cursor: pointer; transition: all 0.18s;
}
.user-pill:hover { background: rgba(255,255,255,0.22); }
.user-ava {
  width: 28px; height: 28px; border-radius: 8px;
  background: rgba(255,255,255,0.25);
  border: 1px solid rgba(255,255,255,0.35);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #fff;
}
.user-chevron { color: rgba(255,255,255,0.7); }

.user-dropdown {
  position: absolute; top: calc(100% + 8px); right: 0;
  width: 200px;
  background: rgba(18,18,26,0.98);
  border: 1px solid rgba(220,38,38,0.15);
  border-radius: 14px;
  padding: 8px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  z-index: 100;
}
.dropdown-user-info { padding: 8px 10px 10px; }
.dropdown-name { font-size: 13px; font-weight: 600; color: var(--ct-primary); }
.dropdown-role { font-size: 11px; color: var(--ct-muted); margin-top: 2px; }
.dropdown-divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 4px 0; }
.dropdown-item {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 10px; border-radius: 9px;
  font-size: 13px; color: var(--ct-sub);
  text-decoration: none; cursor: pointer;
  width: 100%; background: transparent; border: none;
  transition: all 0.15s;
}
.dropdown-item:hover { background: rgba(220,38,38,0.08); color: #fca5a5; }
.dropdown-item.danger:hover { background: rgba(239,68,68,0.12); color: #f87171; }

/* ── Mobile breakpoint ───────────────────────────────────────────────────── */
@media (max-width: 767px) {
  .app-header { padding: env(safe-area-inset-top, 0) 12px 0; height: calc(52px + env(safe-area-inset-top, 0)); }
  .mobile-search-btn { display: flex; }
  /* Hide inline search bar on mobile — shown via overlay instead */
  .header-search-wrap:not(.mobile-active) { display: none; }
  /* Mobile search overlay */
  .header-search-wrap.mobile-active {
    display: flex;
    position: fixed;
    inset: 0;
    z-index: 200;
    align-items: flex-start;
    padding: 12px;
    gap: 8px;
    background: rgba(13,14,20,0.97);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
  .header-search-wrap.mobile-active .header-search {
    flex: 1; min-width: 0; height: 44px; border-radius: 14px;
    min-width: 0;
    max-width: 100%;
    background: rgba(255,255,255,0.07);
    border-color: rgba(220,38,38,0.4);
  }
  .header-search-wrap.mobile-active .search-results {
    position: fixed;
    top: 72px;
    left: 12px; right: 12px;
    max-height: calc(100dvh - 96px);
    max-height: calc(100vh - 96px);
    min-width: unset;
  }
  .badge-text { display: none; }
  .offline-badge, .sync-badge { padding: 4px 8px; }
  .bc-module { font-size: 13px; }
  .user-pill { padding: 4px; }
  .user-chevron { display: none; }
}

/* ── Light theme: header matches sidebar black ───────────────────────── */
[data-theme="light"] .app-header {
  background: #000000;
  border-bottom-color: rgba(255,255,255,0.07);
}
/* Search results dropdown — white panel below red bar */
[data-theme="light"] .search-results { background: rgba(255,255,255,0.99); border-color: rgba(0,0,0,0.1); box-shadow: 0 20px 60px rgba(0,0,0,0.18); }
[data-theme="light"] .search-item:hover { background: rgba(220,38,38,0.05); }
[data-theme="light"] .search-item-title { color: #1e293b; }
[data-theme="light"] .search-item-sub { color: var(--ct-muted); }
[data-theme="light"] .search-footer { color: var(--ct-sub); border-top-color: rgba(0,0,0,0.07); }
/* User dropdown — white panel below red bar */
[data-theme="light"] .user-dropdown { background: rgba(255,255,255,0.99); border-color: rgba(220,38,38,0.15); box-shadow: 0 20px 60px rgba(0,0,0,0.18); }
[data-theme="light"] .dropdown-name { color: #1e293b; }
[data-theme="light"] .dropdown-role { color: var(--ct-muted); }
[data-theme="light"] .dropdown-divider { border-top-color: rgba(0,0,0,0.07); }
[data-theme="light"] .dropdown-item { color: var(--ct-muted); }
[data-theme="light"] .dropdown-item:hover { background: rgba(220,38,38,0.06); color: #dc2626; }
@media (max-width: 767px) {
  [data-theme="light"] .header-search-wrap.mobile-active { background: rgba(255,255,255,0.98); }
  [data-theme="light"] .header-search-wrap.mobile-active .header-search { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.35); }
}

/* ── QR Scanner modal ────────────────────────────────────────────────────── */
.qr-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.85);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.qr-modal {
  width: 100%; max-width: 360px;
  background: rgba(18,18,26,0.98);
  border: 1px solid rgba(220,38,38,0.25);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 32px 80px rgba(0,0,0,0.6);
}
.qr-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.qr-close-btn {
  width: 28px; height: 28px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: var(--ct-muted); cursor: pointer; transition: all 0.15s;
}
.qr-close-btn:hover { background: rgba(255,255,255,0.12); color: var(--ct-primary); }
.qr-viewport {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #000;
  overflow: hidden;
}
.qr-video {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
}
.qr-frame {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  pointer-events: none;
}
.qr-corner {
  position: absolute;
  width: 28px; height: 28px;
  border-color: #ef4444;
  border-style: solid;
  border-width: 0;
}
.qr-corner.tl { top: 40px; left: 40px; border-top-width: 3px; border-left-width: 3px; border-radius: 4px 0 0 0; }
.qr-corner.tr { top: 40px; right: 40px; border-top-width: 3px; border-right-width: 3px; border-radius: 0 4px 0 0; }
.qr-corner.bl { bottom: 40px; left: 40px; border-bottom-width: 3px; border-left-width: 3px; border-radius: 0 0 0 4px; }
.qr-corner.br { bottom: 40px; right: 40px; border-bottom-width: 3px; border-right-width: 3px; border-radius: 0 0 4px 0; }
.qr-scanline {
  position: absolute;
  left: 42px; right: 42px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #ef4444, transparent);
  animation: scanline 2s ease-in-out infinite;
}
@keyframes scanline {
  0%   { top: 40px; opacity: 1; }
  90%  { top: calc(100% - 44px); opacity: 1; }
  100% { top: calc(100% - 44px); opacity: 0; }
}
.qr-hint {
  position: absolute; bottom: 16px; left: 0; right: 0;
  text-align: center; font-size: 12px; color: rgba(255,255,255,0.7);
  font-weight: 500; letter-spacing: 0.02em;
}
.qr-success-flash {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(34,197,94,0.25);
  font-size: 20px; font-weight: 700; color: #4ade80;
  letter-spacing: 0.02em;
  animation: flash 0.3s ease;
}
@keyframes flash { from { opacity: 0; } to { opacity: 1; } }
.qr-error-msg {
  position: absolute; bottom: 16px; left: 12px; right: 12px;
  text-align: center; font-size: 12px; color: #f87171; font-weight: 500;
  background: rgba(239,68,68,0.15); border-radius: 8px; padding: 6px 10px;
}
</style>
