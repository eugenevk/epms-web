<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <h1 class="text-2xl font-bold text-epms-900">Dashboard</h1>
    <p class="mt-2 text-stone-600">
      Welkom{{ auth.displayName ? `, ${auth.displayName}` : '' }}. De nieuwe EPMS-frontend is klaar
      voor verdere uitbouw.
    </p>

    <div class="mt-8 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <h2 class="text-lg font-semibold text-stone-800">Volgende stappen</h2>
      <ul class="mt-3 list-inside list-disc space-y-1 text-sm text-stone-600">
        <li>Companies — lijst en detailpagina</li>
        <li>Contacts, Opportunities, RFP's</li>
        <li>Algolia-zoeklaag</li>
        <li>Admin: lists en stages</li>
      </ul>
    </div>
  </div>
</template>
