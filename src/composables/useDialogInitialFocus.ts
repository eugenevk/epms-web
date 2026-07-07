import { nextTick, watch, type MaybeRefOrGetter, type Ref, toValue } from 'vue'
import { focusFirstField } from '@/directives/focusFirst'

export function useDialogInitialFocus(
  open: MaybeRefOrGetter<boolean>,
  container: Ref<HTMLElement | null | undefined>,
  options?: {
    disabled?: MaybeRefOrGetter<boolean>
  },
) {
  watch(
    () => [toValue(open), toValue(options?.disabled), toValue(container)] as const,
    async ([isOpen, disabled]) => {
      if (!isOpen || disabled) return
      await nextTick()
      focusFirstField(toValue(container) ?? undefined)
    },
  )
}
