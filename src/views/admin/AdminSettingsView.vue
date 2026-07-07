<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { DEFAULT_SECURITY_SETTINGS, getSecuritySettings, saveSecuritySettings } from '@/lib/appSettings'

const toast = useToast()

const autoLogoutMinutes = ref(DEFAULT_SECURITY_SETTINGS.autoLogoutMinutes)
const loading = ref(true)
const saving = ref(false)

onMounted(async () => {
  try {
    const settings = await getSecuritySettings()
    autoLogoutMinutes.value = settings.autoLogoutMinutes
  } catch (e) {
    toast.showError(e instanceof Error ? e.message : 'Could not load settings.')
  } finally {
    loading.value = false
  }
})

async function save() {
  saving.value = true

  try {
    await saveSecuritySettings({
      autoLogoutMinutes: autoLogoutMinutes.value,
    })
    toast.showSuccess('Settings saved.')
  } catch (e) {
    toast.showError(e instanceof Error ? e.message : 'Save failed.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="w-full">
    <div class="rounded-2xl border border-epms-200 bg-white p-6 shadow-sm">
      <p class="text-sm font-semibold uppercase tracking-wide text-epms-700">Admin</p>
      <h1 class="mt-1 text-2xl font-bold text-epms-900">Application settings</h1>
      <p class="mt-2 text-sm leading-6 text-stone-600">
        Configure security settings for EPMS. Changes are picked up immediately by active
        sessions.
      </p>

      <form class="mt-6 space-y-6" @submit.prevent="save">
        <label class="block text-sm font-semibold text-stone-700">
          Sign out automatically after inactivity
          <div class="mt-2 flex max-w-xs items-center gap-3">
            <input
              v-model.number="autoLogoutMinutes"
              type="number"
              min="0"
              max="1440"
              step="1"
              class="w-32 rounded-lg px-3 py-2 font-sans text-stone-900 field-focus disabled:bg-stone-100"
              :disabled="loading || saving"
            />
            <span class="text-sm font-normal text-stone-600">minutes</span>
          </div>
        </label>

        <p class="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600">
          Use <strong>0</strong> to disable automatic sign-out. Recommended value: 15 minutes.
        </p>

        <button
          type="submit"
          class="rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="loading || saving"
        >
          {{ saving ? 'Saving…' : 'Save settings' }}
        </button>
      </form>
    </div>
  </section>
</template>
