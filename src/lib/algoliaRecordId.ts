export function resolveAlgoliaRecordId(record: {
  objectID?: string | null
  id?: string | null
}): string {
  const objectId = typeof record.objectID === 'string' ? record.objectID.trim() : ''
  if (objectId) return objectId

  const id = typeof record.id === 'string' ? record.id.trim() : ''
  return id
}
