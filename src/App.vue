<script setup lang="ts">
import { onMounted } from 'vue'
import DiscardChangesDialog from '@/components/DiscardChangesDialog.vue'
import { useInactivityLogout } from '@/composables/useInactivityLogout'
import { useAuthStore } from '@/stores/auth'
import { isFirebaseConfigured } from '@/lib/firebase'

const auth = useAuthStore()
const configured = isFirebaseConfigured()

useInactivityLogout()

onMounted(() => {
  if (configured) {
    void auth.init()
  } else {
    auth.markReady()
  }
})
</script>

<template>
  <div v-if="!configured" class="flex min-h-screen items-center justify-center p-6">
    <div class="max-w-md rounded-xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
      <h1 class="text-xl font-bold text-epms-900">Configuration missing</h1>
      <p class="mt-3 text-sm text-stone-600">
        Copy <code class="rounded bg-white px-1">.env.example</code> to
        <code class="rounded bg-white px-1">.env</code> and add your Firebase credentials (same
        project as qepms v1).
      </p>
    </div>
  </div>

  <div v-else-if="!auth.ready" class="flex min-h-screen items-center justify-center">
    <p class="text-stone-500">Loading…</p>
  </div>

  <RouterView v-else />
  <DiscardChangesDialog />
</template>
