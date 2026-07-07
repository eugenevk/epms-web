<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
import AppToast from '@/components/AppToast.vue'
import LogoutIcon from '@/components/LogoutIcon.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const mobileNavOpen = ref(false)
const userMenuOpen = ref(false)
const adminMenuOpen = ref(false)

const navLinks = [
  { name: 'home', label: 'Home', path: '/' },
  { name: 'companies', label: 'Companies', path: '/companies' },
  { name: 'contacts', label: 'Contacts', path: '/contacts' },
  { name: 'opportunities', label: 'Opportunities', path: '/opportunities' },
  { name: 'rfps', label: 'RFPs', path: '/rfps' },
  { name: 'tasks', label: 'Tasks', path: '/tasks' },
  { name: 'notes', label: 'Notes', path: '/notes' },
  { name: 'products-services', label: 'Products & Services', path: '/products-services' },
  { name: 'kb-articles', label: 'Knowledge Base', path: '/kb' },
] as const

const adminLinks = [
  { name: 'admin-settings', label: 'Application settings' },
  { name: 'admin-contact-names', label: 'Contact names' },
  { name: 'admin-algolia-reindex', label: 'Algolia re-index' },
] as const

const navLinkClass =
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium text-epms-800 transition hover:bg-epms-50'

const userMenuButtonClass =
  'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-epms-50 hover:text-epms-800'

const mobileNavLinkClass =
  'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-epms-800 transition hover:bg-epms-50'

const mobileSubLinkClass =
  'flex w-full items-center gap-2 rounded-lg py-2 pl-9 pr-3 text-sm text-stone-700 transition hover:bg-epms-50'

const navIconClass = 'h-4 w-4 shrink-0'

function closeMenus() {
  userMenuOpen.value = false
  adminMenuOpen.value = false
  mobileNavOpen.value = false
}

function isNavLinkActive(link: (typeof navLinks)[number]): boolean {
  if (link.name === 'home') {
    return route.name === 'home'
  }

  if (link.name === 'companies') {
    return (
      route.name === 'companies' ||
      route.name === 'create-company' ||
      route.name === 'company-details'
    )
  }

  if (link.name === 'contacts') {
    return (
      route.name === 'contacts' ||
      route.name === 'create-contact' ||
      route.name === 'contact-details'
    )
  }

  if (link.name === 'opportunities') {
    return (
      route.name === 'opportunities' ||
      route.name === 'create-opportunity' ||
      route.name === 'opportunity-details'
    )
  }

  if (link.name === 'rfps') {
    return (
      route.name === 'rfps' ||
      route.name === 'create-rfp' ||
      route.name === 'rfp-details'
    )
  }

  if (link.name === 'tasks') {
    return route.name === 'tasks'
  }

  if (link.name === 'notes') {
    return route.name === 'notes'
  }

  if (link.name === 'kb-articles') {
    return route.name === 'kb-articles'
  }

  if (link.name === 'products-services') {
    return route.name === 'products-services'
  }

  return false
}

function toggleMobileNav() {
  mobileNavOpen.value = !mobileNavOpen.value
  if (mobileNavOpen.value) {
    userMenuOpen.value = false
    adminMenuOpen.value = false
  }
}

function closeMobileNav() {
  mobileNavOpen.value = false
}

function isDesktopNav() {
  return window.matchMedia('(min-width: 1024px)').matches
}

function openUserMenuOnHover() {
  if (isDesktopNav()) userMenuOpen.value = true
}

function closeUserMenuOnHover() {
  if (isDesktopNav()) userMenuOpen.value = false
}

function openAdminMenuOnHover() {
  if (isDesktopNav()) adminMenuOpen.value = true
}

function closeAdminMenuOnHover() {
  if (isDesktopNav()) adminMenuOpen.value = false
}

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value
  if (userMenuOpen.value) adminMenuOpen.value = false
}

function toggleAdminMenu() {
  adminMenuOpen.value = !adminMenuOpen.value
  if (adminMenuOpen.value) userMenuOpen.value = false
}

function onDocumentClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (!target?.closest('[data-user-menu]')) userMenuOpen.value = false
  if (!target?.closest('[data-admin-menu]')) adminMenuOpen.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMenus()
}

async function handleLogout() {
  closeMenus()
  await auth.logout()
  await router.push({ name: 'login' })
}

watch(
  () => route.fullPath,
  () => {
    closeMenus()
  },
)

watch(mobileNavOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="min-h-screen w-full max-w-full overflow-x-clip bg-stone-50 font-sans">
    <AppToast />

    <header class="border-b border-stone-200 bg-white">
      <div class="flex w-full min-w-0 items-center gap-2 px-4 py-3 sm:gap-4 sm:px-6">
        <div class="flex min-w-0 shrink-0 items-center gap-3">
          <button
            type="button"
            class="rounded-lg p-2 text-stone-600 hover:bg-stone-100 lg:hidden"
            aria-label="Menu"
            @click="toggleMobileNav"
          >
            <FontAwesomeIcon icon="bars" class="h-5 w-5" />
          </button>
          <RouterLink to="/" class="flex min-w-0 items-center gap-2 font-semibold text-epms-800">
            <AppLogo :size="32" show-background class="shrink-0" />
            <span class="hidden whitespace-nowrap text-sm font-semibold xl:inline xl:text-base">
              Eus' Presales Management System
            </span>
          </RouterLink>
        </div>

        <nav class="hidden min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto lg:flex xl:gap-1">
          <RouterLink
            v-for="link in navLinks"
            :key="link.name"
            :to="{ name: link.name }"
            class="shrink-0 rounded-lg px-2 py-2 text-sm font-medium text-epms-800 transition hover:bg-epms-50 xl:px-3"
            :class="{ 'bg-epms-50': isNavLinkActive(link) }"
          >
            {{ link.label }}
          </RouterLink>
        </nav>

        <div class="ml-auto hidden shrink-0 items-center gap-0.5 sm:gap-1 lg:flex">
          <div
            v-if="auth.isAdmin"
            data-admin-menu
            class="relative"
            @mouseenter="openAdminMenuOnHover"
            @mouseleave="closeAdminMenuOnHover"
          >
            <button
              type="button"
              :class="navLinkClass"
              :aria-expanded="adminMenuOpen"
              aria-haspopup="menu"
              @click.stop="toggleAdminMenu"
            >
              <FontAwesomeIcon icon="gear" :class="navIconClass" />
              <span>Admin</span>
            </button>
            <div
              v-show="adminMenuOpen"
              class="absolute right-0 top-full z-50 w-64 pt-2"
              role="menu"
              @mouseenter="openAdminMenuOnHover"
              @mouseleave="closeAdminMenuOnHover"
            >
              <div class="rounded-xl border border-stone-200 bg-white p-2 text-sm text-stone-700 shadow-xl">
                <RouterLink
                  v-for="link in adminLinks"
                  :key="link.name"
                  :to="{ name: link.name }"
                  class="flex items-center gap-2 rounded-lg px-2 py-2 transition hover:bg-epms-50"
                  active-class="bg-epms-50"
                  role="menuitem"
                  @click="closeMenus"
                >
                  {{ link.label }}
                </RouterLink>
              </div>
            </div>
          </div>

          <div
            v-if="auth.isAuthenticated"
            data-user-menu
            class="relative"
            @mouseenter="openUserMenuOnHover"
            @mouseleave="closeUserMenuOnHover"
          >
            <button
              type="button"
              :class="userMenuButtonClass"
              :aria-expanded="userMenuOpen"
              aria-haspopup="menu"
              @click.stop="toggleUserMenu"
            >
              <UserAvatar :name="auth.displayName || 'Account'" :url="auth.profileAvatarUrl" size="sm" />
              <span class="hidden sm:inline">{{ auth.displayName || 'Account' }}</span>
            </button>
            <div
              v-show="userMenuOpen"
              class="absolute right-0 top-full z-50 w-72 pt-2"
              role="menu"
              @mouseenter="openUserMenuOnHover"
              @mouseleave="closeUserMenuOnHover"
            >
              <div class="rounded-xl border border-stone-200 bg-white p-2 text-sm text-stone-700 shadow-xl">
                <RouterLink
                  :to="{ name: 'profile-settings' }"
                  class="flex items-center gap-2 whitespace-nowrap rounded-lg px-2 py-2 transition hover:bg-epms-50"
                  active-class="bg-epms-50"
                  role="menuitem"
                  @click="closeMenus"
                >
                  Personal settings
                </RouterLink>
                <div class="mt-1 border-t border-stone-200 pt-1">
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-2 py-2 text-left font-medium text-epms-800 transition hover:bg-epms-50"
                    role="menuitem"
                    @click="handleLogout"
                  >
                    <LogoutIcon />
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <Teleport to="body">
      <div
        v-if="mobileNavOpen"
        class="fixed inset-0 z-50 lg:hidden"
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          class="absolute inset-0 bg-stone-900/40"
          aria-label="Close menu"
          @click="closeMobileNav"
        />
        <div class="absolute inset-y-0 left-0 flex w-[min(100%,20rem)] flex-col bg-white shadow-xl">
          <div class="flex items-center justify-between border-b border-stone-200 px-4 py-3">
            <span class="font-semibold text-epms-900">Menu</span>
            <button
              type="button"
              class="rounded-lg p-2 text-stone-600 hover:bg-stone-100"
              aria-label="Close menu"
              @click="closeMobileNav"
            >
              ✕
            </button>
          </div>

          <nav class="flex-1 overflow-y-auto p-3">
            <RouterLink
              v-for="link in navLinks"
              :key="link.name"
              :to="{ name: link.name }"
              :class="[mobileNavLinkClass, { 'bg-epms-50': isNavLinkActive(link) }]"
              @click="closeMobileNav"
            >
              {{ link.label }}
            </RouterLink>

            <template v-if="auth.isAdmin">
              <p class="mt-3 px-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Admin</p>
              <RouterLink
                v-for="link in adminLinks"
                :key="link.name"
                :to="{ name: link.name }"
                :class="mobileSubLinkClass"
                active-class="bg-epms-50 text-epms-900"
                @click="closeMobileNav"
              >
                {{ link.label }}
              </RouterLink>
            </template>
          </nav>

          <div v-if="auth.isAuthenticated" class="border-t border-stone-200 p-3">
            <div class="mb-2 flex items-center gap-2 px-3 py-1">
              <UserAvatar :name="auth.displayName || 'Account'" :url="auth.profileAvatarUrl" size="sm" />
              <span class="truncate text-sm font-medium text-stone-800">
                {{ auth.displayName || 'Account' }}
              </span>
            </div>
            <RouterLink
              :to="{ name: 'profile-settings' }"
              :class="mobileNavLinkClass"
              active-class="bg-epms-50"
              @click="closeMobileNav"
            >
              Personal settings
            </RouterLink>
            <button type="button" :class="mobileNavLinkClass" @click="handleLogout">
              <LogoutIcon />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <main class="w-full min-w-0 max-w-full overflow-x-clip px-4 py-6 sm:px-6">
      <RouterView />
    </main>
  </div>
</template>
