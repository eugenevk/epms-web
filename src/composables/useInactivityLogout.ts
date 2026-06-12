import { onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const ACTIVITY_EVENTS = ['click', 'mousemove', 'keydown', 'scroll', 'touchstart'] as const
const AUTO_LOGOUT_MS = 15 * 60 * 1000

export function useInactivityLogout() {
  const auth = useAuthStore()
  const router = useRouter()

  let timeoutId: number | null = null
  let listening = false

  function clearTimer() {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  async function onTimeout() {
    if (!auth.isAuthenticated) return
    await auth.logout()
    await router.push({ name: 'login' })
  }

  function restartTimer() {
    clearTimer()
    if (!auth.isAuthenticated) return
    timeoutId = window.setTimeout(() => {
      void onTimeout()
    }, AUTO_LOGOUT_MS)
  }

  function addActivityListeners() {
    if (listening) return
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, restartTimer, { passive: true })
    }
    listening = true
  }

  function removeActivityListeners() {
    if (!listening) return
    for (const event of ACTIVITY_EVENTS) {
      window.removeEventListener(event, restartTimer)
    }
    listening = false
  }

  watch(
    () => auth.isAuthenticated,
    (isAuthenticated) => {
      if (isAuthenticated) {
        addActivityListeners()
        restartTimer()
      } else {
        clearTimer()
        removeActivityListeners()
      }
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    clearTimer()
    removeActivityListeners()
  })
}
