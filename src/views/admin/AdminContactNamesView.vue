<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { migrateAllContactNames } from '@/lib/contactRecords'

const toast = useToast()
const migrating = ref(false)

async function normalizeContactNames() {
  migrating.value = true

  try {
    const result = await migrateAllContactNames()
    toast.showSuccess(
      `Normalized ${result.updated.toLocaleString()} of ${result.total.toLocaleString()} contacts.`,
    )
  } catch (e) {
    toast.showError(e instanceof Error ? e.message : 'Could not normalize contact names.')
  } finally {
    migrating.value = false
  }
}
</script>

<template>
  <section class="w-full">
    <div class="rounded-2xl border border-epms-200 bg-white p-6 shadow-sm">
      <p class="text-sm font-semibold uppercase tracking-wide text-epms-700">Admin</p>
      <h1 class="mt-1 text-2xl font-bold text-epms-900">Contact names</h1>
      <p class="mt-2 text-sm leading-6 text-stone-600">
        Normalize legacy contact names to <em>Surname, First name particles</em> (for example
        <em>Ouden, Daan van den</em>) in Firestore. Run an Algolia re-index for contacts afterwards so
        search matches the updated names.
      </p>

      <button
        type="button"
        class="mt-6 rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="migrating"
        @click="normalizeContactNames"
      >
        {{ migrating ? 'Normalizing…' : 'Normalize all contact names' }}
      </button>
    </div>
  </section>
</template>
