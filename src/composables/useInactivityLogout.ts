import { onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { DEFAULT_SECURITY_SETTINGS, subscribeSecuritySettings, type SecuritySettings } from '@/lib/appSettings'
import { useAuthStore } from '@/stores/auth'

const ACTIVITY_EVENTS = ['click', 'mousemove', 'keydown', 'scroll', 'touchstart'] as const

export function useInactivityLogout() {
  const auth = useAuthStore()
  const router = useRouter()

  let timeoutId: number | null = null
  let unsubscribeSettings: (() => void) | null = null
  let settings: SecuritySettings = { ...DEFAULT_SECURITY_SETTINGS }
  let listening = false

  function start() {
    if (unsubscribeSettings) return

    unsubscribeSettings = subscribeSecuritySettings((nextSettings) => {
      settings = nextSettings
      restartTimer()
    })

    addActivityListeners()
    restartTimer()
  }

  function stop() {
    clearTimer()
    removeActivityListeners()
    unsubscribeSettings?.()
    unsubscribeSettings = null
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

  function restartTimer() {
    clearTimer()

    if (!auth.isAuthenticated || settings.autoLogoutMinutes <= 0) return

    timeoutId = window.setTimeout(async () => {
      await auth.logout()
      await router.replace({ name: 'login', query: { reason: 'inactive' } })
    }, settings.autoLogoutMinutes * 60 * 1000)
  }

  function clearTimer() {
    if (!timeoutId) return
    window.clearTimeout(timeoutId)
    timeoutId = null
  }

  const stopWatch = watch(
    () => auth.isAuthenticated,
    (isAuthenticated) => {
      if (isAuthenticated) start()
      else stop()
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    stopWatch()
    stop()
  })
}
