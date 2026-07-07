<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import SearchHighlight from '@/components/SearchHighlight.vue'
import {
  globalSearchTypeBadgeClass,
  type GlobalSearchDetailLine,
  type GlobalSearchHit,
  type GlobalSearchIndexId,
} from '@/lib/globalSearch'
import { appendGridReturn, buildGridReturnPath } from '@/lib/gridReturnNavigation'
import { globalSearchReturnPath } from '@/lib/globalSearchNavigation'

const props = defineProps<{
  hit: GlobalSearchHit
  searchQuery?: string
  searchTypes?: GlobalSearchIndexId[]
}>()

const route = useRoute()

const searchReturnPath = computed(() => {
  const q = props.searchQuery
  if (q) {
    return globalSearchReturnPath({ query: q, types: props.searchTypes ?? [] })
  }
  return buildGridReturnPath(route)
})

function withSearchReturn(to: NonNullable<GlobalSearchHit['route']>) {
  return appendGridReturn(to, searchReturnPath.value)
}

const linkTarget = computed(() => {
  if (!props.hit.route) return null
  return withSearchReturn(props.hit.route)
})

const showCompanyLogo = computed(() => Boolean(props.hit.companyId))

const companyInitial = computed(() => {
  const label = props.hit.companyLabel?.trim() || props.hit.title.trim()
  return label.charAt(0).toUpperCase() || '?'
})

const companyLogoAlt = computed(() => {
  const label = props.hit.companyLabel?.trim() || props.hit.title.trim()
  return `${label} logo`
})

const typeBadgeClass = computed(() => globalSearchTypeBadgeClass(props.hit.indexId))

const companyLinkTarget = computed(() => {
  if (!props.hit.companyId || props.hit.indexId === 'companies') return null
  return withSearchReturn({ name: 'company-details', params: { id: props.hit.companyId } })
})

const showCompanySubtitleLink = computed(() => {
  if (!companyLinkTarget.value || !props.hit.subtitle) return false

  const label = props.hit.companyLabel?.trim()
  const subtitle = props.hit.subtitle.trim()
  return Boolean(label && label === subtitle)
})

const detailLinkClass =
  'pointer-events-auto truncate text-epms-800 underline decoration-epms-300 underline-offset-2 hover:text-epms-950'

function showDetailLabel(detail: GlobalSearchDetailLine): boolean {
  return Boolean(detail.label)
}
</script>

<template>
  <article
    class="group relative flex h-full flex-col rounded-xl border border-stone-200 bg-white p-3 shadow-sm transition"
    :class="linkTarget ? 'hover:border-epms-200 hover:bg-epms-50/30 hover:shadow-md' : ''"
  >
    <RouterLink
      v-if="linkTarget"
      :to="linkTarget"
      class="absolute inset-0 z-0 rounded-xl"
      :aria-label="`Open ${hit.title}`"
      tabindex="-1"
    />

    <div class="relative z-10 flex h-full flex-col pointer-events-none">
      <div class="flex items-start gap-3">
        <RouterLink
          v-if="showCompanyLogo && companyLinkTarget"
          :to="companyLinkTarget"
          class="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border-[0.5px] border-stone-200 bg-stone-50 transition hover:border-epms-200 hover:bg-epms-50"
          :aria-label="`Open ${hit.companyLabel ?? 'company'}`"
          @click.stop
        >
          <img
            v-if="hit.companyLogoUrl"
            :src="hit.companyLogoUrl"
            :alt="companyLogoAlt"
            class="h-full w-full object-contain"
          />
          <span v-else class="text-sm font-semibold text-stone-400">
            {{ companyInitial }}
          </span>
        </RouterLink>
        <div
          v-else-if="showCompanyLogo"
          class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border-[0.5px] border-stone-200 bg-stone-50"
        >
          <img
            v-if="hit.companyLogoUrl"
            :src="hit.companyLogoUrl"
            :alt="companyLogoAlt"
            class="h-full w-full object-contain"
          />
          <span v-else class="text-sm font-semibold text-stone-400">
            {{ companyInitial }}
          </span>
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <span
              class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
              :class="typeBadgeClass"
            >
              {{ hit.indexLabel }}
            </span>
          </div>

          <h3
            class="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-epms-900"
            :class="linkTarget ? 'group-hover:underline' : ''"
          >
            <SearchHighlight v-if="hit.titleHtml" :html="hit.titleHtml" />
            <template v-else>{{ hit.title }}</template>
          </h3>

          <p v-if="showCompanySubtitleLink" class="mt-1 line-clamp-1 text-xs">
            <RouterLink
              :to="companyLinkTarget!"
              class="pointer-events-auto font-medium"
              :class="detailLinkClass"
              @click.stop
            >
              {{ hit.subtitle }}
            </RouterLink>
          </p>
          <p v-else-if="hit.subtitle" class="mt-1 line-clamp-1 text-xs text-stone-500">
            {{ hit.subtitle }}
          </p>

          <div v-if="hit.details.length > 0" class="mt-2 space-y-0.5">
            <div
              v-for="(detail, index) in hit.details"
              :key="`${detail.label ?? ''}-${detail.value}-${index}`"
              class="text-xs leading-5"
            >
              <p
                v-if="!showDetailLabel(detail) && detail.segments?.length"
                class="min-w-0 break-words text-stone-500 leading-relaxed"
              >
                <template v-for="(segment, segmentIndex) in detail.segments" :key="segment">
                  <span
                    v-if="segmentIndex > 0"
                    class="px-0.5 text-base font-bold leading-none text-stone-400"
                    aria-hidden="true"
                  >
                    ·
                  </span>
                  {{ segment }}
                </template>
              </p>
              <a
                v-else-if="!showDetailLabel(detail) && detail.href"
                :href="detail.href"
                class="block min-w-0 truncate"
                :class="detailLinkClass"
                :target="detail.href.startsWith('mailto:') ? undefined : '_blank'"
                :rel="detail.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'"
                @click.stop
              >
                {{ detail.value }}
              </a>
              <p v-else-if="!showDetailLabel(detail)" class="truncate text-stone-500">
                {{ detail.value }}
              </p>
              <div v-else class="flex gap-1">
                <span class="shrink-0 text-stone-500">{{ detail.label }}:</span>
                <span class="min-w-0 truncate text-stone-700">{{ detail.value }}</span>
              </div>
            </div>
          </div>

          <div
            v-if="hit.indexId === 'notes' && hit.bodyHtml"
            class="global-search-note-body mt-2 max-h-28 overflow-hidden text-xs leading-5 text-stone-700"
          >
            <SearchHighlight :html="hit.bodyHtml" />
          </div>

          <div v-else-if="hit.matchHints.length > 0" class="mt-2 space-y-1">
            <div
              v-for="(hint, index) in hit.matchHints"
              :key="`${hint.label}-${index}`"
              class="line-clamp-2 text-xs leading-5 text-stone-600"
            >
              <span class="font-semibold text-stone-500">{{ hint.label }}:</span>
              {{ ' ' }}
              <SearchHighlight :html="hint.html" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.global-search-note-body :where(p, ul, ol) {
  margin: 0.25rem 0;
}

.global-search-note-body :where(ul, ol) {
  padding-left: 1.1rem;
}

.global-search-note-body :where(li) {
  margin: 0.125rem 0;
}
</style>
