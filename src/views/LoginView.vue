<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
import {
  passwordResetErrorMessage,
  passwordResetSuccessMessage,
  requestPasswordResetEmail,
} from '@/lib/passwordReset'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const resetLoading = ref(false)
const resetMessage = ref<string | null>(null)
const resetIsError = ref(false)
const forgotPasswordMode = ref(false)

const inactiveLogoutMessage =
  route.query.reason === 'inactive'
    ? 'You have been signed out due to inactivity.'
    : null

async function onSubmit() {
  if (loading.value || resetLoading.value) return
  resetMessage.value = null
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

function showForgotPassword() {
  forgotPasswordMode.value = true
  password.value = ''
  showPassword.value = false
  resetMessage.value = null
  resetIsError.value = false
  auth.error = null
}

function showLogin() {
  forgotPasswordMode.value = false
  resetMessage.value = null
  resetIsError.value = false
  auth.error = null
}

async function onRequestPasswordReset() {
  if (resetLoading.value || loading.value) return

  resetMessage.value = null
  auth.error = null
  resetLoading.value = true

  try {
    const result = await requestPasswordResetEmail(email.value)
    if (result === 'no-account') {
      resetIsError.value = true
      resetMessage.value = 'No login account was found for this email address.'
    } else {
      resetIsError.value = false
      resetMessage.value = passwordResetSuccessMessage(email.value)
    }
  } catch (error) {
    resetIsError.value = true
    resetMessage.value = passwordResetErrorMessage(error)
  } finally {
    resetLoading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-b from-epms-50 to-stone-100 p-4 font-sans">
    <div class="w-full max-w-md">
      <div class="mb-8 flex w-full flex-col items-center text-center font-sans">
        <AppLogo :size="88" show-background class="mb-4 drop-shadow-md" />
        <h1
          class="whitespace-nowrap text-base font-bold text-epms-900 sm:text-xl md:text-2xl lg:text-3xl"
        >
          Eus' Presales Management System
        </h1>
        <p class="mt-2 text-sm text-stone-600">
          {{ forgotPasswordMode ? 'Forgot password' : 'Sign in' }}
        </p>
      </div>

      <form
        v-focus-first
        class="font-sans rounded-2xl border border-epms-200/80 bg-white p-6 shadow-lg shadow-epms-900/5 sm:p-8"
        @submit.prevent="forgotPasswordMode ? onRequestPasswordReset() : onSubmit()"
      >
        <p
          v-if="inactiveLogoutMessage"
          class="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {{ inactiveLogoutMessage }}
        </p>

        <label class="block text-sm font-semibold text-stone-700">
          Email
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            required
            class="mt-1 w-full rounded-lg px-3 py-2 font-sans text-stone-900 field-focus"
          />
        </label>

        <label v-if="!forgotPasswordMode" class="mt-4 block text-sm font-semibold text-stone-700">
          Password
          <div class="relative mt-1">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              required
              class="w-full rounded-lg px-3 py-2 pr-10 font-sans text-stone-900 field-focus"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 inline-flex items-center px-2 text-stone-500 transition hover:text-stone-700"
              :aria-label="showPassword ? 'Hide password' : 'Show password'"
              @click="showPassword = !showPassword"
            >
              <FontAwesomeIcon v-if="showPassword" icon="eye-slash" class="h-5 w-5" />
              <FontAwesomeIcon v-else icon="eye" class="h-5 w-5" />
            </button>
          </div>
        </label>

        <p v-if="forgotPasswordMode" class="mt-4 text-sm text-stone-600">
          Enter your email address. You will receive a link to set a new password.
        </p>

        <div v-if="!forgotPasswordMode" class="mt-2 text-right">
          <button
            type="button"
            class="text-sm font-medium text-epms-800 underline-offset-2 hover:underline disabled:opacity-60"
            :disabled="loading || resetLoading"
            @click="showForgotPassword"
          >
            Forgot password?
          </button>
        </div>

        <p
          v-if="resetMessage"
          class="mt-4 rounded-lg px-3 py-2 text-sm"
          :class="resetIsError ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'"
        >
          {{ resetMessage }}
        </p>

        <p v-if="auth.error && !forgotPasswordMode" class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ auth.error }}
        </p>

        <button
          type="submit"
          :disabled="loading || resetLoading"
          class="mt-6 w-full rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800 disabled:opacity-60"
        >
          {{
            forgotPasswordMode
              ? resetLoading
                ? 'Sending…'
                : 'Send reset link'
              : loading
                ? 'Signing in…'
                : 'Sign in'
          }}
        </button>

        <button
          v-if="forgotPasswordMode"
          type="button"
          class="mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-100 disabled:opacity-60"
          :disabled="resetLoading"
          @click="showLogin"
        >
          Back to sign in
        </button>
      </form>
    </div>
  </div>
</template>
