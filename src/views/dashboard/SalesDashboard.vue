<template>
  <div class="sales-dash">
    <div class="stats-grid">
      <StatCard icon="TrendingUp" color="indigo" :value="stats.totalLeads" label="Total Leads" :sub="`${stats.activeLeads} active`" />
      <StatCard icon="FolderOpen" color="emerald" :value="stats.totalProjects" label="Projects" :sub="`${stats.activeProjects} active`" />
      <StatCard icon="Shield" color="purple" :value="stats.totalAMC" label="AMC Contracts" :sub="`${stats.activeAMC} active`" />
      <StatCard icon="Receipt" color="blue" :value="stats.pendingTasks" label="Pending Tasks" />
    </div>
    <div class="quick-links">
      <router-link to="/sales" class="quick-link-card">
        <TrendingUp :size="20" /> <span>Sales Pipeline</span>
      </router-link>
      <router-link to="/billing" class="quick-link-card">
        <Receipt :size="20" /> <span>Create Invoice</span>
      </router-link>
      <router-link to="/projects" class="quick-link-card">
        <FolderOpen :size="20" /> <span>Projects</span>
      </router-link>
      <router-link to="/amc" class="quick-link-card">
        <Shield :size="20" /> <span>AMC Renewals</span>
      </router-link>
    </div>
  </div>
</template>
<script setup>
import StatCard from './StatCard.vue'
import { TrendingUp, Receipt, FolderOpen, Shield } from 'lucide-vue-next'
defineProps({ stats: Object })
</script>
<style scoped>
.sales-dash { display: flex; flex-direction: column; gap: 24px; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.quick-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.quick-link-card {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 24px 16px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  color:var(--ct-sub); text-decoration: none;
  font-size: 13px; font-weight: 500;
  transition: all 0.2s;
}
.quick-link-card:hover { background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.2); color:var(--ct-accent); }
</style>
