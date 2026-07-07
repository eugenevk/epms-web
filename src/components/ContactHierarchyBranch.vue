<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useGridReturnLink } from '@/composables/useGridReturnLink'
import type { ContactHierarchyNode } from '@/lib/contactHierarchy'

const props = defineProps<{
  node: ContactHierarchyNode
  isRoot?: boolean
  focusContactId?: string | null
}>()

const { withReturn } = useGridReturnLink()

const isFocused = computed(() => props.focusContactId != null && props.node.id === props.focusContactId)

const contactDetailsRoute = computed(() =>
  withReturn({
    name: 'contact-details',
    params: { id: props.node.id },
    ...(props.focusContactId != null ? { query: { tab: 'reporting-lines' } } : {}),
  }),
)

const childrenRef = ref<HTMLElement | null>(null)
const childrenStyle = ref<Record<string, string>>({})

function updateRail() {
  const childrenEl = childrenRef.value
  if (!childrenEl || props.node.children.length < 2) {
    childrenStyle.value = {}
    return
  }

  const branches = [...childrenEl.children].filter(
    (element): element is HTMLElement => element instanceof HTMLElement,
  )
  if (branches.length < 2) {
    childrenStyle.value = {}
    return
  }

  const childrenRect = childrenEl.getBoundingClientRect()
  let minCenter = Number.POSITIVE_INFINITY
  let maxCenter = Number.NEGATIVE_INFINITY

  for (const branch of branches) {
    const wrapper = branch.querySelector(':scope > .org-node-wrapper')
    if (!(wrapper instanceof HTMLElement)) continue

    const rect = wrapper.getBoundingClientRect()
    const center = rect.left + rect.width / 2 - childrenRect.left
    minCenter = Math.min(minCenter, center)
    maxCenter = Math.max(maxCenter, center)
  }

  if (!Number.isFinite(minCenter) || !Number.isFinite(maxCenter) || maxCenter <= minCenter) {
    childrenStyle.value = {}
    return
  }

  childrenStyle.value = {
    '--org-rail-left': `${minCenter}px`,
    '--org-rail-width': `${maxCenter - minCenter}px`,
  }
}

let resizeObserver: ResizeObserver | null = null

function observeChildren() {
  if (!resizeObserver || !childrenRef.value) return

  resizeObserver.observe(childrenRef.value)
  for (const branch of childrenRef.value.children) {
    if (branch instanceof HTMLElement) {
      resizeObserver.observe(branch)
    }
  }
}

async function scheduleRailUpdate() {
  await nextTick()
  requestAnimationFrame(() => {
    updateRail()
    observeChildren()
  })
}

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      updateRail()
    })
  }

  void scheduleRailUpdate()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

watch(
  () => props.node.children.map((child) => child.id).join(','),
  () => {
    void scheduleRailUpdate()
  },
)
</script>

<template>
  <li class="org-branch" :class="{ 'org-tree-root-cell': isRoot }">
    <div class="org-node-wrapper">
      <div
        v-if="isFocused"
        class="org-node org-node-focused"
        :class="{
          'org-node-manager': !node.inReportingSet,
          'org-node-left': node.hasLeft,
        }"
      >
        <p class="org-node-name">{{ node.name }}</p>
        <p v-if="node.position" class="org-node-meta">{{ node.position }}</p>
        <p v-if="node.companyLabel" class="org-node-meta">
          <RouterLink
            v-if="node.companyId"
            :to="withReturn({ name: 'company-details', params: { id: node.companyId } })"
            class="org-node-company-link"
          >
            {{ node.companyLabel }}
          </RouterLink>
          <template v-else>{{ node.companyLabel }}</template>
        </p>
        <p v-if="node.hasLeft" class="org-node-badge org-node-badge-left">Left company</p>
        <p v-else-if="!node.inReportingSet" class="org-node-badge">Manager</p>
      </div>
      <RouterLink
        v-else-if="!node.isExternal"
        :to="contactDetailsRoute"
        class="org-node"
        :class="{
          'org-node-manager': !node.inReportingSet,
          'org-node-left': node.hasLeft,
        }"
      >
        <p class="org-node-name">{{ node.name }}</p>
        <p v-if="node.position" class="org-node-meta">{{ node.position }}</p>
        <p v-if="node.companyLabel" class="org-node-meta">
          <RouterLink
            v-if="node.companyId"
            :to="withReturn({ name: 'company-details', params: { id: node.companyId } })"
            class="org-node-company-link"
          >
            {{ node.companyLabel }}
          </RouterLink>
          <template v-else>{{ node.companyLabel }}</template>
        </p>
        <p v-if="node.hasLeft" class="org-node-badge org-node-badge-left">Left company</p>
        <p v-else-if="!node.inReportingSet" class="org-node-badge">Manager</p>
      </RouterLink>
      <div
        v-else
        class="org-node org-node-external"
        :title="'This manager is not a contact at this company'"
      >
        <p class="org-node-name">{{ node.name }}</p>
        <p v-if="node.position" class="org-node-meta">{{ node.position }}</p>
        <p v-if="node.companyLabel" class="org-node-meta">
          <RouterLink
            v-if="node.companyId"
            :to="withReturn({ name: 'company-details', params: { id: node.companyId } })"
            class="org-node-company-link"
          >
            {{ node.companyLabel }}
          </RouterLink>
          <template v-else>{{ node.companyLabel }}</template>
        </p>
      </div>
    </div>

    <div v-if="node.children.length > 0" class="org-subtree">
      <ul
        ref="childrenRef"
        class="org-children"
        :class="{ 'org-children-has-rail': node.children.length > 1 }"
        :style="childrenStyle"
      >
        <ContactHierarchyBranch
          v-for="child in node.children"
          :key="child.id"
          :node="child"
          :focus-contact-id="focusContactId"
        />
      </ul>
    </div>
  </li>
</template>
