<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ContactHierarchyBranch from '@/components/ContactHierarchyBranch.vue'
import {
  buildContactReportingForest,
  countContactsWithReportsInto,
  expandHierarchyContactsWithDirectReports,
  loadExternalManagerInfoByContactId,
  mapContactHitToHierarchyContact,
  type ContactHierarchyContact,
  type ExternalManagerInfo,
} from '@/lib/contactHierarchy'
import {
  loadCompanyContactsFromFirestore,
  loadContactsReportingIntoFromFirestore,
} from '@/lib/contacts'

const props = defineProps<{
  companyId: string
}>()

const emit = defineEmits<{
  loaded: [reportingCount: number]
}>()

const loading = ref(true)
const error = ref<string | null>(null)
const contacts = ref<ContactHierarchyContact[]>([])
const companyReportingCount = ref(0)
const externalManagerByContactId = ref<Map<string, ExternalManagerInfo>>(new Map())

const reportingCount = computed(() => companyReportingCount.value)
const roots = computed(() =>
  buildContactReportingForest(
    contacts.value,
    externalManagerByContactId.value,
  ),
)

async function loadHierarchy() {
  loading.value = true
  error.value = null

  try {
    const hits = await loadCompanyContactsFromFirestore(props.companyId)
    const companyContacts = hits.map(mapContactHitToHierarchyContact)
    const hierarchyContacts = await expandHierarchyContactsWithDirectReports(
      companyContacts,
      async (managerId) => {
        const reports = await loadContactsReportingIntoFromFirestore(managerId)
        return reports.map(mapContactHitToHierarchyContact)
      },
    )
    contacts.value = hierarchyContacts
    companyReportingCount.value = countContactsWithReportsInto(companyContacts)
    const knownContactIds = new Set(hierarchyContacts.map((contact) => contact.id))
    externalManagerByContactId.value = await loadExternalManagerInfoByContactId(
      hierarchyContacts,
      knownContactIds,
    )
    emit('loaded', companyReportingCount.value)
  } catch (loadError) {
    contacts.value = []
    companyReportingCount.value = 0
    externalManagerByContactId.value = new Map()
    error.value = loadError instanceof Error ? loadError.message : 'Could not load contacts.'
    emit('loaded', 0)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadHierarchy()
})

watch(
  () => props.companyId,
  () => {
    void loadHierarchy()
  },
)
</script>

<template>
  <div>
    <p v-if="loading" class="text-sm text-stone-500">Loading reporting lines…</p>

    <p
      v-else-if="error"
      class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {{ error }}
    </p>

    <p
      v-else-if="reportingCount === 0"
      class="rounded-xl border border-stone-200 bg-stone-50 px-4 py-8 text-center text-sm text-stone-600"
    >
      No contacts with a Reports into field have been recorded for this company.
    </p>

    <div v-else class="org-tree-shell">
      <div class="org-tree-canvas">
        <ul class="org-tree">
          <ContactHierarchyBranch v-for="root in roots" :key="root.id" :node="root" is-root />
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.org-tree-shell {
  --org-line: #d6d3d1;
  --org-connector: 1.5rem;
  --org-sibling-gap: 2rem;
  --org-line-width: 2px;
  max-width: 100%;
  max-height: min(70vh, 42rem);
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.org-tree-canvas {
  display: block;
  width: max-content;
  min-width: 100%;
  padding: 1rem;
  box-sizing: border-box;
  margin-inline: auto;
}

.org-tree,
.org-tree :deep(.org-children) {
  list-style: none;
  margin: 0;
  padding: 0;
}

.org-tree {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: flex-start;
  width: max-content;
  margin-inline: auto;
}

.org-tree :deep(.org-tree-root-cell) {
  flex: 0 0 auto;
  padding-inline: calc(var(--org-sibling-gap) / 2);
}

.org-tree :deep(.org-branch) {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  flex: 0 0 auto;
}

.org-tree :deep(.org-node-wrapper) {
  position: relative;
  z-index: 1;
}

.org-tree :deep(.org-node) {
  display: block;
  min-width: 11rem;
  max-width: 14rem;
  border-radius: 0.75rem;
  border: 1px solid #e7e5e4;
  background: #fff;
  padding: 0.75rem 0.875rem;
  text-align: center;
  box-shadow: 0 1px 2px rgb(12 74 110 / 0.05);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}

.org-tree :deep(.org-node:hover) {
  border-color: #bae6fd;
  background: #f0f9ff;
  box-shadow: 0 4px 12px rgb(12 74 110 / 0.08);
}

.org-tree :deep(.org-node-manager) {
  border-style: dashed;
  background: #fafaf9;
}

.org-tree :deep(.org-node-external) {
  border-style: dotted;
  background: #fafaf9;
  color: #57534e;
  cursor: default;
}

.org-tree :deep(.org-node-left) {
  opacity: 0.75;
}

.org-tree :deep(.org-node-name) {
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.25rem;
  color: #0c4a6e;
}

.org-tree :deep(.org-node-meta) {
  margin-top: 0.125rem;
  font-size: 0.75rem;
  line-height: 1rem;
  color: #57534e;
}

.org-tree :deep(.org-node-company-link) {
  color: #0369a1;
  font-weight: 500;
  text-decoration: none;
}

.org-tree :deep(.org-node-company-link:hover) {
  text-decoration: underline;
}

.org-tree :deep(.org-node-badge) {
  margin-top: 0.375rem;
  display: inline-flex;
  border-radius: 9999px;
  background: #f5f5f4;
  padding: 0.125rem 0.5rem;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #78716c;
}

.org-tree :deep(.org-node-badge-left) {
  background: #fef2f2;
  color: #b91c1c;
}

/* Parent stem → measured horizontal rail → child stems → cards */
.org-tree :deep(.org-branch:has(> .org-subtree) > .org-node-wrapper::after) {
  content: '';
  display: block;
  width: var(--org-line-width);
  height: var(--org-connector);
  margin: 0 auto;
  background: var(--org-line);
}

.org-tree :deep(.org-subtree) {
  position: relative;
  width: max-content;
  max-width: 100%;
  margin-inline: auto;
}

.org-tree :deep(.org-children) {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: flex-start;
  justify-content: flex-start;
  position: relative;
  width: max-content;
  max-width: 100%;
  padding-top: var(--org-connector);
}

.org-tree :deep(.org-children.org-children-has-rail::before) {
  content: '';
  position: absolute;
  top: 0;
  left: var(--org-rail-left, 0);
  width: var(--org-rail-width, 0);
  max-width: var(--org-rail-width, 0);
  height: var(--org-line-width);
  background: var(--org-line);
  pointer-events: none;
  z-index: 0;
}

.org-tree :deep(.org-children > .org-branch) {
  flex: 0 0 auto;
  padding-inline: calc(var(--org-sibling-gap) / 2);
}

.org-tree :deep(.org-children > .org-branch > .org-node-wrapper::before) {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  width: var(--org-line-width);
  height: var(--org-connector);
  background: var(--org-line);
  transform: translateX(-50%);
  z-index: 1;
}
</style>
