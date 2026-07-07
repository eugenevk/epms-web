import { FirebaseError } from 'firebase/app'

export function getCallableErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code === 'functions/not-found') {
      return 'Cloud Function "reindexAlgolia" is not deployed. Run: firebase deploy --only functions:reindexAlgolia'
    }

    if (error.code === 'functions/unauthenticated') {
      return 'You must be signed in to re-index Algolia.'
    }

    if (error.code === 'functions/permission-denied') {
      return 'Only administrators may re-index Algolia. Sign out and sign in again after admin access was granted.'
    }

    if (error.code === 'functions/failed-precondition') {
      return error.message
    }

    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Re-index failed.'
}
