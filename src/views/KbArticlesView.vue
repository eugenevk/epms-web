<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AlgoliaFacetFilter from '@/components/AlgoliaFacetFilter.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import GridPagination from '@/components/GridPagination.vue'
import GridSearchStats from '@/components/GridSearchStats.vue'
import GridSortHeader from '@/components/GridSortHeader.vue'
import KbArticleDialog from '@/components/KbArticleDialog.vue'
import KbArticleHoverPreview from '@/components/KbArticleHoverPreview.vue'
import SearchHighlight from '@/components/SearchHighlight.vue'
import { useToast } from '@/composables/useToast'
import { useListGridRouteQuery } from '@/composables/useListGridRouteQuery'
import { useGridSearchFocus } from '@/composables/useGridSearchFocus'
import { useGridSort } from '@/composables/useGridSort'
import { highlightQueryInText } from '@/lib/algoliaHighlight'
import {
  iconActionDeleteClassCompact,
  iconActionEditClassCompact,
} from '@/lib/iconActionClasses'
import { formatKbArticleCategories } from '@/lib/kbArticleCategories'
import {
  KB_ARTICLE_GRID_DEFAULT_SORT,
  kbArticleSnippetText,
} from '@/lib/kbArticles'
import {
  formatKbArticleFacetLabel,
  KB_ARTICLE_FACET_KEYS,
  kbArticleRecordId,
  searchKbArticles,
  type KbArticleFacetFilters,
  type KbArticleFacetKey,
  type KbArticleHit,
} from '@/lib/kbArticlesAlgolia'
import { paginateItems } from '@/lib/gridPagination'
import { deleteKbArticle } from '@/lib/kbArticleRecords'

const toast = useToast()
const { searchInputRef, focusSearchInput } = useGridSearchFocus()

const query = ref('')
const debouncedQuery = ref('')
const facetFilters = ref<KbArticleFacetFilters>({})
const showFilters = ref(true)
const loading = ref(true)
const error = ref<string | null>(null)
const hits = ref<KbArticleHit[]>([])
const page = ref(0)
const nbHits = ref(0)
const facets = ref<Partial<Record<KbArticleFacetKey, Record<string, number>>>>({})
const showArticleDialog = ref(false)
const editingArticleId = ref<string | null>(null)
const showDeleteDialog = ref(false)
const deletingArticleId = ref<string | null>(null)
const deleting = ref(false)

let debounceTimer: number | undefined

useListGridRouteQuery('kb-articles', query, debouncedQuery)

const { sortState, sortedItems, onSort } = useGridSort(
  hits,
  {
    title: (article) => article.title ?? '',
    categories: (article) => formatKbArticleCategories(article.categories),
    publishedAt: (article) => article.publishedAt ?? '',
    summary: (article) => kbArticleSnippetText(article),
  },
  KB_ARTICLE_GRID_DEFAULT_SORT,
  { title: 'asc', publishedAt: 'desc' },
)

const pagination = computed(() => paginateItems(sortedItems.value, page.value))
const visibleHits = computed(() => pagination.value.items)

const hasActiveFilters = computed(() =>
  KB_ARTICLE_FACET_KEYS.some((key) => (facetFilters.value[key]?.length ?? 0) > 0),
)

const facetLabels: Record<KbArticleFacetKey, string> = {
  categories: 'Categories',
}

watch(query, (value) => {
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(() => {
    debouncedQuery.value = value
  }, 250)
})

watch(
  () => [debouncedQuery.value, facetFilters.value] as const,
  () => {
    page.value = 0
    void loadArticles()
  },
  { deep: true },
)

onMounted(() => {
  void loadArticles()
  searchInputRef.value?.focus()
})

async function loadArticles() {
  loading.value = true
  error.value = null

  try {
    const result = await searchKbArticles({
      query: debouncedQuery.value,
      facetFilters: facetFilters.value,
    })
    hits.value = result.hits
    nbHits.value = result.nbHits
    facets.value = result.facets
    if (page.value >= pagination.value.nbPages) {
      page.value = Math.max(0, pagination.value.nbPages - 1)
    }
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Could not load articles.'
    hits.value = []
    page.value = 0
    nbHits.value = 0
    facets.value = {}
  } finally {
    loading.value = false
  }
}

function toggleFacet(attribute: KbArticleFacetKey, value: string) {
  const current = facetFilters.value[attribute] ?? []
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]

  facetFilters.value = {
    ...facetFilters.value,
    [attribute]: next,
  }
}

function clearFacetFilters() {
  facetFilters.value = {}
}

function selectedFacetValues(attribute: KbArticleFacetKey): string[] {
  return facetFilters.value[attribute] ?? []
}

function textHighlight(value: string | null | undefined): string {
  return highlightQueryInText(value?.trim() || '—', debouncedQuery.value)
}

function titleHighlight(article: KbArticleHit): string {
  return highlightQueryInText(article.title?.trim() || '—', debouncedQuery.value)
}

function summaryHighlight(article: KbArticleHit): string {
  return highlightQueryInText(kbArticleSnippetText(article), debouncedQuery.value)
}

function handleSort(column: string, options = {}) {
  onSort(column, options)
  page.value = 0
}

function openCreateDialog() {
  editingArticleId.value = null
  showArticleDialog.value = true
}

function openEditDialog(article: KbArticleHit) {
  editingArticleId.value = kbArticleRecordId(article)
  showArticleDialog.value = true
}

function onArticleSaved() {
  const shouldFocusSearch = editingArticleId.value === null
  void loadArticles()
  if (shouldFocusSearch) {
    void focusSearchInput()
  }
}

function deleteDialogMessage(articleId: string | null): string {
  const article = hits.value.find((item) => kbArticleRecordId(item) === articleId)
  const title = article?.title?.trim() || 'this article'
  return `Delete “${title}”? This cannot be undone.`
}

function startDeleteArticle(article: KbArticleHit) {
  deletingArticleId.value = kbArticleRecordId(article)
  showDeleteDialog.value = true
}

function cancelDeleteArticle() {
  showDeleteDialog.value = false
  deletingArticleId.value = null
}

async function confirmDeleteArticle() {
  if (!deletingArticleId.value) return

  deleting.value = true
  try {
    await deleteKbArticle(deletingArticleId.value)
    if (editingArticleId.value === deletingArticleId.value) {
      showArticleDialog.value = false
      editingArticleId.value = null
    }
    toast.showSuccess('Article deleted.')
    showDeleteDialog.value = false
    deletingArticleId.value = null
    await loadArticles()
  } catch (deleteError) {
    toast.showError(deleteError instanceof Error ? deleteError.message : 'Could not delete article.')
  } finally {
    deleting.value = false
  }
}

function isEditingArticle(article: KbArticleHit): boolean {
  return showArticleDialog.value && editingArticleId.value === kbArticleRecordId(article)
}
</script>

<template>
  <section class="w-full">
    <div class="grid items-end gap-4 lg:grid-cols-[1fr_minmax(20rem,40rem)_1fr]">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold text-epms-900">Knowledge Base</h1>
        <p class="mt-1 text-sm text-stone-600">
          Browse and search internal knowledge base articles.
        </p>
      </div>

      <div class="flex w-full min-w-0 items-end gap-3 lg:justify-self-center">
        <label class="min-w-0 flex-1">
          <span class="sr-only">Search articles</span>
          <input
            ref="searchInputRef"
            v-model="query"
            type="search"
            placeholder="Search title, categories, body…"
            class="w-full rounded-xl px-3 py-2.5 text-sm font-normal text-stone-900 field-focus"
          />
        </label>

        <GridSearchStats :loading="loading" :nb-hits="nbHits" singular="article" plural="articles" />
      </div>

      <div class="flex justify-end">
        <button
          type="button"
          class="inline-flex shrink-0 items-center rounded-lg bg-epms-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-epms-800"
          @click="openCreateDialog"
        >
          New article
        </button>
      </div>
    </div>

    <div class="mt-6">
      <div class="flex items-center justify-between gap-3">
        <button
          type="button"
          class="text-sm font-medium text-epms-800 transition hover:text-epms-950"
          @click="showFilters = !showFilters"
        >
          {{ showFilters ? 'Hide filters' : 'Show filters' }}
        </button>

        <button
          v-if="hasActiveFilters"
          type="button"
          class="ml-auto text-sm font-medium text-stone-600 transition hover:text-stone-900"
          @click="clearFacetFilters"
        >
          Clear filters
        </button>
      </div>

      <p v-if="error" class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {{ error }}
      </p>

      <div class="mt-4 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside v-if="showFilters" class="space-y-6 rounded-xl border border-stone-200 bg-stone-100 p-4">
          <AlgoliaFacetFilter
            v-for="attribute in KB_ARTICLE_FACET_KEYS"
            :key="attribute"
            :label="facetLabels[attribute]"
            :facets="facets[attribute]"
            :selected="selectedFacetValues(attribute)"
            :format-value="(value) => formatKbArticleFacetLabel(attribute, value)"
            @toggle="toggleFacet(attribute, $event)"
          />
        </aside>

        <div class="min-w-0 overflow-x-auto rounded-xl border border-stone-200">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-stone-100 text-xs font-semibold uppercase tracking-wide text-stone-600">
              <tr>
                <GridSortHeader
                  column="title"
                  label="Title"
                  :sort-state="sortState"
                  cell-class="min-w-[14rem] px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="categories"
                  label="Categories"
                  :sort-state="sortState"
                  cell-class="min-w-[10rem] px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="summary"
                  label="Summary"
                  :sort-state="sortState"
                  cell-class="min-w-[16rem] px-4 py-3"
                  @sort="handleSort"
                />
                <GridSortHeader
                  column="publishedAt"
                  label="Published"
                  :sort-state="sortState"
                  cell-class="whitespace-nowrap px-4 py-3"
                  @sort="handleSort"
                />
                <th class="w-20 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="5" class="px-4 py-8 text-center text-stone-500">Loading articles…</td>
              </tr>
              <tr v-else-if="visibleHits.length === 0">
                <td colspan="5" class="px-4 py-8 text-center text-stone-500">No articles found.</td>
              </tr>
              <KbArticleHoverPreview
                v-for="article in visibleHits"
                v-else
                :key="article.objectID"
                :article="article"
                class="border-t border-stone-100 transition odd:bg-white even:bg-stone-50 hover:bg-epms-50/40"
              >
                <td class="min-w-[14rem] px-4 py-3 text-stone-700">
                  <SearchHighlight :html="titleHighlight(article)" />
                </td>
                <td class="px-4 py-3">
                  <div v-if="article.categories?.length" class="flex flex-wrap gap-1.5">
                    <span
                      v-for="category in article.categories"
                      :key="category"
                      class="inline-flex items-center rounded-full bg-epms-100 px-2.5 py-0.5 text-xs font-semibold text-epms-800"
                    >
                      <SearchHighlight :html="textHighlight(category)" />
                    </span>
                  </div>
                  <span v-else class="text-stone-700">—</span>
                </td>
                <td class="max-w-xs truncate px-4 py-3 text-stone-700">
                  <SearchHighlight :html="summaryHighlight(article)" />
                </td>
                <td class="whitespace-nowrap px-4 py-3 text-stone-700">
                  {{ article.publishedAt || '—' }}
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1">
                    <button
                      type="button"
                      :class="iconActionEditClassCompact"
                      aria-label="Edit article"
                      :disabled="deleting || (showArticleDialog && !isEditingArticle(article))"
                      @click="openEditDialog(article)"
                    >
                      <FontAwesomeIcon icon="pencil" class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      :class="iconActionDeleteClassCompact"
                      aria-label="Delete article"
                      :disabled="deleting || showArticleDialog"
                      @click="startDeleteArticle(article)"
                    >
                      <FontAwesomeIcon icon="trash" class="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </KbArticleHoverPreview>
            </tbody>
          </table>
          <GridPagination
            :page="pagination.page"
            :nb-pages="pagination.nbPages"
            :range-start="pagination.rangeStart"
            :range-end="pagination.rangeEnd"
            :nb-hits="nbHits"
            @update:page="page = $event"
          />
        </div>
      </div>
    </div>

    <KbArticleDialog
      v-model="showArticleDialog"
      :article-id="editingArticleId"
      @saved="onArticleSaved"
    />

    <ConfirmDialog
      v-model="showDeleteDialog"
      title="Delete article?"
      :message="deleteDialogMessage(deletingArticleId)"
      confirm-label="Delete"
      destructive
      :loading="deleting"
      @confirm="confirmDeleteArticle"
      @cancel="cancelDeleteArticle"
    />
  </section>
</template>
