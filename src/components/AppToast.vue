<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { visible, toast } = useToast()
</script>

<template>
  <Teleport to="body">
    <Transition name="app-toast">
      <div
        v-if="visible && toast"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-epms-950/20" aria-hidden="true" />
        <p
          role="alert"
          class="relative max-w-md rounded-2xl border px-6 py-4 text-center text-sm font-medium shadow-lg"
          :class="
            toast.kind === 'success'
              ? 'border-emerald-200/80 bg-emerald-50 text-emerald-900'
              : 'border-orange-200/80 bg-orange-50 text-orange-950'
          "
        >
          {{ toast.message }}
        </p>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.app-toast-enter-active,
.app-toast-leave-active {
  transition: opacity 0.2s ease;
}

.app-toast-enter-active p,
.app-toast-leave-active p {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.app-toast-enter-from,
.app-toast-leave-to {
  opacity: 0;
}

.app-toast-enter-from p,
.app-toast-leave-to p {
  opacity: 0;
  transform: scale(0.96) translateY(4px);
}
</style>
