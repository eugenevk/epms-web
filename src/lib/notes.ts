import { collection, getDocs, query, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase'
import type { GridSortState } from '@/lib/gridSort'
import { stripHtml } from '@/lib/plainTextSearch'
import type { NoteDateFilter, NoteHit } from '@/lib/notesAlgolia'

export const NOTE_GRID_DEFAULT_SORT: GridSortState[] = [{ column: 'noteDt', direction: 'desc' }]

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export const NOTE_GRID_SNIPPET_LENGTH = 80

export function notePreviewText(note: NoteHit, maxLength = 160): string {
  const plain = stripHtml(note.note ?? '')
  if (!plain) return '—'
  if (plain.length <= maxLength) return plain
  return `${plain.slice(0, maxLength).trim()}…`
}

export function noteSnippetText(note: NoteHit): string {
  return notePreviewText(note, NOTE_GRID_SNIPPET_LENGTH)
}

function mapNoteHit(id: string, data: Record<string, unknown>): NoteHit {
  const linkedObject =
    data.linkedObject && typeof data.linkedObject === 'object'
      ? {
          collection: getString((data.linkedObject as { collection?: unknown }).collection),
          id: getString((data.linkedObject as { id?: unknown }).id),
          type: getString((data.linkedObject as { type?: unknown }).type),
          objectLabel: getString((data.linkedObject as { objectLabel?: unknown }).objectLabel),
        }
      : undefined

  return {
    objectID: id,
    id,
    noteDt: getString(data.noteDt),
    note: getString(data.note) ?? '',
    createdAt: getString(data.createdAt),
    createdBy: getString(data.createdBy),
    linkedObject,
  }
}

export function parseNoteDate(noteDt: string | null | undefined): string | null {
  if (!noteDt?.trim()) return null

  const trimmed = noteDt.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  const parsed = Date.parse(trimmed)
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10)
  }

  return null
}

export function noteMatchesDateFilter(
  noteDt: string | null | undefined,
  dateFilter: NoteDateFilter,
): boolean {
  const from = dateFilter.from?.trim()
  const to = dateFilter.to?.trim()
  if (!from && !to) return true

  const date = parseNoteDate(noteDt)
  if (!date) return false
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

export async function loadNotesFromFirestore(
  linkedObjectId: string,
  linkedObjectCollection?: string,
): Promise<NoteHit[]> {
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), 'notes'), where('linkedObject.id', '==', linkedObjectId)),
  )

  const hits = snapshot.docs
    .map((document) => mapNoteHit(document.id, document.data()))
    .filter((hit) => {
      if (!linkedObjectCollection) return true
      return hit.linkedObject?.collection === linkedObjectCollection
    })
    .sort((left, right) => {
      const leftDate = left.noteDt ?? ''
      const rightDate = right.noteDt ?? ''
      return rightDate.localeCompare(leftDate, 'en', { sensitivity: 'base' })
    })

  return hits
}

export async function loadCompanyNotesFromFirestore(companyId: string): Promise<NoteHit[]> {
  return loadNotesFromFirestore(companyId, 'companies')
}

export async function loadAllNotesFromFirestore(): Promise<NoteHit[]> {
  const snapshot = await getDocs(collection(getFirebaseDb(), 'notes'))

  return snapshot.docs
    .map((document) => mapNoteHit(document.id, document.data()))
    .sort((left, right) => {
      const leftDate = left.noteDt ?? ''
      const rightDate = right.noteDt ?? ''
      return rightDate.localeCompare(leftDate, 'en', { sensitivity: 'base' })
    })
}

export function filterNoteHits(
  hits: NoteHit[],
  queryText: string,
  dateFilter: NoteDateFilter = {},
): NoteHit[] {
  const needle = queryText.trim().toLowerCase()

  return hits.filter((hit) => {
    if (!noteMatchesDateFilter(hit.noteDt, dateFilter)) {
      return false
    }

    if (!needle) return true

    const haystack = [
      hit.noteDt,
      hit.createdAt,
      hit.createdBy,
      stripHtml(hit.note ?? ''),
      hit.linkedObject?.objectLabel,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(needle)
  })
}
