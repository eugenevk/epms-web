import type { RouteLocationRaw } from 'vue-router'
import { formatRfpDate } from '@/lib/rfps'
import type { NoteLinkedObject } from '@/lib/notesAlgolia'

export function formatNoteDate(value: string | null | undefined): string {
  return formatRfpDate(value)
}

export function noteLinkedObjectRoute(linkedObject: NoteLinkedObject): RouteLocationRaw {
  const id = linkedObject.id
  if (!id) return { name: 'notes' }

  switch (linkedObject.collection) {
    case 'companies':
      return { name: 'company-details', params: { id }, query: { tab: 'notes' } }
    case 'opportunities':
      return { name: 'opportunity-details', params: { id }, query: { tab: 'notes' } }
    case 'rfps':
      return { name: 'rfp-details', params: { id }, query: { tab: 'notes' } }
    default:
      return { name: 'notes' }
  }
}
