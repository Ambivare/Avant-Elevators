<template>
  <div v-if="modelValue" class="pp-overlay" role="dialog" aria-modal="true" aria-labelledby="pp-title">
    <div class="pp-sheet glass-strong">
      <div class="pp-head">
        <div class="pp-badge"><ShieldCheck :size="26" /></div>
        <h2 id="pp-title" class="pp-title">Why Do We Ask for Permissions?</h2>
        <p class="pp-sub">To provide the best experience and enable essential features, our app requires the following permissions:</p>
      </div>

      <div class="pp-list">
        <div class="pp-row">
          <div class="pp-icon"><Bell :size="18" /></div>
          <div class="pp-body">
            <h3>Notifications</h3>
            <p>Used to provide persistent notifications for location tracking, attendance updates, reminders, and other important alerts.</p>
          </div>
        </div>

        <div class="pp-row">
          <div class="pp-icon"><Camera :size="18" /></div>
          <div class="pp-body">
            <h3>Camera</h3>
            <ul>
              <li>Capture selfies for attendance verification</li>
              <li>Take site images and photos required for work-related activities</li>
            </ul>
          </div>
        </div>

        <div class="pp-row">
          <div class="pp-icon"><FolderOpen :size="18" /></div>
          <div class="pp-body">
            <h3>Storage</h3>
            <ul>
              <li>Upload site images and signatures</li>
              <li>Download and save receipts, reports, and other records</li>
            </ul>
          </div>
        </div>

        <div class="pp-row">
          <div class="pp-icon"><Phone :size="18" /></div>
          <div class="pp-body">
            <h3>Calls</h3>
            <ul>
              <li>Call clients directly from within the app</li>
              <li>Automatically fetch relevant client call details, limited to the specific client number associated with the activity</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="pp-foot">
        <button class="btn-primary w-full justify-center" type="button" @click="$emit('continue')">
          <Check :size="15" /> Continue
        </button>
        <p class="pp-fine">You can change any of these later in your device settings.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ShieldCheck, Bell, Camera, FolderOpen, Phone, Check } from 'lucide-vue-next'

defineProps({ modelValue: { type: Boolean, default: false } })
defineEmits(['continue'])
</script>

<style scoped>
.pp-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(4, 6, 12, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  padding-top: calc(20px + env(safe-area-inset-top, 0px));
  padding-bottom: calc(20px + env(safe-area-inset-bottom, 0px));
}

.pp-sheet {
  width: 100%;
  max-width: 420px;
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 20px;
  animation: pp-rise 320ms cubic-bezier(.2, .8, .2, 1) both;
}

@media (prefers-reduced-motion: reduce) {
  .pp-sheet { animation: none; }
}

@keyframes pp-rise {
  from { opacity: 0; transform: translateY(14px) scale(.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.pp-head {
  padding: 26px 24px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.pp-badge {
  width: 48px;
  height: 48px;
  margin: 0 auto 14px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(220, 38, 38, 0.12);
  border: 1px solid rgba(220, 38, 38, 0.25);
  color: #f87171;
}

.pp-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--ct-primary);
  margin: 0 0 8px;
  text-wrap: balance;
}

.pp-sub {
  font-size: 0.86rem;
  line-height: 1.55;
  color: var(--ct-muted);
  margin: 0;
  max-width: 32ch;
  margin-inline: auto;
}

.pp-list { padding: 4px 8px; }

.pp-row {
  display: flex;
  gap: 12px;
  padding: 14px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.pp-row:last-child { border-bottom: none; }

.pp-icon {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ct-sub);
}

.pp-body { flex: 1; min-width: 0; }
.pp-body h3 { font-size: 0.92rem; font-weight: 600; color: var(--ct-primary); margin: 2px 0 4px; }
.pp-body p { font-size: 0.82rem; line-height: 1.5; color: var(--ct-muted); margin: 0; }
.pp-body ul { margin: 2px 0 0; padding-left: 16px; font-size: 0.82rem; line-height: 1.55; color: var(--ct-muted); }
.pp-body li::marker { color: #dc2626; }

.pp-foot { padding: 16px 20px 22px; }
.pp-fine { text-align: center; margin: 10px 0 0; font-size: 0.72rem; color: var(--ct-muted); opacity: 0.8; }
.w-full { width: 100%; }
.justify-center { justify-content: center; }
</style>
