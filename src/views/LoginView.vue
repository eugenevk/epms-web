<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)

async function onSubmit() {
  if (loading.value) return
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.push(redirect)
  } catch {
    // error in store
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-b from-epms-50 to-stone-100 p-4">
    <div class="w-full max-w-md">
      <div class="mb-8 text-center">
        <div
          class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-epms-700 text-2xl font-bold text-white shadow-lg"
        >
          EP
        </div>
        <h1 class="text-3xl font-bold text-epms-900">Presales Management</h1>
        <p class="mt-2 text-sm text-stone-600">Login</p>
      </div>

      <form
        class="rounded-2xl border border-epms-200/80 bg-white p-6 shadow-lg shadow-epms-900/5 sm:p-8"
        @submit.prevent="onSubmit"
      >
        <label class="block text-sm font-medium text-stone-700">
          E-mail
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            required
            class="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900 field-focus"
          />
        </label>

        <label class="mt-4 block text-sm font-medium text-stone-700">
          Wachtwoord
          <div class="relative mt-1">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              required
              class="w-full rounded-lg border border-stone-300 px-3 py-2 pr-10 text-stone-900 field-focus"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 inline-flex items-center px-2 text-stone-500 transition hover:text-stone-700"
              :aria-label="showPassword ? 'Verberg wachtwoord' : 'Toon wachtwoord'"
              @click="showPassword = !showPassword"
            >
              <span class="text-xs font-medium">{{ showPassword ? 'Verberg' : 'Toon' }}</span>
            </button>
          </div>
        </label>

        <p v-if="auth.error" class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ auth.error }}
        </p>

        <button
          type="submit"
          :disabled="loading"
          class="mt-6 w-full rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800 disabled:opacity-60"
        >
          {{ loading ? 'Bezig…' : 'Inloggen' }}
        </button>
      </form>
    </div>
  </div>
</template>
