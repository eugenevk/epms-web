import { ref } from 'vue'

export type ToastKind = 'success' | 'error'

export type ToastState = {
  message: string
  kind: ToastKind
}

const TOAST_DURATION_MS: Record<ToastKind, number> = {
  success: 1000,
  error: 3000,
}

const visible = ref(false)
const toast = ref<ToastState | null>(null)

let hideTimeout: ReturnType<typeof setTimeout> | null = null

function show(message: string, kind: ToastKind) {
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }

  toast.value = { message, kind }
  visible.value = true

  hideTimeout = setTimeout(() => {
    visible.value = false
    hideTimeout = null
  }, TOAST_DURATION_MS[kind])
}

export function useToast() {
  return {
    visible,
    toast,
    showSuccess: (message: string) => show(message, 'success'),
    showError: (message: string) => show(message, 'error'),
  }
}
