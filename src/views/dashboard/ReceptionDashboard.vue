<template>
  <div class="dash">
    <div class="stats-grid">
      <StatCard icon="MessageSquareWarning" color="amber" :value="stats.openComplaints" label="Open Complaints" />
      <StatCard icon="CheckSquare" color="indigo" :value="stats.pendingTasks" label="Tasks" />
      <StatCard icon="FolderOpen" color="emerald" :value="stats.totalProjects" label="Projects" />
    </div>
    <div class="quick-links">
      <router-link to="/complaints" class="ql"><MessageSquareWarning :size="20" /><span>Log Complaint</span></router-link>
      <router-link to="/tasks" class="ql"><CheckSquare :size="20" /><span>Tasks</span></router-link>
      <router-link to="/projects" class="ql"><FolderOpen :size="20" /><span>Projects</span></router-link>
    </div>
  </div>
</template>
<script setup>
import StatCard from './StatCard.vue'
import { MessageSquareWarning, CheckSquare, FolderOpen } from 'lucide-vue-next'
defineProps({ stats: Object })
</script>
<style scoped>
.dash { display: flex; flex-direction: column; gap: 24px; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.quick-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.ql { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 24px 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; color:var(--ct-sub); text-decoration: none; font-size: 13px; font-weight: 500; transition: all 0.2s; }
.ql:hover { background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.2); color:var(--ct-accent); }
</style>
