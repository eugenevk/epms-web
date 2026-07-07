import { contactDisplayName, type ContactNameFields } from '@/lib/contactNames'
import type { ContactHit } from '@/lib/contactsAlgolia'
import { loadContact } from '@/lib/contactRecords'
import { loadContactsReportingIntoFromFirestore } from '@/lib/contacts'

export type ContactHierarchyContact = {
  id: string
  name: string
  position: string | null
  hasLeft: boolean
  companyId: string | null
  companyLabel: string | null
  reportsInto: { id: string; objectLabel?: string } | null
}

export type ExternalManagerInfo = {
  companyId: string | null
  companyLabel: string | null
  position: string | null
  name: string | null
}

export type ContactHierarchyNode = {
  id: string
  name: string
  position: string | null
  hasLeft: boolean
  inReportingSet: boolean
  isExternal: boolean
  companyId: string | null
  companyLabel: string | null
  children: ContactHierarchyNode[]
}

export function mapContactRecordToHierarchyContact(contact: {
  id: string
  firstName?: string | null
  lastName?: string
  fullName?: string
  objectLabel?: string
  position?: string | null
  hasLeft?: boolean
  company?: { id?: string; objectLabel?: string } | null
  reportsInto?: { id?: string; objectLabel?: string } | null
}): ContactHierarchyContact {
  return {
    id: contact.id,
    name: contactDisplayName(contact),
    position: contact.position?.trim() || null,
    hasLeft: contact.hasLeft === true,
    companyId: contact.company?.id ?? null,
    companyLabel: contact.company?.objectLabel?.trim() || null,
    reportsInto: contact.reportsInto?.id
      ? {
          id: contact.reportsInto.id,
          objectLabel: contact.reportsInto.objectLabel,
        }
      : null,
  }
}

export function mapContactHitToHierarchyContact(hit: ContactHit): ContactHierarchyContact {
  const id = hit.id ?? hit.objectID

  return {
    id,
    name: contactDisplayName(hit),
    position: hit.position?.trim() || null,
    hasLeft: hit.hasLeft === true,
    companyId: hit.company?.id ?? null,
    companyLabel: hit.company?.objectLabel?.trim() || null,
    reportsInto: hit.reportsInto?.id
      ? {
          id: hit.reportsInto.id,
          objectLabel: hit.reportsInto.objectLabel,
        }
      : null,
  }
}

export function mapContactNameFieldsToHierarchyContact(
  id: string,
  fields: ContactNameFields & {
    position?: string | null
    hasLeft?: boolean
    reportsInto?: { id?: string; objectLabel?: string } | null
  },
): ContactHierarchyContact {
  return {
    id,
    name: contactDisplayName(fields),
    position: fields.position?.trim() || null,
    hasLeft: fields.hasLeft === true,
    companyId: null,
    companyLabel: null,
    reportsInto: fields.reportsInto?.id
      ? {
          id: fields.reportsInto.id,
          objectLabel: fields.reportsInto.objectLabel,
        }
      : null,
  }
}

export function countContactsWithReportsInto(contacts: ContactHierarchyContact[]): number {
  return contacts.filter((contact) => contact.reportsInto?.id).length
}

export async function expandHierarchyContactsWithDirectReports(
  contacts: ContactHierarchyContact[],
  loadDirectReports: (managerId: string) => Promise<ContactHierarchyContact[]>,
): Promise<ContactHierarchyContact[]> {
  const pool = new Map(contacts.map((contact) => [contact.id, contact]))
  const queried = new Set<string>()
  const queue = [...pool.keys()]

  while (queue.length > 0) {
    const managerId = queue.shift()!
    if (queried.has(managerId)) continue
    queried.add(managerId)

    const reports = await loadDirectReports(managerId)
    for (const report of reports) {
      if (pool.has(report.id)) continue
      pool.set(report.id, report)
      queue.push(report.id)
    }
  }

  return [...pool.values()]
}

function contactCompanyDisplay(
  contact: ContactHierarchyContact,
): Pick<ContactHierarchyNode, 'companyId' | 'companyLabel'> {
  if (!contact.companyId || !contact.companyLabel) {
    return { companyId: null, companyLabel: null }
  }

  return {
    companyId: contact.companyId,
    companyLabel: contact.companyLabel,
  }
}

function createNode(
  contact: ContactHierarchyContact,
  inReportingSet: boolean,
  isExternal = false,
  externalInfo: Pick<ExternalManagerInfo, 'companyId' | 'companyLabel'> | null = null,
): ContactHierarchyNode {
  const company = contactCompanyDisplay(contact)

  return {
    id: contact.id,
    name: contact.name,
    position: contact.position,
    hasLeft: contact.hasLeft,
    inReportingSet,
    isExternal,
    companyId: isExternal ? (externalInfo?.companyId ?? company.companyId) : company.companyId,
    companyLabel: isExternal
      ? (externalInfo?.companyLabel ?? company.companyLabel)
      : company.companyLabel,
    children: [],
  }
}

function sortNodes(nodes: ContactHierarchyNode[]): ContactHierarchyNode[] {
  return [...nodes].sort((left, right) =>
    left.name.localeCompare(right.name, 'en', { sensitivity: 'base' }),
  )
}

function normalizeContactId(id: string): string {
  return id.trim()
}

function buildContactsById(
  contacts: ContactHierarchyContact[],
): Map<string, ContactHierarchyContact> {
  const contactsById = new Map<string, ContactHierarchyContact>()

  for (const contact of contacts) {
    contactsById.set(contact.id, contact)
    contactsById.set(normalizeContactId(contact.id), contact)
  }

  return contactsById
}

function resolveManagerId(
  managerId: string,
  contactsById: Map<string, ContactHierarchyContact>,
): string {
  const normalized = normalizeContactId(managerId)
  const manager = contactsById.get(normalized)
  return manager?.id ?? normalized
}

function buildDirectReportsIndex(
  contacts: ContactHierarchyContact[],
  contactsById: Map<string, ContactHierarchyContact>,
): Map<string, ContactHierarchyContact[]> {
  const index = new Map<string, ContactHierarchyContact[]>()

  for (const contact of contacts) {
    const rawManagerId = contact.reportsInto?.id
    if (!rawManagerId) continue

    const managerId = resolveManagerId(rawManagerId, contactsById)
    const reports = index.get(managerId) ?? []
    reports.push(contact)
    index.set(managerId, reports)
  }

  return index
}

function ensureManagerNode(
  managerId: string,
  contactsById: Map<string, ContactHierarchyContact>,
  reportingIds: Set<string>,
  externalManagerByContactId: ReadonlyMap<string, ExternalManagerInfo>,
  nodeMap: Map<string, ContactHierarchyNode>,
  reporterHint?: ContactHierarchyContact,
): ContactHierarchyNode | null {
  const resolvedManagerId = resolveManagerId(managerId, contactsById)
  const existing = nodeMap.get(resolvedManagerId)
  if (existing) return existing

  const manager = contactsById.get(resolvedManagerId)
  if (manager) {
    const node = createNode(manager, reportingIds.has(manager.id))
    nodeMap.set(manager.id, node)
    return node
  }

  const externalInfo =
    externalManagerByContactId.get(resolvedManagerId) ??
    externalManagerByContactId.get(managerId)
  const reportsIntoRef = reporterHint?.reportsInto

  const node = createNode(
    {
      id: resolvedManagerId,
      name:
        externalInfo?.name?.trim() ||
        reportsIntoRef?.objectLabel?.trim() ||
        'Unknown manager',
      position: externalInfo?.position ?? null,
      hasLeft: false,
      companyId: externalInfo?.companyId ?? null,
      companyLabel: externalInfo?.companyLabel ?? null,
      reportsInto: null,
    },
    false,
    true,
    externalInfo ?? null,
  )
  nodeMap.set(resolvedManagerId, node)
  return node
}

function ensureReporterNode(
  contact: ContactHierarchyContact,
  reportingIds: Set<string>,
  nodeMap: Map<string, ContactHierarchyNode>,
): ContactHierarchyNode {
  const existing = nodeMap.get(contact.id)
  if (existing) return existing

  const node = createNode(contact, reportingIds.has(contact.id))
  nodeMap.set(contact.id, node)
  return node
}

function attachDirectReports(
  parent: ContactHierarchyNode,
  reports: ContactHierarchyContact[],
  reportingIds: Set<string>,
  nodeMap: Map<string, ContactHierarchyNode>,
) {
  const seenChildIds = new Set(parent.children.map((child) => child.id))

  for (const report of reports) {
    const child = ensureReporterNode(report, reportingIds, nodeMap)
    if (child.id === parent.id || seenChildIds.has(child.id)) continue

    parent.children.push(child)
    seenChildIds.add(child.id)
  }

  parent.children = sortNodes(parent.children)
}

export function buildContactReportingForest(
  contacts: ContactHierarchyContact[],
  externalManagerByContactId: ReadonlyMap<string, ExternalManagerInfo> = new Map(),
): ContactHierarchyNode[] {
  const reportingContacts = contacts.filter((contact) => contact.reportsInto?.id)
  if (reportingContacts.length === 0) return []

  const contactsById = buildContactsById(contacts)
  const reportingIds = new Set(reportingContacts.map((contact) => contact.id))
  const directReportsIndex = buildDirectReportsIndex(contacts, contactsById)
  const nodeMap = new Map<string, ContactHierarchyNode>()

  for (const contact of reportingContacts) {
    ensureReporterNode(contact, reportingIds, nodeMap)
    ensureManagerNode(
      contact.reportsInto!.id,
      contactsById,
      reportingIds,
      externalManagerByContactId,
      nodeMap,
      contact,
    )
  }

  for (const managerId of directReportsIndex.keys()) {
    ensureManagerNode(
      managerId,
      contactsById,
      reportingIds,
      externalManagerByContactId,
      nodeMap,
    )
  }

  for (const [managerId, reports] of directReportsIndex) {
    const parent = nodeMap.get(resolveManagerId(managerId, contactsById))
    if (!parent) continue
    attachDirectReports(parent, reports, reportingIds, nodeMap)
  }

  const childIds = new Set<string>()
  for (const node of nodeMap.values()) {
    for (const child of node.children) {
      childIds.add(child.id)
    }
  }

  return sortNodes([...nodeMap.values()].filter((node) => !childIds.has(node.id)))
}

function buildDescendantSubtree(
  contactId: string,
  contactsById: Map<string, ContactHierarchyContact>,
  directReportsIndex: Map<string, ContactHierarchyContact[]>,
  reportingIds: Set<string>,
): ContactHierarchyNode | null {
  const contact = contactsById.get(contactId) ?? contactsById.get(normalizeContactId(contactId))
  if (!contact) return null

  const node = createNode(contact, reportingIds.has(contact.id))
  const reports = directReportsIndex.get(contact.id) ?? directReportsIndex.get(normalizeContactId(contact.id)) ?? []

  for (const report of reports) {
    if (report.id === contact.id) continue
    const child = buildDescendantSubtree(
      report.id,
      contactsById,
      directReportsIndex,
      reportingIds,
    )
    if (child) node.children.push(child)
  }

  node.children = sortNodes(node.children)
  return node
}

export function hasPersonalReportingLine(
  contactId: string,
  contacts: ContactHierarchyContact[],
): boolean {
  const contactsById = buildContactsById(contacts)
  const focal = contactsById.get(contactId) ?? contactsById.get(normalizeContactId(contactId))
  if (!focal) return false

  if (focal.reportsInto?.id) return true

  const directReportsIndex = buildDirectReportsIndex(contacts, contactsById)
  const reports =
    directReportsIndex.get(focal.id) ?? directReportsIndex.get(normalizeContactId(focal.id)) ?? []
  return reports.length > 0
}

export function buildPersonalReportingTree(
  contactId: string,
  contacts: ContactHierarchyContact[],
  externalManagerByContactId: ReadonlyMap<string, ExternalManagerInfo> = new Map(),
): ContactHierarchyNode | null {
  const contactsById = buildContactsById(contacts)
  const focal = contactsById.get(contactId) ?? contactsById.get(normalizeContactId(contactId))
  if (!focal) return null

  const reportingIds = new Set(contacts.filter((contact) => contact.reportsInto?.id).map((contact) => contact.id))
  const directReportsIndex = buildDirectReportsIndex(contacts, contactsById)

  const focalSubtree =
    buildDescendantSubtree(
      focal.id,
      contactsById,
      directReportsIndex,
      reportingIds,
    ) ?? createNode(focal, reportingIds.has(focal.id))

  const directReportsInto = focal.reportsInto
  if (!directReportsInto?.id) {
    return focalSubtree
  }

  const managerId = resolveManagerId(directReportsInto.id, contactsById)
  const manager = contactsById.get(managerId)
  const externalInfo =
    externalManagerByContactId.get(managerId) ??
    externalManagerByContactId.get(directReportsInto.id)

  const managerNode = manager
    ? createNode(manager, reportingIds.has(manager.id))
    : createNode(
        {
          id: managerId,
          name:
            externalInfo?.name?.trim() ||
            directReportsInto.objectLabel?.trim() ||
            'Unknown manager',
          position: externalInfo?.position ?? null,
          hasLeft: false,
          companyId: externalInfo?.companyId ?? null,
          companyLabel: externalInfo?.companyLabel ?? null,
          reportsInto: null,
        },
        false,
        true,
        externalInfo ?? null,
      )

  const managerReports =
    directReportsIndex.get(managerId) ??
    directReportsIndex.get(normalizeContactId(managerId)) ??
    []

  if (managerReports.length > 0) {
    managerNode.children = sortNodes(
      managerReports
        .map((report) =>
          buildDescendantSubtree(
            report.id,
            contactsById,
            directReportsIndex,
            reportingIds,
          ),
        )
        .filter((node): node is ContactHierarchyNode => node !== null),
    )
  } else {
    managerNode.children = [focalSubtree]
  }

  return managerNode
}

export async function loadExternalManagerInfoByContactId(
  contacts: ContactHierarchyContact[],
  knownContactIds: ReadonlySet<string>,
): Promise<Map<string, ExternalManagerInfo>> {
  const externalManagerIds = new Set<string>()

  for (const contact of contacts) {
    const managerId = contact.reportsInto?.id
    if (managerId && !knownContactIds.has(managerId)) {
      externalManagerIds.add(managerId)
    }
  }

  const managers = new Map<string, ExternalManagerInfo>()
  await Promise.all(
    [...externalManagerIds].map(async (managerId) => {
      try {
        const manager = await loadContact(managerId)
        managers.set(managerId, {
          companyId: manager.company?.id ?? null,
          companyLabel: manager.company?.objectLabel?.trim() || null,
          position: manager.position?.trim() || null,
          name: contactDisplayName(manager),
        })
      } catch {
        // Manager record unavailable.
      }
    }),
  )

  return managers
}

export async function loadPersonalHierarchyContacts(
  contactId: string,
): Promise<{
  contacts: ContactHierarchyContact[]
  externalManagerByContactId: Map<string, ExternalManagerInfo>
}> {
  const focalContact = await loadContact(contactId)
  const pool = new Map<string, ContactHierarchyContact>()
  pool.set(focalContact.id, mapContactRecordToHierarchyContact(focalContact))

  const directManagerId = focalContact.reportsInto?.id ?? null
  if (directManagerId && !pool.has(directManagerId)) {
    try {
      const manager = await loadContact(directManagerId)
      pool.set(manager.id, mapContactRecordToHierarchyContact(manager))
    } catch {
      pool.set(directManagerId, {
        id: directManagerId,
        name: focalContact.reportsInto?.objectLabel?.trim() || 'Unknown manager',
        position: null,
        hasLeft: false,
        companyId: null,
        companyLabel: null,
        reportsInto: null,
      })
    }
  }

  const baseContacts = [...pool.values()]
  const contacts = await expandHierarchyContactsWithDirectReports(
    baseContacts,
    async (managerContactId) => {
      const reports = await loadContactsReportingIntoFromFirestore(managerContactId)
      return reports.map(mapContactHitToHierarchyContact)
    },
  )

  const knownContactIds = new Set(contacts.map((contact) => contact.id))
  const externalManagerByContactId = await loadExternalManagerInfoByContactId(contacts, knownContactIds)

  return {
    contacts,
    externalManagerByContactId,
  }
}
