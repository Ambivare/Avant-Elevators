import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/lift',
    name: 'LiftTicket',
    component: () => import('@/views/public/LiftTicketView.vue'),
    meta: { public: true },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/create-admin-user',
    name: 'CreateAdmin',
    component: () => import('@/views/admin/CreateAdminView.vue'),
    meta: { public: true },
  },
  {
    path: '/delete-all',
    name: 'DeleteAll',
    component: () => import('@/views/admin/DeleteAllView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('@/components/layout/AppShell.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: () => localStorage.getItem('me_pinned_tab') || '/dashboard' },
      { path: 'dashboard',     name: 'Dashboard',     component: () => import('@/views/dashboard/DashboardView.vue'),         meta: { tab: 'dashboard' } },
      { path: 'warehouse',     name: 'Warehouse',     component: () => import('@/views/inventory/InventoryView.vue'),         meta: { tab: 'warehouse', location: 'warehouse' } },
      { path: 'service-van',   name: 'ServiceVan',    component: () => import('@/views/inventory/InventoryView.vue'),         meta: { tab: 'service-van', location: 'service-van' } },
      { path: 'office',        name: 'Office',        component: () => import('@/views/inventory/InventoryView.vue'),         meta: { tab: 'office', location: 'office' } },
      { path: 'dispatch',      name: 'Dispatch',      component: () => import('@/views/dispatch/DispatchView.vue'),             meta: { tab: 'dispatch' } },
      { path: 'projects',      name: 'Projects',      component: () => import('@/views/projects/ProjectsView.vue'),           meta: { tab: 'projects' } },
      { path: 'maintenance',   name: 'Maintenance',   component: () => import('@/views/maintenance/MaintenanceView.vue'),     meta: { tab: 'maintenance' } },
      { path: 'repairs',       name: 'Repairs',       component: () => import('@/views/repairs/RepairsView.vue'),             meta: { tab: 'repairs' } },
      { path: 'complaints',    name: 'Complaints',    component: () => import('@/views/complaints/ComplaintsView.vue'),       meta: { tab: 'complaints' } },
      { path: 'installation',  name: 'Installation',  component: () => import('@/views/installation/InstallationView.vue'),   meta: { tab: 'installation' } },
      { path: 'modernisation', name: 'Modernisation', component: () => import('@/views/modernisation/ModernisationView.vue'), meta: { tab: 'modernisation' } },
      { path: 'amc',           name: 'AMC',           component: () => import('@/views/amc/AMCView.vue'),                     meta: { tab: 'amc' } },
      { path: 'tasks',         name: 'Tasks',         component: () => import('@/views/tasks/TasksView.vue'),                 meta: { tab: 'tasks' } },
      { path: 'tracking',      name: 'Tracking',      component: () => import('@/views/tracking/TrackingView.vue'),           meta: { tab: 'tracking' } },
      { path: 'billing',       name: 'Billing',       component: () => import('@/views/billing/BillingView.vue'),             meta: { tab: 'billing' } },
      { path: 'sales',         name: 'Sales',         component: () => import('@/views/sales/SalesView.vue'),                 meta: { tab: 'sales' } },
      { path: 'activities',    name: 'Activities',    component: () => import('@/views/activities/ActivitiesView.vue'),       meta: { tab: 'activities' } },
      { path: 'hr',            name: 'HR',            component: () => import('@/views/hr/HRView.vue'),                                   meta: { tab: 'hr' } },
      { path: 'attendance',    name: 'Attendance',    component: () => import('@/views/attendance/AttendanceView.vue'),                 meta: { tab: 'attendance' } },
      { path: 'leave',         name: 'Leave',         component: () => import('@/views/leave/LeaveView.vue'),                           meta: { tab: 'leave' } },
      { path: 'salary',        name: 'Salary',        component: () => import('@/views/hr/SalaryView.vue'),                              meta: { tab: 'salary' } },
      { path: 'vendors',       name: 'Vendors',       component: () => import('@/views/vendors/VendorsView.vue'),             meta: { tab: 'vendors' } },
      { path: 'bom',           name: 'BOM',           component: () => import('@/views/bom/BOMView.vue'),                     meta: { tab: 'bom' } },
      { path: 'settings',        name: 'Settings',        component: () => import('@/views/settings/SettingsView.vue'),                   meta: { tab: 'settings' } },
      { path: 'configurations',  name: 'Configurations',  component: () => import('@/views/configurations/ConfigurationsView.vue'),       meta: { tab: 'configurations' } },
      { path: 'gallery',         name: 'Gallery',         component: () => import('@/views/gallery/GalleryView.vue'),                     meta: { tab: 'gallery' } },
      { path: 'ai-assistant',    name: 'AIAssistant',     component: () => import('@/views/ai-assistant/AIAssistantView.vue'),            meta: { tab: 'ai-assistant' } },
      { path: 'inspection',      name: 'Inspection',      component: () => import('@/views/inspection/InspectionView.vue'),               meta: { tab: 'inspection' } },
      { path: 'lifts',           name: 'Lifts',           component: () => import('@/views/lifts/LiftsView.vue'),                           meta: { tab: 'lifts' } },
      { path: 'reminders',      name: 'Reminders',      component: () => import('@/views/reminders/RemindersView.vue'),                  meta: { tab: 'reminders' } },
      { path: 'tickets',        name: 'Tickets',        component: () => import('@/views/tickets/TicketsView.vue'),                       meta: { tab: 'tickets' } },
      { path: 'licenses',       name: 'Licenses',       component: () => import('@/views/licenses/LicensesView.vue'),                      meta: { tab: 'licenses' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  try {
    if (!auth.isLoggedIn) auth.loadSession()
  } catch { /* ignore corrupted session */ }

  if (to.meta.public) return next()
  if (!auth.isLoggedIn) return next('/login')

  // tracking access is managed dynamically via configurations — skip hardcoded role check
  if (to.meta.tab === 'tracking') return next()

  if (to.meta.tab && !auth.canAccess(to.meta.tab)) {
    return next('/dashboard')
  }

  next()
})

export default router
