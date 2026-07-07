import { reactive } from 'vue'

const DEFAULT_TITLE = 'Discard changes?'
const DEFAULT_MESSAGE = 'Unsaved changes will be lost. Close anyway?'

export const discardConfirmState = reactive({
  open: false,
  title: DEFAULT_TITLE,
  message: DEFAULT_MESSAGE,
})

let pendingResolve: ((confirmed: boolean) => void) | null = null
let confirmInFlight = false

export function confirmDiscardChanges(message = DEFAULT_MESSAGE): Promise<boolean> {
  if (confirmInFlight) return Promise.resolve(false)

  confirmInFlight = true
  discardConfirmState.title = DEFAULT_TITLE
  discardConfirmState.message = message
  discardConfirmState.open = true

  return new Promise((resolve) => {
    pendingResolve = resolve
  })
}

export function settleDiscardConfirm(confirmed: boolean) {
  if (!confirmInFlight) return

  discardConfirmState.open = false
  confirmInFlight = false
  pendingResolve?.(confirmed)
  pendingResolve = null
}

export async function requestCloseWithConfirm(
  onClose: () => void,
  isDirty: boolean,
  confirmMessage?: string,
): Promise<void> {
  if (!isDirty) {
    onClose()
    return
  }

  const confirmed = await confirmDiscardChanges(confirmMessage)
  if (confirmed) onClose()
}
