import { onUnmounted, watch, type MaybeRefOrGetter, toValue } from 'vue'
import { shouldIgnoreDialogEnterSave } from '@/lib/dialogKeyboard'

type DialogKeyboardOptions = {
  onDismiss?: () => void
  onSave?: () => void
  disabled?: MaybeRefOrGetter<boolean>
}

export function useDialogKeyboardShortcuts(
  open: MaybeRefOrGetter<boolean>,
  options: DialogKeyboardOptions,
) {
  function isDisabled(): boolean {
    return Boolean(toValue(options.disabled))
  }

  function onDocumentKeydown(event: KeyboardEvent) {
    if (!toValue(open) || isDisabled()) return

    if (event.key === 'Escape') {
      options.onDismiss?.()
      return
    }

    if (event.key === 'Enter' && options.onSave) {
      if (shouldIgnoreDialogEnterSave(event)) return
      event.preventDefault()
      options.onSave()
    }
  }

  watch(
    () => toValue(open),
    (isOpen) => {
      if (isOpen) {
        document.addEventListener('keydown', onDocumentKeydown)
        return
      }

      document.removeEventListener('keydown', onDocumentKeydown)
    },
    { immediate: true },
  )

  onUnmounted(() => {
    document.removeEventListener('keydown', onDocumentKeydown)
  })
}
