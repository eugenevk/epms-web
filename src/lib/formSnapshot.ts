import { isEmptyRichText } from '@/lib/richText'

export function snapshotOf<T>(value: T): string {
  return JSON.stringify(value)
}

export function cloneSnapshotValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function normalizeRichTextValue(html: string | null | undefined): string {
  if (isEmptyRichText(html)) return ''
  return html?.trim() ?? ''
}

export function isDirtySnapshot<T>(current: T, snapshot: string | null): boolean {
  if (snapshot === null) return false
  return snapshotOf(current) !== snapshot
}

export async function commitFormSnapshot<T>(getValue: () => T): Promise<string> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
  return snapshotOf(getValue())
}
