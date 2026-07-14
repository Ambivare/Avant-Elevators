<template>
  <div class="tech-dash">
    <div class="stats-grid">
      <StatCard icon="CheckSquare" color="indigo" :value="stats.pendingTasks" label="My Tasks" />
      <StatCard icon="MessageSquareWarning" color="amber" :value="stats.openComplaints" label="Complaints" />
      <StatCard icon="Shield" color="purple" :value="stats.activeAMC" label="Active AMC" />
      <StatCard icon="MapPin" color="emerald" label="Location" value="Online" />
    </div>
    <div class="quick-links">
      <router-link to="/tasks" class="quick-link-card"><CheckSquare :size="20" /><span>My Tasks</span></router-link>
      <router-link to="/installation" class="quick-link-card"><Zap :size="20" /><span>Installation</span></router-link>
      <router-link to="/repairs" class="quick-link-card"><Wrench :size="20" /><span>Repairs</span></router-link>
      <router-link to="/tracking" class="quick-link-card"><MapPin :size="20" /><span>Tracking</span></router-link>
    </div>
  </div>
</template>
<script setup>
import StatCard from './StatCard.vue'
import { CheckSquare, Zap, Wrench, MapPin } from 'lucide-vue-next'
defineProps({ stats: Object })
</script>
<style scoped>
.tech-dash { display: flex; flex-direction: column; gap: 24px; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.quick-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.quick-link-card { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; color:var(--ct-sub); text-decoration: none; font-size: 13px; font-weight: 500; transition: all 0.2s; }
.quick-link-card:hover { background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.2); color:var(--ct-accent); }
</style>
