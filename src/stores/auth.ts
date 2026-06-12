import { defineStore } from 'pinia'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { ref, computed } from 'vue'
import { getFirebaseAuth } from '@/lib/firebase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const ready = ref(false)
  const error = ref<string | null>(null)

  let initPromise: Promise<void> | null = null

  const isAuthenticated = computed(() => user.value !== null)
  const displayName = computed(() => {
    if (user.value?.displayName) return firstName(user.value.displayName)
    return firstName(user.value?.email?.split('@')[0] || '')
  })

  function applyFirebaseUser(firebaseUser: User | null) {
    user.value = firebaseUser
    ready.value = true
  }

  function init(): Promise<void> {
    if (initPromise) return initPromise

    initPromise = new Promise((resolve) => {
      let resolved = false
      onAuthStateChanged(getFirebaseAuth(), (firebaseUser) => {
        applyFirebaseUser(firebaseUser)
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
      applyFirebaseUser(credential.user)
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

  return {
    user,
    ready,
    error,
    isAuthenticated,
    displayName,
    init,
    markReady,
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
      return 'Onjuist e-mailadres of wachtwoord.'
    case 'auth/too-many-requests':
      return 'Te veel pogingen. Probeer het later opnieuw.'
    case 'auth/invalid-email':
      return 'Ongeldig e-mailadres.'
    default:
      return 'Inloggen mislukt. Probeer het opnieuw.'
  }
}
