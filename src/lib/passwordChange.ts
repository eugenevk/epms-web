import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase'

export function currentUserHasPasswordLogin(): boolean {
  const user = getFirebaseAuth().currentUser
  if (!user) return false

  return user.providerData.some((provider) => provider.providerId === 'password')
}

export async function changeCurrentUserPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = getFirebaseAuth().currentUser
  if (!user?.email) {
    throw new Error('You must be signed in.')
  }

  const trimmedCurrent = currentPassword
  const trimmedNew = newPassword.trim()

  if (!trimmedCurrent) {
    throw new Error('Enter your current password.')
  }
  if (!trimmedNew) {
    throw new Error('Enter a new password.')
  }
  if (trimmedNew.length < 6) {
    throw new Error('The new password must be at least 6 characters.')
  }
  if (trimmedCurrent === trimmedNew) {
    throw new Error('The new password must be different from your current password.')
  }

  const credential = EmailAuthProvider.credential(user.email, trimmedCurrent)
  await reauthenticateWithCredential(user, credential)
  await updatePassword(user, trimmedNew)
}

export function passwordChangeErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''

  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Current password is incorrect.'
  }
  if (code === 'auth/weak-password') {
    return 'The new password is too weak. Use at least 6 characters.'
  }
  if (code === 'auth/requires-recent-login') {
    return 'For security, sign out and sign in again before changing your password.'
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please try again later.'
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error while changing password. Please try again.'
  }

  return error instanceof Error ? error.message : 'Could not change password. Please try again.'
}
