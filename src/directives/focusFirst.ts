import { nextTick, type Directive } from 'vue'

const FOCUSABLE_SELECTOR =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])'

function isPreferredFocusTarget(field: HTMLElement): boolean {
  if (field instanceof HTMLInputElement) {
    if (field.readOnly) return false
    const type = field.type || 'text'
    return (
      type !== 'radio' &&
      type !== 'checkbox' &&
      type !== 'button' &&
      type !== 'submit' &&
      type !== 'file'
    )
  }

  return true
}

export function focusFirstField(container: HTMLElement | null | undefined) {
  if (!container) return

  const fields = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
  const field = fields.find(isPreferredFocusTarget) ?? fields[0]
  if (!field) return

  field.focus()

  if (
    field instanceof HTMLInputElement &&
    ['text', 'email', 'tel', 'search', 'url', 'number'].includes(field.type || 'text')
  ) {
    field.select()
  }
}

/** Focus the first editable field when a form is shown (e.g. login, dialogs). */
export const vFocusFirst: Directive = {
  mounted(el) {
    void nextTick(() => focusFirstField(el))
  },
}
