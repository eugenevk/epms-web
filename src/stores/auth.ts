import { defineStore } from 'pinia'
import {
  getIdTokenResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { ref, computed } from 'vue'
import { getFirebaseAuth } from '@/lib/firebase'
import { loadCurrentUserSettings } from '@/lib/userSettings'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const ready = ref(false)
  const error = ref<string | null>(null)
  const isAdmin = ref(false)
  const profileName = ref('')
  const profileAvatarUrl = ref<string | null>(null)

  let initPromise: Promise<void> | null = null

  const isAuthenticated = computed(() => user.value !== null)
  const displayName = computed(() => {
    if (profileName.value) return firstName(profileName.value)
    if (user.value?.displayName) return firstName(user.value.displayName)
    return firstName(user.value?.email?.split('@')[0] || '')
  })

  async function applyAdminFromClaims(firebaseUser: User | null) {
    if (!firebaseUser) {
      isAdmin.value = false
      return
    }

    try {
      const tokenResult = await getIdTokenResult(firebaseUser)
      const claims = tokenResult.claims as Record<string, unknown>
      isAdmin.value = claims.admin === true || claims.role === 'admin'
    } catch {
      isAdmin.value = false
    }
  }

  async function loadProfileFields(firebaseUser: User | null) {
    profileName.value = ''
    profileAvatarUrl.value = null

    if (!firebaseUser) return

    try {
      const profile = await loadCurrentUserSettings()
      profileName.value = profile.name
      profileAvatarUrl.value = profile.avatarUrl
    } catch {
      // userSettings may not exist yet; fall back to auth defaults.
    }
  }

  async function applyFirebaseUser(firebaseUser: User | null) {
    user.value = firebaseUser
    await Promise.all([loadProfileFields(firebaseUser), applyAdminFromClaims(firebaseUser)])
    ready.value = true
  }

  function init(): Promise<void> {
    if (initPromise) return initPromise

    initPromise = new Promise((resolve) => {
      let resolved = false
      onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
        await applyFirebaseUser(firebaseUser)
        if (!resolved) {
          resolved = true
          resolve()
        }
      })
    })

    return initPromise
  }

  async function login(email: string, password: string) {
    error.value = null
    try {
      const credential = await signInWithEmailAndPassword(
        getFirebaseAuth(),
        email.trim(),
        password,
      )
      await applyFirebaseUser(credential.user)
    } catch (e) {
      error.value = mapAuthError(e)
      throw e
    }
  }

  async function logout() {
    error.value = null
    await signOut(getFirebaseAuth())
  }

  function markReady() {
    ready.value = true
  }

  async function refreshProfile() {
    await loadProfileFields(user.value)
  }

  return {
    user,
    ready,
    error,
    isAdmin,
    isAuthenticated,
    displayName,
    profileAvatarUrl,
    init,
    markReady,
    refreshProfile,
    login,
    logout,
  }
})

function firstName(value: string): string {
  return value
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(/\s+/)[0] || ''
}

function mapAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email address or password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.'
    case 'auth/invalid-email':
      return 'Invalid email address.'
    default:
      return 'Sign-in failed. Please try again.'
  }
}
