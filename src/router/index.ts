import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/HomeView.vue'),
        },
        {
          path: 'companies',
          name: 'companies',
          component: () => import('@/views/CompaniesView.vue'),
        },
        {
          path: 'contacts',
          name: 'contacts',
          component: () => import('@/views/ContactsView.vue'),
        },
        {
          path: 'contacts/create',
          name: 'create-contact',
          component: () => import('@/views/ContactDetailsView.vue'),
        },
        {
          path: 'contacts/:id',
          name: 'contact-details',
          component: () => import('@/views/ContactDetailsView.vue'),
          props: true,
        },
        {
          path: 'opportunities',
          name: 'opportunities',
          component: () => import('@/views/OpportunitiesView.vue'),
        },
        {
          path: 'opportunities/create',
          name: 'create-opportunity',
          component: () => import('@/views/OpportunityDetailsView.vue'),
        },
        {
          path: 'opportunities/:id',
          name: 'opportunity-details',
          component: () => import('@/views/OpportunityDetailsView.vue'),
          props: true,
        },
        {
          path: 'rfps',
          name: 'rfps',
          component: () => import('@/views/RfpsView.vue'),
        },
        {
          path: 'rfps/create',
          name: 'create-rfp',
          component: () => import('@/views/RfpDetailsView.vue'),
        },
        {
          path: 'rfps/:id',
          name: 'rfp-details',
          component: () => import('@/views/RfpDetailsView.vue'),
          props: true,
        },
        {
          path: 'tasks',
          name: 'tasks',
          component: () => import('@/views/TasksView.vue'),
        },
        {
          path: 'notes',
          name: 'notes',
          component: () => import('@/views/NotesView.vue'),
        },
        {
          path: 'kb',
          name: 'kb-articles',
          component: () => import('@/views/KbArticlesView.vue'),
        },
        {
          path: 'products-services',
          name: 'products-services',
          component: () => import('@/views/ProductsServicesView.vue'),
        },
        {
          path: 'companies/create',
          name: 'create-company',
          component: () => import('@/views/CompanyDetailsView.vue'),
        },
        {
          path: 'companies/:id',
          name: 'company-details',
          component: () => import('@/views/CompanyDetailsView.vue'),
          props: true,
        },
        {
          path: 'settings',
          name: 'profile-settings',
          component: () => import('@/views/ProfileSettingsView.vue'),
        },
        {
          path: 'admin/settings',
          name: 'admin-settings',
          component: () => import('@/views/admin/AdminSettingsView.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'admin/contact-names',
          name: 'admin-contact-names',
          component: () => import('@/views/admin/AdminContactNamesView.vue'),
          meta: { requiresAdmin: true },
        },
        {
          path: 'admin/algolia-reindex',
          name: 'admin-algolia-reindex',
          component: () => import('@/views/admin/AdminAlgoliaReindexView.vue'),
          meta: { requiresAdmin: true },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.ready) {
    await auth.init()
  }

  if (to.meta.public) {
    if (auth.isAuthenticated && to.name === 'login') {
      return { name: 'home' }
    }
    return true
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return { name: 'home' }
  }

  return true
})

export default router
