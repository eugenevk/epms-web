import { sendPasswordResetEmail } from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase'

export type PasswordResetRequestResult = 'sent' | 'no-account'

export async function requestPasswordResetEmail(email: string): Promise<PasswordResetRequestResult> {
  const trimmed = email.trim()
  if (!trimmed) {
    throw new Error('Enter your email address to request a reset link.')
  }

  const auth = getFirebaseAuth()

  try {
    await sendPasswordResetEmail(auth, trimmed, {
      url: `${window.location.origin}/login`,
      handleCodeInApp: false,
    })
    return 'sent'
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
    if (code === 'auth/user-not-found') {
      return 'no-account'
    }
    throw error
  }
}

export function passwordResetSuccessMessage(email: string): string {
  return `If an account exists for ${email.trim()}, you will receive an email within a few minutes with instructions to reset your password.`
}

export function passwordResetErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''

  if (code === 'auth/invalid-email') {
    return 'Enter a valid email address.'
  }
  if (code === 'auth/missing-continue-uri' || code === 'auth/invalid-continue-uri') {
    return 'Could not create reset link. Check the app URL settings.'
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error while sending the reset link. Please try again.'
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please try again later.'
  }

  return error instanceof Error
    ? error.message
    : 'The reset link could not be sent. Please try again later.'
}
