export function isRichTextFieldFocused(): boolean {
  const active = document.activeElement
  if (!active) return false

  if (active.closest('.rich-text-field, .rich-text-editor, .tox-tinymce, .tox-dialog-wrap')) {
    return true
  }

  if (active.tagName === 'IFRAME') {
    return Boolean(active.closest('.tox-tinymce, .rich-text-editor'))
  }

  return false
}

export function shouldIgnoreDialogEnterSave(event: KeyboardEvent): boolean {
  if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
    return true
  }

  if (isRichTextFieldFocused()) return true

  const active = document.activeElement
  if (!active) return false

  if (active.closest('[data-tag-input-field]')) return true

  if (active.closest('[data-dropdown-open="true"]')) return true

  if (active.tagName === 'TEXTAREA') return true

  if (active.tagName === 'BUTTON' || active.tagName === 'A') return true

  if (active instanceof HTMLElement && active.isContentEditable) return true

  return false
}
