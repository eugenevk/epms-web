<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { changeCurrentUserPassword, currentUserHasPasswordLogin, passwordChangeErrorMessage } from '@/lib/passwordChange'
import { removeUserAvatar, uploadUserAvatar } from '@/lib/userAvatar'
import { loadCurrentUserSettings, saveCurrentUserProfileName } from '@/lib/userSettings'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const toast = useToast()

const name = ref('')
const email = ref('')
const avatarUrl = ref<string | null>(null)

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showCurrentPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const loading = ref(true)
const savingProfile = ref(false)
const changingPassword = ref(false)
const uploadingAvatar = ref(false)
const removingAvatar = ref(false)

const canChangePassword = computed(() => currentUserHasPasswordLogin())

onMounted(async () => {
  try {
    const profile = await loadCurrentUserSettings()
    name.value = profile.name
    email.value = profile.username
    avatarUrl.value = profile.avatarUrl
  } catch (e) {
    toast.showError(e instanceof Error ? e.message : 'Could not load profile.')
  } finally {
    loading.value = false
  }
})

async function saveProfile() {
  savingProfile.value = true

  try {
    await saveCurrentUserProfileName(name.value)
    await auth.refreshProfile()
    toast.showSuccess('Profile saved.')
  } catch (e) {
    toast.showError(e instanceof Error ? e.message : 'Save failed.')
  } finally {
    savingProfile.value = false
  }
}

async function handleAvatarSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  uploadingAvatar.value = true
  try {
    avatarUrl.value = await uploadUserAvatar(file)
    await auth.refreshProfile()
    toast.showSuccess('Profile photo saved.')
  } catch (e) {
    toast.showError(e instanceof Error ? e.message : 'Could not upload profile photo.')
  } finally {
    uploadingAvatar.value = false
  }
}

async function handleRemoveAvatar() {
  removingAvatar.value = true
  try {
    await removeUserAvatar()
    avatarUrl.value = null
    await auth.refreshProfile()
    toast.showSuccess('Profile photo removed.')
  } catch (e) {
    toast.showError(e instanceof Error ? e.message : 'Could not remove profile photo.')
  } finally {
    removingAvatar.value = false
  }
}

function resetPasswordForm() {
  currentPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  showCurrentPassword.value = false
  showNewPassword.value = false
  showConfirmPassword.value = false
}

async function savePassword() {
  if (newPassword.value !== confirmPassword.value) {
    toast.showError('New password and confirmation do not match.')
    return
  }

  changingPassword.value = true

  try {
    await changeCurrentUserPassword(currentPassword.value, newPassword.value)
    resetPasswordForm()
    toast.showSuccess('Password changed.')
  } catch (error) {
    toast.showError(passwordChangeErrorMessage(error))
  } finally {
    changingPassword.value = false
  }
}
</script>

<template>
  <section class="w-full">
    <div>
      <h1 class="text-2xl font-bold text-epms-900">Personal settings</h1>
      <p class="mt-1 text-sm text-stone-600">
        Manage your name, profile photo, and password for Eus' Presales Management System.
      </p>
    </div>

    <p v-if="loading" class="mt-6 rounded-2xl border border-epms-200 bg-white p-6 text-sm text-stone-500">
      Loading settings…
    </p>

    <form
      v-else
      class="mt-6 rounded-2xl border border-epms-200 bg-white p-6 shadow-sm"
      @submit.prevent="saveProfile"
    >
      <p class="text-sm font-semibold uppercase tracking-wide text-epms-700">Profile</p>

      <div class="mt-6 space-y-5">
        <div>
          <p class="text-sm font-semibold text-stone-700">Profile photo</p>
          <div class="mt-2 flex flex-wrap items-center gap-4">
            <UserAvatar :name="name || email" :url="avatarUrl" size="lg" />
            <div class="flex flex-wrap gap-2">
              <label
                class="cursor-pointer rounded-lg border border-epms-300 px-3 py-2 text-sm font-semibold text-epms-800 transition hover:bg-epms-50"
                :class="{ 'pointer-events-none opacity-50': uploadingAvatar || removingAvatar || savingProfile }"
              >
                {{ uploadingAvatar ? 'Uploading…' : 'Choose photo' }}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  class="sr-only"
                  :disabled="uploadingAvatar || removingAvatar || savingProfile"
                  @change="handleAvatarSelected"
                />
              </label>
              <button
                v-if="avatarUrl"
                type="button"
                class="rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
                :disabled="uploadingAvatar || removingAvatar || savingProfile"
                @click="handleRemoveAvatar"
              >
                {{ removingAvatar ? 'Removing…' : 'Remove' }}
              </button>
            </div>
          </div>
          <p class="mt-2 text-xs text-stone-500">JPEG, PNG, WebP, or GIF, max. 2 MB.</p>
        </div>

        <label class="block text-sm font-semibold text-stone-700">
          Name
          <input
            v-model="name"
            type="text"
            autocomplete="name"
            class="mt-1 w-full rounded-xl px-3 py-3 text-sm text-stone-900 field-focus disabled:bg-stone-100"
            :disabled="savingProfile"
          />
        </label>

        <label class="block text-sm font-semibold text-stone-700">
          Email
          <input
            :value="email"
            type="email"
            readonly
            class="mt-1 w-full rounded-xl border-[0.5px] border-stone-200 bg-stone-50 px-3 py-3 text-sm text-stone-600 outline-none"
          />
        </label>
      </div>

      <button
        type="submit"
        class="mt-6 rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="savingProfile"
      >
        {{ savingProfile ? 'Saving…' : 'Save' }}
      </button>
    </form>

    <form
      v-if="!loading && canChangePassword"
      class="mt-6 rounded-2xl border border-epms-200 bg-white p-6 shadow-sm"
      @submit.prevent="savePassword"
    >
      <p class="text-sm font-semibold uppercase tracking-wide text-epms-700">Password</p>
      <p class="mt-2 text-sm text-stone-600">
        Choose a new password with at least 6 characters.
      </p>

      <div class="mt-6 space-y-5">
        <label class="block text-sm font-semibold text-stone-700">
          Current password
          <div class="relative mt-1">
            <input
              v-model="currentPassword"
              :type="showCurrentPassword ? 'text' : 'password'"
              autocomplete="current-password"
              class="w-full rounded-xl px-3 py-3 pr-10 text-sm text-stone-900 field-focus disabled:bg-stone-100"
              :disabled="changingPassword"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 inline-flex items-center px-2 text-stone-500 transition hover:text-stone-700"
              :aria-label="showCurrentPassword ? 'Hide password' : 'Show password'"
              @click="showCurrentPassword = !showCurrentPassword"
            >
              <FontAwesomeIcon v-if="showCurrentPassword" icon="eye-slash" class="h-5 w-5" />
              <FontAwesomeIcon v-else icon="eye" class="h-5 w-5" />
            </button>
          </div>
        </label>

        <label class="block text-sm font-semibold text-stone-700">
          New password
          <div class="relative mt-1">
            <input
              v-model="newPassword"
              :type="showNewPassword ? 'text' : 'password'"
              autocomplete="new-password"
              class="w-full rounded-xl px-3 py-3 pr-10 text-sm text-stone-900 field-focus disabled:bg-stone-100"
              :disabled="changingPassword"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 inline-flex items-center px-2 text-stone-500 transition hover:text-stone-700"
              :aria-label="showNewPassword ? 'Hide password' : 'Show password'"
              @click="showNewPassword = !showNewPassword"
            >
              <FontAwesomeIcon v-if="showNewPassword" icon="eye-slash" class="h-5 w-5" />
              <FontAwesomeIcon v-else icon="eye" class="h-5 w-5" />
            </button>
          </div>
        </label>

        <label class="block text-sm font-semibold text-stone-700">
          Confirm new password
          <div class="relative mt-1">
            <input
              v-model="confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              autocomplete="new-password"
              class="w-full rounded-xl px-3 py-3 pr-10 text-sm text-stone-900 field-focus disabled:bg-stone-100"
              :disabled="changingPassword"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 inline-flex items-center px-2 text-stone-500 transition hover:text-stone-700"
              :aria-label="showConfirmPassword ? 'Hide password' : 'Show password'"
              @click="showConfirmPassword = !showConfirmPassword"
            >
              <FontAwesomeIcon v-if="showConfirmPassword" icon="eye-slash" class="h-5 w-5" />
              <FontAwesomeIcon v-else icon="eye" class="h-5 w-5" />
            </button>
          </div>
        </label>
      </div>

      <button
        type="submit"
        class="mt-6 rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="changingPassword"
      >
        {{ changingPassword ? 'Changing…' : 'Change password' }}
      </button>
    </form>
  </section>
</template>
