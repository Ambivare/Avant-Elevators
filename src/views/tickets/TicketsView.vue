<template>
  <div>
    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <Ticket :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          QR Tickets
        </h1>
        <p class="page-sub">QR-powered service access — instant, traceable, paperless.</p>
      </div>
    </div>

    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:24px;">
      <div class="glass" style="padding:14px;text-align:center;">
        <div style="font-size:22px;font-weight:700;color:var(--ct-accent);">{{ tickets.length }}</div>
        <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:3px;">Total</div>
      </div>
      <div class="glass" style="padding:14px;text-align:center;">
        <div style="font-size:22px;font-weight:700;color:#f87171;">{{ countByStatus('new') }}</div>
        <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:3px;">New</div>
      </div>
      <div class="glass" style="padding:14px;text-align:center;">
        <div style="font-size:22px;font-weight:700;color:#fbbf24;">{{ countByStatus('acknowledged') }}</div>
        <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:3px;">In Progress</div>
      </div>
      <div class="glass" style="padding:14px;text-align:center;">
        <div style="font-size:22px;font-weight:700;color:#4ade80;">{{ countByStatus('resolved') }}</div>
        <div style="font-size:11px;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.05em;margin-top:3px;">Resolved</div>
      </div>
    </div>

    <!-- Filters -->
    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
      <div class="search-box" style="flex:1;min-width:200px;">
        <Search :size="14" class="search-icon" />
        <input v-model="search" class="input" placeholder="Search lift, project, reporter, issue…" />
      </div>
      <div style="display:flex;gap:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:3px;">
        <button v-for="f in statusFilters" :key="f.value"
          :class="['btn-sm', statusFilter === f.value ? 'btn-primary' : 'btn-secondary']"
          style="border-radius:7px;"
          @click="statusFilter = f.value"
        >{{ f.label }}</button>
      </div>
    </div>

    <!-- Empty -->
    <div v-if="!filtered.length" class="glass empty-state" style="padding:60px;text-align:center;">
      <Ticket :size="36" style="opacity:.3;margin:0 auto 16px;" />
      <p>No tickets found.</p>
    </div>

    <!-- Ticket list -->
    <div v-else style="display:flex;flex-direction:column;gap:10px;">
      <div
        v-for="t in filtered"
        :key="t.id"
        class="glass"
        style="padding:16px 18px;cursor:pointer;"
        @click="openTicket(t)"
      >
        <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;">
          <!-- Status dot -->
          <div :style="`width:10px;height:10px;border-radius:50%;margin-top:5px;flex-shrink:0;background:${statusColor(t.status)};box-shadow:0 0 6px ${statusColor(t.status)};`"></div>

          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
              <span style="font-family:monospace;font-weight:700;font-size:13px;color:var(--ct-accent);">{{ t.liftId || '—' }}</span>
              <span class="badge badge-info" style="font-size:10px;">{{ t.issueType || '—' }}</span>
              <span :class="['badge', statusBadge(t.status)]">{{ statusLabel(t.status) }}</span>
            </div>
            <div style="font-size:13px;color:var(--ct-primary);margin-bottom:3px;">{{ t.description }}</div>
            <div style="font-size:12px;color:var(--ct-muted);">
              {{ t.projectName || t.projectId || '—' }}
              <span v-if="t.liftLocation"> &bull; {{ t.liftLocation }}</span>
            </div>
            <div style="font-size:11px;color:var(--ct-muted);margin-top:3px;">
              By {{ t.reporterName || 'Unknown' }}
              <span v-if="t.reporterPhone"> &bull; {{ t.reporterPhone }}</span>
              <span v-if="t.unit"> &bull; {{ t.unit }}</span>
              &bull; {{ formatDate(t.createdAt) }}
            </div>
          </div>

          <!-- Action buttons -->
          <div style="display:flex;gap:6px;flex-shrink:0;" @click.stop>
            <button class="btn-sm btn-primary" style="font-size:11px;" @click="scheduleFromTicket(t)">
              <CalendarPlus :size="11" style="margin-right:3px;" /> Schedule
            </button>
            <select
              :value="t.status"
              class="input"
              style="font-size:11px;padding:4px 8px;height:28px;border-radius:7px;"
              @change="updateStatus(t, $event.target.value)"
            >
              <option value="new">New</option>
              <option value="acknowledged">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        <!-- Photos row -->
        <div v-if="(t.photos || []).length" style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
          <img
            v-for="(p, i) in (t.photos || [])"
            :key="i"
            :src="p"
            style="width:60px;height:60px;object-fit:cover;border-radius:8px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);"
            @click.stop="viewPhoto = p"
          />
        </div>
      </div>
    </div>

    <!-- Ticket detail modal -->
    <AppModal v-model="showDetail" :title="'Ticket — ' + (selected?.liftId || '')" width="560px">
      <template v-if="selected">
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="padding:12px 16px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:12px;">
            <div style="font-size:11px;color:var(--ct-accent);margin-bottom:2px;">{{ selected.projectName }}</div>
            <div style="font-size:16px;font-weight:700;color:var(--ct-primary);font-family:monospace;">{{ selected.liftId }}</div>
            <div style="font-size:12px;color:var(--ct-muted);margin-top:2px;">{{ selected.liftLocation }}</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div class="glass" style="padding:10px 12px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;margin-bottom:3px;">Reporter</div>
              <div style="font-size:13px;color:var(--ct-sub);">{{ selected.reporterName }}</div>
            </div>
            <div class="glass" style="padding:10px 12px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;margin-bottom:3px;">Phone</div>
              <div style="font-size:13px;color:var(--ct-sub);">{{ selected.reporterPhone || '—' }}</div>
            </div>
            <div class="glass" style="padding:10px 12px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;margin-bottom:3px;">Unit</div>
              <div style="font-size:13px;color:var(--ct-sub);">{{ selected.unit || '—' }}</div>
            </div>
            <div class="glass" style="padding:10px 12px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;margin-bottom:3px;">Issue Type</div>
              <div style="font-size:13px;color:var(--ct-sub);">{{ selected.issueType }}</div>
            </div>
            <div class="glass" style="padding:10px 12px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;margin-bottom:3px;">Submitted</div>
              <div style="font-size:13px;color:var(--ct-sub);">{{ formatDate(selected.createdAt) }}</div>
            </div>
            <div class="glass" style="padding:10px 12px;">
              <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;margin-bottom:3px;">Ref</div>
              <div style="font-size:12px;color:var(--ct-accent);font-family:monospace;">{{ selected.ticketRef || selected.id }}</div>
            </div>
          </div>
          <div class="glass" style="padding:12px 14px;">
            <div style="font-size:10px;color:var(--ct-muted);text-transform:uppercase;margin-bottom:6px;">Description</div>
            <div style="font-size:13px;color:var(--ct-sub);line-height:1.6;">{{ selected.description }}</div>
          </div>
          <div v-if="(selected.photos || []).length" style="display:flex;gap:8px;flex-wrap:wrap;">
            <img
              v-for="(p, i) in selected.photos"
              :key="i"
              :src="p"
              style="height:100px;width:auto;max-width:160px;object-fit:cover;border-radius:10px;cursor:pointer;border:1px solid rgba(255,255,255,0.1);"
              @click="viewPhoto = p"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <button class="btn-primary" @click="scheduleFromTicket(selected); showDetail = false">
          <CalendarPlus :size="13" style="margin-right:4px;" /> Schedule Complaint
        </button>
        <button class="btn-secondary" @click="showDetail = false">Close</button>
      </template>
    </AppModal>

    <!-- Photo lightbox -->
    <div v-if="viewPhoto" style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;" @click="viewPhoto = null">
      <img :src="viewPhoto" style="max-width:90vw;max-height:90vh;border-radius:12px;object-fit:contain;" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Ticket, Search, CalendarPlus } from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import { useCollection } from '@/composables/useCollection'
import { update } from '@/firebase/firestore'
import { Collections } from '@/firebase/collections'
import { useUIStore } from '@/stores/ui'

const router = useRouter()
const ui = useUIStore()
const { items: tickets } = useCollection(Collections.TICKETS)

const search = ref('')
const statusFilter = ref('')
const showDetail = ref(false)
const selected = ref(null)
const viewPhoto = ref(null)

const statusFilters = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'acknowledged', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
]

const countByStatus = (s) => tickets.value.filter(t => t.status === s).length

const filtered = computed(() => {
  let list = [...tickets.value].sort((a, b) => {
    const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0)
    const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0)
    return db - da
  })
  if (statusFilter.value) list = list.filter(t => t.status === statusFilter.value)
  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(t =>
      (t.liftId || '').toLowerCase().includes(q) ||
      (t.projectName || '').toLowerCase().includes(q) ||
      (t.reporterName || '').toLowerCase().includes(q) ||
      (t.issueType || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    )
  }
  return list
})

function openTicket(t) { selected.value = t; showDetail.value = true }

async function updateStatus(ticket, status) {
  try { await update(Collections.TICKETS, ticket.id, { status }) } catch {}
}

function scheduleFromTicket(t) {
  if (!t) return
  ui.setTicketContext({
    tab: 'complaints',
    projectId: t.projectId || '',
    projectName: t.projectName || '',
    issueType: t.issueType || '',
    description: t.description || '',
    liftId: t.liftId || '',
    ticketRef: t.ticketRef || t.id || '',
  })
  router.push('/complaints')
}

function statusColor(s) {
  return s === 'new' ? '#f87171' : s === 'acknowledged' ? '#fbbf24' : '#4ade80'
}
function statusLabel(s) {
  return s === 'new' ? 'New' : s === 'acknowledged' ? 'In Progress' : 'Resolved'
}
function statusBadge(s) {
  return s === 'new' ? 'badge-danger' : s === 'acknowledged' ? 'badge-warning' : 'badge-active'
}
function formatDate(ts) {
  if (!ts) return '—'
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts)
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}
</script>
