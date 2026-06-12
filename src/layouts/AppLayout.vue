<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const mobileNavOpen = ref(false)

const navLinks = [
  { name: 'home', label: 'Dashboard', path: '/' },
] as const

async function onLogout() {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen bg-stone-50">
    <header class="border-b border-stone-200 bg-white">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="rounded-lg p-2 text-stone-600 hover:bg-stone-100 md:hidden"
            aria-label="Menu"
            @click="mobileNavOpen = !mobileNavOpen"
          >
            ☰
          </button>
          <RouterLink to="/" class="flex items-center gap-2 font-semibold text-epms-800">
            <span
              class="flex h-8 w-8 items-center justify-center rounded-lg bg-epms-700 text-xs font-bold text-white"
            >
              EP
            </span>
            <span class="hidden sm:inline">EPMS</span>
          </RouterLink>
        </div>

        <nav class="hidden items-center gap-1 md:flex">
          <RouterLink
            v-for="link in navLinks"
            :key="link.name"
            :to="link.path"
            class="rounded-lg px-3 py-2 text-sm font-medium text-epms-800 transition hover:bg-epms-50"
            active-class="bg-epms-50"
          >
            {{ link.label }}
          </RouterLink>
        </nav>

        <div class="flex items-center gap-2">
          <span class="hidden text-sm text-stone-600 sm:inline">{{ auth.displayName }}</span>
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100"
            @click="onLogout"
          >
            Uitloggen
          </button>
        </div>
      </div>

      <nav
        v-if="mobileNavOpen"
        class="border-t border-stone-200 bg-white px-4 py-2 md:hidden"
      >
        <RouterLink
          v-for="link in navLinks"
          :key="link.name"
          :to="link.path"
          class="block rounded-lg px-3 py-2 text-sm font-medium text-epms-800 hover:bg-epms-50"
          @click="mobileNavOpen = false"
        >
          {{ link.label }}
        </RouterLink>
      </nav>
    </header>

    <main class="mx-auto max-w-6xl px-4 py-6">
      <RouterView />
    </main>
  </div>
</template>
