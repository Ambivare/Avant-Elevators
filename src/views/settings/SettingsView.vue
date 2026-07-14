<template>
  <div class="page-container">
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <Settings :size="22" style="display:inline;margin-right:8px;vertical-align:-4px;" />
          Settings
        </h1>
        <p class="page-sub">Preferences and configurations for your workspace.</p>
      </div>
    </div>

    <div class="settings-layout">
      <!-- Sidebar Nav -->
      <div class="glass settings-sidebar">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['settings-nav-btn', activeTab === tab.key && 'active']"
          @click="activeTab = tab.key"
        >
          <component :is="tab.icon" :size="15" />
          {{ tab.label }}
        </button>
      </div>

      <!-- Content Panel -->
      <div class="glass" style="padding:28px;">

        <!-- User Management (Admin only) -->
        <template v-if="activeTab === 'users'">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
            <h2 style="font-size:16px;font-weight:600;color:var(--ct-primary);margin:0;">User Accounts</h2>
            <button class="btn-primary" @click="openAddUser" v-if="auth.can('canViewHR')">
              <UserPlus :size="14" /> Add User
            </button>
          </div>
          <div v-if="!auth.can('canViewHR')" class="glass" style="padding:20px;text-align:center;color:var(--ct-muted);">
            <Lock :size="28" style="margin:0 auto 10px;display:block;opacity:.4;" />
            You don't have permission to manage users.
          </div>
          <template v-else>
            <div v-for="u in allUsers" :key="u.id" class="user-row">
              <div class="user-av-lg">{{ getInitials(u.fullName || u.username) }}</div>
              <div style="flex:1;">
                <div style="font-weight:600;color:var(--ct-primary);">{{ u.fullName || u.username }}</div>
                <div style="font-size:12px;color:var(--ct-muted);">@{{ u.username }} &bull; {{ u.email || '—' }}</div>
              </div>
              <span :class="['badge', roleBadge(u.role)]">{{ u.role }}</span>
              <span :class="['badge', u.status === 'inactive' ? 'badge-inactive' : 'badge-active']">{{ u.status || 'active' }}</span>
              <button class="btn-secondary btn-sm" @click="openEditUser(u)"><Pencil :size="12" /></button>
            </div>
            <div v-if="!allUsers.length" class="empty-state" style="padding:40px;">
              <Users :size="28" />
              <p>No users found</p>
            </div>
          </template>
        </template>

        <!-- Change Password -->
        <template v-else-if="activeTab === 'password'">
          <h2 style="font-size:16px;font-weight:600;color:var(--ct-primary);margin:0 0 4px;">Change Password</h2>
          <p style="font-size:13px;color:var(--ct-muted);margin:0 0 24px;">
            Logged in as <strong style="color:var(--ct-sub);">{{ auth.user?.fullName || auth.user?.username }}</strong>
          </p>
          <div style="max-width:420px;display:flex;flex-direction:column;gap:16px;">
            <div class="form-group">
              <label class="label">Current Password</label>
              <div style="position:relative;">
                <input v-model="currentPassword" :type="showCurrentPwd ? 'text' : 'password'" class="input" placeholder="Enter current password" style="padding-right:40px;" />
                <button type="button" @click="showCurrentPwd = !showCurrentPwd" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--ct-muted);cursor:pointer;padding:0;display:flex;">
                  <svg style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" viewBox="0 0 24 24">
                    <template v-if="showCurrentPwd"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></template>
                    <template v-else><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></template>
                  </svg>
                </button>
              </div>
            </div>
            <div class="form-group">
              <label class="label">New Password</label>
              <div style="position:relative;">
                <input v-model="newPassword" :type="showNewPwd ? 'text' : 'password'" class="input" placeholder="Min. 6 characters" style="padding-right:40px;" />
                <button type="button" @click="showNewPwd = !showNewPwd" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--ct-muted);cursor:pointer;padding:0;display:flex;">
                  <svg style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" viewBox="0 0 24 24">
                    <template v-if="showNewPwd"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></template>
                    <template v-else><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></template>
                  </svg>
                </button>
              </div>
              <div v-if="newPassword && newPassword.length < 6" style="font-size:11px;color:#f87171;margin-top:4px;">At least 6 characters required</div>
            </div>
            <div class="form-group">
              <label class="label">Confirm New Password</label>
              <div style="position:relative;">
                <input v-model="confirmPassword" :type="showConfirmPwd ? 'text' : 'password'" class="input" placeholder="Re-enter new password" style="padding-right:40px;" @keyup.enter="changePassword" />
                <button type="button" @click="showConfirmPwd = !showConfirmPwd" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--ct-muted);cursor:pointer;padding:0;display:flex;">
                  <svg style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;" viewBox="0 0 24 24">
                    <template v-if="showConfirmPwd"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></template>
                    <template v-else><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></template>
                  </svg>
                </button>
              </div>
              <div v-if="newPassword && confirmPassword && newPassword !== confirmPassword" style="font-size:11px;color:#f87171;margin-top:4px;">Passwords do not match</div>
            </div>
            <button class="btn-primary" style="width:fit-content;" @click="changePassword" :disabled="savingPwd">
              <Key :size="14" /> {{ savingPwd ? 'Updating…' : 'Update Password' }}
            </button>
          </div>
        </template>

        <!-- Backup & Restore (Admin only) -->
        <template v-else-if="activeTab === 'backup'">
          <h2 style="font-size:16px;font-weight:600;color:var(--ct-primary);margin:0 0 6px;">Backup &amp; Restore</h2>
          <p style="font-size:13px;color:var(--ct-muted);margin:0 0 24px;">
            Full database backup across {{ BACKUP_COLLECTIONS.length }} collections. Admin password required for all operations.
          </p>

          <div v-if="auth.user?.role !== 'admin'" class="glass" style="padding:20px;text-align:center;color:var(--ct-muted);">
            <ShieldOff :size="28" style="margin:0 auto 10px;display:block;opacity:.4;" />
            Only admins can perform backup and restore operations.
          </div>

          <template v-else>
            <!-- Last backup info -->
            <div class="backup-status-card" :class="lastBackup ? 'backup-ok' : 'backup-none'">
              <div style="display:flex;align-items:center;gap:10px;">
                <Database :size="18" style="flex-shrink:0;" />
                <div>
                  <div style="font-size:13px;font-weight:600;">
                    {{ lastBackup ? 'Last Backup' : 'No Backup Found' }}
                  </div>
                  <div style="font-size:12px;margin-top:2px;opacity:.8;">
                    <template v-if="lastBackup">
                      {{ formatDateTime(lastBackup.createdAt) }} &bull; by {{ lastBackup.createdBy }}
                      &bull; {{ lastBackup.totalDocuments }} documents across {{ lastBackup.collections?.length }} collections
                    </template>
                    <template v-else>Run a backup to protect your data.</template>
                  </div>
                </div>
              </div>
              <button class="btn-secondary btn-sm" @click="loadLastBackup" :disabled="loadingBackupMeta" style="flex-shrink:0;">
                <RefreshCw :size="12" :class="loadingBackupMeta ? 'spin' : ''" /> Refresh
              </button>
            </div>

            <!-- Progress indicator -->
            <div v-if="backupProgress" class="backup-progress-bar">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                <Loader2 :size="14" class="spin" />
                <span style="font-size:13px;color:var(--ct-sub);">{{ backupProgress }}</span>
              </div>
              <div style="height:4px;background:rgba(255,255,255,0.08);border-radius:99px;overflow:hidden;">
                <div class="progress-fill"></div>
              </div>
            </div>

            <!-- Action buttons -->
            <div style="display:flex;flex-direction:column;gap:16px;margin-top:24px;">

              <!-- BACKUP -->
              <div class="backup-action-card">
                <div class="backup-action-icon backup-icon-blue">
                  <HardDriveDownload :size="20" />
                </div>
                <div style="flex:1;">
                  <div style="font-size:14px;font-weight:600;color:var(--ct-primary);margin-bottom:4px;">Create Backup</div>
                  <div style="font-size:12px;color:var(--ct-muted);line-height:1.6;">
                    Downloads a <strong style="color:var(--ct-sub);">ZIP file</strong> containing CSV and Excel exports of every collection,
                    and simultaneously saves a <strong style="color:var(--ct-sub);">Firestore snapshot</strong> that can be restored at any time.
                  </div>
                </div>
                <button
                  class="btn-primary"
                  style="flex-shrink:0;"
                  :disabled="!!backupProgress"
                  @click="openAuthModal('backup')"
                >
                  <HardDriveDownload :size="14" /> {{ backupProgress && pendingAction === 'backup' ? 'Backing up…' : 'Backup Now' }}
                </button>
              </div>

              <!-- RESTORE -->
              <div class="backup-action-card restore-card">
                <div class="backup-action-icon backup-icon-red">
                  <HardDriveUpload :size="20" />
                </div>
                <div style="flex:1;">
                  <div style="font-size:14px;font-weight:600;color:#f87171;margin-bottom:4px;">Restore from Backup</div>
                  <div style="font-size:12px;color:var(--ct-muted);line-height:1.6;">
                    <strong style="color:#fbbf24;">⚠ Destructive operation.</strong>
                    Clears all current data and replaces it with the last saved Firestore backup.
                    This cannot be undone.
                  </div>
                </div>
                <button
                  class="btn-danger"
                  style="flex-shrink:0;"
                  :disabled="!!backupProgress || !lastBackup"
                  @click="openAuthModal('restore')"
                >
                  <HardDriveUpload :size="14" /> {{ backupProgress && pendingAction === 'restore' ? 'Restoring…' : 'Restore' }}
                </button>
              </div>
            </div>

            <!-- Collection list -->
            <div style="margin-top:24px;">
              <div style="font-size:12px;color:var(--ct-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em;">Collections included in backup</div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;">
                <span v-for="b in BACKUP_COLLECTIONS" :key="b.col" class="badge badge-info" style="font-size:10px;">{{ b.label }}</span>
              </div>
            </div>
          </template>
        </template>

        <!-- Mask Database -->
        <template v-else-if="activeTab === 'mask'">
          <h2 style="font-size:16px;font-weight:600;color:var(--ct-primary);margin:0 0 4px;">Mask Database</h2>
          <p style="font-size:13px;color:var(--ct-muted);margin:0 0 24px;">Device-only setting. Hides client names, phone numbers, and addresses on all cards.</p>

          <div class="glass" style="padding:18px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
            <div style="flex:1;">
              <div style="font-weight:600;color:var(--ct-primary);margin-bottom:4px;display:flex;align-items:center;gap:8px;">
                <EyeOff :size="15" style="color:var(--ct-accent);" />
                Hide Sensitive Data
              </div>
              <div style="font-size:12px;color:var(--ct-muted);line-height:1.6;">
                Masks project names, client names, phone numbers, and addresses<br>with <strong style="color:var(--ct-sub);">••••••</strong> on database cards. Counts and stats remain visible.
              </div>
            </div>
            <button
              class="mask-toggle-btn"
              :class="{ 'mask-toggle-on': maskStore.maskEnabled }"
              @click="maskStore.toggle()"
              :aria-label="maskStore.maskEnabled ? 'Disable masking' : 'Enable masking'"
            >
              <div class="mask-toggle-knob" />
            </button>
          </div>

          <div v-if="maskStore.maskEnabled" class="glass" style="padding:14px 18px;margin-top:14px;border-color:rgba(248,113,113,0.25);background:rgba(248,113,113,0.05);display:flex;align-items:center;gap:10px;">
            <ShieldOff :size="15" style="color:#f87171;flex-shrink:0;" />
            <span style="font-size:13px;color:#f87171;">Masking active — sensitive data is hidden on this device.</span>
          </div>
          <div v-else class="glass" style="padding:14px 18px;margin-top:14px;border-color:rgba(52,211,153,0.2);background:rgba(52,211,153,0.04);display:flex;align-items:center;gap:10px;">
            <EyeOff :size="15" style="color:#34d399;flex-shrink:0;" />
            <span style="font-size:13px;color:#34d399;">Masking off — all data is visible.</span>
          </div>

          <div class="glass" style="padding:16px 18px;margin-top:16px;">
            <div style="font-size:11px;font-weight:600;color:var(--ct-muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;">What gets masked</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">
              <span class="badge badge-info">Client Names</span>
              <span class="badge badge-info">Project Names</span>
              <span class="badge badge-info">Phone Numbers</span>
              <span class="badge badge-info">Addresses</span>
              <span class="badge badge-info">Contact Persons</span>
              <span class="badge badge-info">Employee Names</span>
            </div>
            <div style="font-size:11px;color:var(--ct-muted);margin-top:10px;">Stored locally in your browser — not synced to the cloud.</div>
          </div>
        </template>

        <!-- About -->
        <template v-else-if="activeTab === 'about'">
          <div style="text-align:center;padding:40px 20px;">
            <div style="width:80px;height:80px;border-radius:20px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.18);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;overflow:hidden;">
              <img v-if="company.logoUrl" :src="company.logoUrl" style="width:70px;height:70px;object-fit:contain;border-radius:12px;" onerror="this.style.display='none'" />
              <svg v-else width="40" height="40" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="8" height="18" rx="1.5" fill="rgba(99,102,241,0.9)"/>
                <rect x="13" y="3" width="8" height="11" rx="1.5" fill="rgba(168,85,247,0.7)"/>
                <rect x="13" y="16" width="8" height="5" rx="1.5" fill="rgba(99,102,241,0.5)"/>
              </svg>
            </div>
            <div style="font-size:22px;font-weight:700;color:var(--ct-primary);margin-bottom:4px;">{{ company.name || 'MicroElev EMS' }}</div>
            <div style="font-size:14px;color:var(--ct-muted);margin-bottom:4px;">Version 3.0.0</div>
            <div style="font-size:13px;color:var(--ct-muted);margin-bottom:24px;">Elevator Management System</div>
            <div class="glass" style="padding:20px;text-align:left;max-width:400px;margin:0 auto;">
              <div style="font-size:12px;color:var(--ct-muted);line-height:1.9;">
                <div v-if="company.email">Email: <span style="color:var(--ct-sub);">{{ company.email }}</span></div>
                <div v-if="company.phone">Phone: <span style="color:var(--ct-sub);">{{ company.phone }}</span></div>
                <div v-if="company.gst">GST: <span style="color:var(--ct-sub);">{{ company.gst }}</span></div>
                <div v-if="company.website">Website: <span style="color:var(--ct-sub);">{{ company.website }}</span></div>
                <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">
                  Logged in as: <span style="color:var(--ct-accent);font-weight:600;">{{ auth.user?.fullName || auth.user?.username }}</span>
                  <span style="color:var(--ct-muted);"> ({{ auth.role }})</span>
                </div>
              </div>
            </div>
            <button class="btn-danger" style="margin-top:20px;" @click="logout">
              <LogOut :size="14" /> Sign Out
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Add/Edit User Modal -->
    <AppModal v-model="showUserModal" :title="editingUser ? 'Edit User' : 'Add User'" width="560px">
      <div class="form-grid">
        <div class="form-group">
          <label class="label">Full Name *</label>
          <input v-model="userForm.fullName" class="input" placeholder="Full name" />
        </div>
        <div class="form-group">
          <label class="label">Username *</label>
          <input v-model="userForm.username" class="input" placeholder="username" />
        </div>
        <div class="form-group">
          <label class="label">Email</label>
          <input v-model="userForm.email" class="input" type="email" placeholder="user@company.com" />
        </div>
        <div class="form-group">
          <label class="label">Phone</label>
          <input v-model="userForm.phone" class="input" placeholder="+91…" />
        </div>
        <div class="form-group">
          <label class="label">Role</label>
          <select v-model="userForm.role" class="input">
            <option value="admin">Admin</option>
            <option value="sales">Sales</option>
            <option value="technician">Technician</option>
            <option value="reception">Reception</option>
            <option value="user">User</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">Status</label>
          <select v-model="userForm.status" class="input">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div class="form-group" v-if="!editingUser">
          <label class="label">Password *</label>
          <input v-model="userForm.password" class="input" type="password" placeholder="Set password" />
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showUserModal = false">Cancel</button>
        <button class="btn-primary" @click="saveUser" :disabled="savingUser">
          {{ savingUser ? 'Saving…' : (editingUser ? 'Update User' : 'Create User') }}
        </button>
      </template>
    </AppModal>

    <!-- Admin Auth Modal (shared for backup & restore) -->
    <AppModal v-model="showAuthModal" title="Admin Verification Required" :subtitle="pendingAction === 'restore' ? 'Restore will overwrite all current data' : 'Confirm your identity to create a backup'" width="420px">
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div style="padding:10px 14px;background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.2);border-radius:10px;font-size:13px;color:#fbbf24;display:flex;align-items:center;gap:8px;">
          <ShieldAlert :size="15" style="flex-shrink:0;" />
          {{ pendingAction === 'restore'
            ? 'This will delete all current data and replace it with the backup. This cannot be undone.'
            : 'Backup will read all collections and download a ZIP + save to Firestore.' }}
        </div>
        <div class="form-group">
          <label class="label">Admin Username</label>
          <input v-model="authUsername" class="input" placeholder="Your admin username" autocomplete="off" />
        </div>
        <div class="form-group">
          <label class="label">Admin Password</label>
          <input v-model="authPassword" class="input" type="password" placeholder="Your admin password" @keyup.enter="pendingAction === 'restore' ? proceedToRestoreConfirm() : executeBackup()" />
        </div>
        <div v-if="authError" style="font-size:12px;color:#f87171;padding:6px 10px;background:rgba(248,113,113,0.08);border-radius:8px;">{{ authError }}</div>

        <!-- Extra confirmation for restore: must type RESTORE -->
        <template v-if="pendingAction === 'restore'">
          <div style="margin-top:4px;padding:12px 14px;background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.2);border-radius:10px;">
            <div style="font-size:12px;color:#f87171;margin-bottom:8px;font-weight:600;">Type <code style="background:rgba(248,113,113,0.15);padding:1px 5px;border-radius:4px;">RESTORE</code> to confirm</div>
            <input v-model="restoreConfirmText" class="input" placeholder="Type RESTORE here" style="font-family:monospace;" />
          </div>
        </template>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showAuthModal = false">Cancel</button>
        <button
          v-if="pendingAction === 'backup'"
          class="btn-primary"
          :disabled="authChecking"
          @click="executeBackup"
        >
          <HardDriveDownload :size="14" /> {{ authChecking ? 'Verifying…' : 'Start Backup' }}
        </button>
        <button
          v-else
          class="btn-danger"
          :disabled="authChecking || restoreConfirmText !== 'RESTORE'"
          @click="executeRestore"
        >
          <HardDriveUpload :size="14" /> {{ authChecking ? 'Verifying…' : 'Confirm Restore' }}
        </button>
      </template>
    </AppModal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  Settings, UserPlus, Pencil, Users, Lock, Key, LogOut,
  User, Info, Database, HardDriveDownload, HardDriveUpload,
  RefreshCw, Loader2, ShieldOff, ShieldAlert, EyeOff,
} from 'lucide-vue-next'
import AppModal from '@/components/ui/AppModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useUIStore } from '@/stores/ui'
import { useDbMaskStore } from '@/stores/dbMask'
import { useCollection } from '@/composables/useCollection'
import { useCompanyConfig } from '@/composables/useCompanyConfig'
import { Collections } from '@/firebase/collections'
import { update } from '@/firebase/firestore'
import { useRouter } from 'vue-router'
import {
  BACKUP_COLLECTIONS, runBackup, runRestore, getLatestBackup, verifyAdminPassword,
} from '@/utils/backup'

const auth      = useAuthStore()
const ui        = useUIStore()
const maskStore = useDbMaskStore()
const router    = useRouter()
const { company, load: loadCompany } = useCompanyConfig()

const { items: userItems, add: addUser, edit: editUser } = useCollection(Collections.USERS)
const { items: empItems } = useCollection(Collections.EMPLOYEES)

const activeTab = ref('users')

// ── Password change ────────────────────────────────────────────────────────────
const savingPwd     = ref(false)
const currentPassword  = ref('')
const newPassword      = ref('')
const confirmPassword  = ref('')
const showCurrentPwd   = ref(false)
const showNewPwd       = ref(false)
const showConfirmPwd   = ref(false)

// ── User management ────────────────────────────────────────────────────────────
const savingUser   = ref(false)
const showUserModal = ref(false)
const editingUser  = ref(null)

// ── Backup state ───────────────────────────────────────────────────────────────
const lastBackup        = ref(null)
const loadingBackupMeta = ref(false)
const backupProgress    = ref('')  // non-empty while running
const pendingAction     = ref('')  // 'backup' | 'restore'

// Auth modal
const showAuthModal       = ref(false)
const authUsername        = ref('')
const authPassword        = ref('')
const authError           = ref('')
const authChecking        = ref(false)
const restoreConfirmText  = ref('')

const tabs = [
  { key: 'users',    label: 'Users',    icon: Users },
  { key: 'password', label: 'Password', icon: Key },
  { key: 'backup',   label: 'Backup',   icon: Database },
  { key: 'mask',     label: 'Mask DB',  icon: EyeOff },
  { key: 'about',    label: 'About',    icon: Info },
]

const allUsers = computed(() => userItems.value)

onMounted(async () => {
  loadCompany()
  loadLastBackup()
})

async function loadLastBackup() {
  loadingBackupMeta.value = true
  try { lastBackup.value = await getLatestBackup() }
  catch { /* no backup yet */ }
  finally { loadingBackupMeta.value = false }
}

// ── Auth modal ─────────────────────────────────────────────────────────────────
function openAuthModal(action) {
  pendingAction.value     = action
  authUsername.value      = auth.user?.username || ''
  authPassword.value      = ''
  authError.value         = ''
  restoreConfirmText.value = ''
  showAuthModal.value     = true
}

async function verifyAndRun(fn) {
  authError.value   = ''
  authChecking.value = true
  try {
    const ok = await verifyAdminPassword(authUsername.value, authPassword.value)
    if (!ok) { authError.value = 'Invalid admin credentials.'; return false }
    showAuthModal.value = false
    await fn()
    return true
  } catch (e) {
    authError.value = e.message || 'Verification failed.'
    return false
  } finally {
    authChecking.value = false
  }
}

async function executeBackup() {
  await verifyAndRun(async () => {
    try {
      await runBackup(auth.user?.fullName || auth.user?.username, (msg) => {
        backupProgress.value = msg
      })
      backupProgress.value = ''
      await loadLastBackup()
      ui.success('Backup complete — ZIP downloaded and saved to Firestore.')
    } catch (e) {
      backupProgress.value = ''
      ui.error('Backup failed: ' + e.message)
    }
  })
}

async function executeRestore() {
  if (restoreConfirmText.value !== 'RESTORE') { authError.value = 'You must type RESTORE to confirm.'; return }
  await verifyAndRun(async () => {
    try {
      const backup = await runRestore((msg) => { backupProgress.value = msg })
      backupProgress.value = ''
      await loadLastBackup()
      ui.success(`Restore complete — database rolled back to backup from ${formatDateTime(backup.createdAt)}.`)
    } catch (e) {
      backupProgress.value = ''
      ui.error('Restore failed: ' + e.message)
    }
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatDateTime(ts) {
  if (!ts) return '—'
  const d = ts?.toDate ? ts.toDate() : new Date(ts)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Password change ────────────────────────────────────────────────────────────
async function changePassword() {
  if (!currentPassword.value) return ui.error('Enter your current password')
  if (!newPassword.value) return ui.error('Enter a new password')
  if (newPassword.value.length < 6) return ui.error('Password must be at least 6 characters')
  if (newPassword.value !== confirmPassword.value) return ui.error('Passwords do not match')
  savingPwd.value = true
  try {
    const userId  = auth.user?.id
    const inUsers = userItems.value.find(u => u.id === userId)
    const inEmps  = empItems.value.find(e => e.id === userId)
    const isEmployee = !!inEmps && !inUsers
    const storedPwd  = isEmployee ? inEmps?.password : inUsers?.password
    if (storedPwd && storedPwd !== currentPassword.value) return ui.error('Current password is incorrect')
    const col = isEmployee ? Collections.EMPLOYEES : Collections.USERS
    await update(col, userId, { password: newPassword.value })
    currentPassword.value = ''; newPassword.value = ''; confirmPassword.value = ''
    ui.success('Password updated successfully')
  } catch { ui.error('Update failed. Please try again.') }
  finally { savingPwd.value = false }
}

// ── User management ────────────────────────────────────────────────────────────
const emptyUserForm = () => ({ fullName: '', username: '', email: '', phone: '', role: 'user', status: 'active', password: '' })
const userForm = ref(emptyUserForm())

function openAddUser() { editingUser.value = null; userForm.value = emptyUserForm(); showUserModal.value = true }
function openEditUser(u) { editingUser.value = u; userForm.value = { ...emptyUserForm(), ...u, password: '' }; showUserModal.value = true }

async function saveUser() {
  if (!userForm.value.fullName || !userForm.value.username) return ui.error('Name and username required')
  savingUser.value = true
  try {
    const data = { ...userForm.value }
    if (editingUser.value) {
      if (!data.password) delete data.password
      await editUser(editingUser.value.id, data, `Updated user ${data.username}`)
      ui.success('User updated')
    } else {
      if (!data.password) return ui.error('Password required for new users')
      await addUser(data, `Created user ${data.username}`)
      ui.success('User created')
    }
    showUserModal.value = false
  } catch { ui.error('Save failed') }
  finally { savingUser.value = false }
}

function logout() { auth.logout(); router.push('/login') }
const getInitials = (n) => (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
const roleBadge = (r) => ({ admin: 'badge-danger', sales: 'badge-info', technician: 'badge-warning', reception: 'badge-blue', user: 'badge-inactive' }[r] || 'badge-inactive')
</script>

<style scoped>
.page-container { padding: 28px; }
.settings-nav-btn {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 10px 12px; border-radius: 10px;
  font-size: 13px; font-weight: 500; color:var(--ct-muted);
  background: transparent; border: none; cursor: pointer;
  transition: all 0.15s; text-align: left; margin-bottom: 2px;
}
.settings-nav-btn:hover { background: rgba(255,255,255,0.05); color:var(--ct-sub); }
.settings-nav-btn.active { background: rgba(99,102,241,0.12); color:var(--ct-accent); border: 1px solid rgba(99,102,241,0.18); }

.user-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px; border-radius: 12px; margin-bottom: 8px;
  background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.05);
}
.user-av-lg {
  width: 38px; height: 38px; border-radius: 10px;
  background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.3));
  border: 1px solid rgba(99,102,241,0.2);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; color:var(--ct-accent); flex-shrink: 0;
}

/* ── Backup tab ────────────────────────────────────────────────────── */
.backup-status-card {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 14px 18px; border-radius: 14px; margin-bottom: 8px;
}
.backup-ok   { background: rgba(16,185,129,0.07); border: 1px solid rgba(16,185,129,0.22); color: #4ade80; }
.backup-none { background: rgba(245,158,11,0.07); border: 1px solid rgba(245,158,11,0.22); color: #fbbf24; }

.backup-progress-bar {
  margin-top: 16px;
  padding: 12px 16px;
  background: rgba(99,102,241,0.06);
  border: 1px solid rgba(99,102,241,0.18);
  border-radius: 12px;
}
.progress-fill {
  height: 4px;
  background: linear-gradient(90deg, #6366f1, #a855f7);
  border-radius: 99px;
  animation: progress-slide 1.5s ease-in-out infinite;
  width: 60%;
}
@keyframes progress-slide {
  0%   { transform: translateX(-100%); width: 40%; }
  50%  { width: 70%; }
  100% { transform: translateX(250%); width: 40%; }
}

.backup-action-card {
  display: flex; align-items: flex-start; gap: 16px;
  padding: 18px 20px; border-radius: 16px;
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07);
}
.restore-card { border-color: rgba(248,113,113,0.15); background: rgba(248,113,113,0.03); }
.backup-action-icon {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.backup-icon-blue { background: rgba(99,102,241,0.15); color: #818cf8; border: 1px solid rgba(99,102,241,0.25); }
.backup-icon-red  { background: rgba(248,113,113,0.12); color: #f87171; border: 1px solid rgba(248,113,113,0.2); }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Mask toggle ────────────────────────────────────────────────── */
.mask-toggle-btn {
  width: 50px; height: 28px; border-radius: 14px; flex-shrink: 0;
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15);
  cursor: pointer; position: relative;
  transition: background 0.2s ease, border-color 0.2s ease;
  padding: 0;
}
.mask-toggle-btn.mask-toggle-on {
  background: rgba(220,38,38,0.35);
  border-color: rgba(220,38,38,0.5);
}
.mask-toggle-knob {
  width: 22px; height: 22px; border-radius: 11px;
  background: #fff; position: absolute; top: 2px; left: 2px;
  transition: transform 0.2s ease;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}
.mask-toggle-on .mask-toggle-knob {
  transform: translateX(22px);
}

/* ── Layout ───────────────────────────────────────────────────────── */
.settings-layout {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 24px;
  align-items: start;
}
.settings-sidebar { padding: 8px; }

@media (max-width: 640px) {
  .page-container { padding: 14px 12px 32px; }

  .settings-layout {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .settings-sidebar {
    padding: 6px !important;
    display: flex !important;
    flex-wrap: nowrap;
    overflow-x: auto;
    gap: 4px;
    -webkit-overflow-scrolling: touch;
  }

  .settings-nav-btn {
    flex-shrink: 0;
    white-space: nowrap;
    width: auto !important;
    padding: 7px 12px;
    font-size: 11.5px;
    margin-bottom: 0 !important;
    border-radius: 8px;
  }

  .backup-action-card {
    flex-direction: column;
    gap: 12px;
  }

  .backup-status-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .user-row {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
