<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import KbArticleForm from '@/components/KbArticleForm.vue'
import { useDialogFormDirty } from '@/composables/useDialogFormDirty'
import { useDialogKeyboardShortcuts } from '@/composables/useDialogKeyboardShortcuts'
import { useDialogInitialFocus } from '@/composables/useDialogInitialFocus'
import { useToast } from '@/composables/useToast'
import { requestCloseWithConfirm } from '@/lib/confirmDiscard'
import { loadKbCategorySuggestions } from '@/lib/kbArticleCategories'
import {
  createKbArticle,
  emptyKbArticleInput,
  kbArticleInputFromArticle,
  loadKbArticle,
  updateKbArticle,
  validateKbArticleInput,
  type KbArticle,
  type KbArticleInput,
} from '@/lib/kbArticleRecords'
import { cloneSnapshotValue, normalizeRichTextValue } from '@/lib/formSnapshot'

const open = defineModel<boolean>({ required: true })

const props = defineProps<{
  articleId?: string | null
}>()

const emit = defineEmits<{
  saved: [article: KbArticle]
}>()

const toast = useToast()

const formId = 'kb-article-dialog-form'
const form = ref<KbArticleInput>(emptyKbArticleInput())
const loading = ref(false)
const saving = ref(false)
const categorySuggestions = ref<string[]>([])
const formContainerRef = ref<HTMLElement | null>(null)
let categorySuggestionsRequest = 0

async function loadCategorySuggestions() {
  const requestId = ++categorySuggestionsRequest
  try {
    const suggestions = await loadKbCategorySuggestions()
    if (requestId === categorySuggestionsRequest) {
      categorySuggestions.value = suggestions
    }
  } catch {
    if (requestId === categorySuggestionsRequest) {
      categorySuggestions.value = []
    }
  }
}

const isCreateMode = computed(() => !props.articleId)

const dialogTitle = computed(() => (isCreateMode.value ? 'New article' : 'Edit article'))

function captureFormState(): KbArticleInput {
  return {
    title: form.value.title.trim(),
    categories: [...(form.value.categories ?? [])],
    publishedAt: form.value.publishedAt,
    body: normalizeRichTextValue(form.value.body),
  }
}

const { commitSnapshot, isDirty } = useDialogFormDirty(open, captureFormState)

watch(
  () => [open.value, props.articleId] as const,
  async ([isOpen, articleId]) => {
    if (!isOpen) return

    void loadCategorySuggestions()

    if (articleId) {
      loading.value = true
      try {
        const article = await loadKbArticle(articleId)
        resetForm(kbArticleInputFromArticle(article))
      } catch (error) {
        toast.showError(error instanceof Error ? error.message : 'Could not load article.')
        open.value = false
      } finally {
        loading.value = false
      }
      return
    }

    resetForm(emptyKbArticleInput())
  },
)

function resetForm(nextForm: KbArticleInput) {
  form.value = cloneSnapshotValue(nextForm)
  void commitSnapshot()
}

function requestDismiss() {
  if (saving.value) return
  void requestCloseWithConfirm(() => {
    open.value = false
  }, isDirty.value)
}

useDialogKeyboardShortcuts(open, {
  onDismiss: requestDismiss,
  onSave: saveArticle,
  disabled: () => saving.value || loading.value,
})

useDialogInitialFocus(open, formContainerRef, {
  disabled: () => saving.value || loading.value,
})

async function saveArticle() {
  try {
    validateKbArticleInput(form.value)
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Please check the required fields.')
    return
  }

  saving.value = true

  try {
    const saved = isCreateMode.value
      ? await createKbArticle(form.value)
      : await updateKbArticle(props.articleId!, form.value)

    toast.showSuccess(isCreateMode.value ? 'Article created.' : 'Article saved.')
    emit('saved', saved)
    open.value = false
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Save failed.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="form-dialog-overlay"
      @click.self="requestDismiss"
    >
      <div
        class="form-dialog-panel form-dialog-panel-wide"
        role="dialog"
        aria-modal="true"
        :aria-label="dialogTitle"
      >
        <div class="form-dialog-header">
          <div>
            <h2 class="text-lg font-semibold text-stone-900">{{ dialogTitle }}</h2>
            <p class="mt-1 text-sm text-stone-600">
              {{
                isCreateMode
                  ? 'Add a new knowledge base article.'
                  : 'Update the article details and content.'
              }}
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1.5 text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            aria-label="Close"
            :disabled="saving"
            @click="requestDismiss"
          >
            <FontAwesomeIcon icon="xmark" class="h-5 w-5" />
          </button>
        </div>

        <div class="form-dialog-body">
          <div v-if="loading" class="py-8 text-sm text-stone-500">Loading article…</div>
          <div v-else ref="formContainerRef" class="form-dialog-body-inner">
            <KbArticleForm
              v-model="form"
              :form-id="formId"
              :category-suggestions="categorySuggestions"
              :readonly="saving"
              @submit="saveArticle"
              @escape="requestDismiss"
            />
          </div>
        </div>

        <div class="form-dialog-footer">
          <button
            type="button"
            class="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
            :disabled="saving || loading"
            @click="requestDismiss"
          >
            Cancel
          </button>
          <button
            type="submit"
            :form="formId"
            class="rounded-lg bg-epms-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-epms-800 disabled:opacity-50"
            :disabled="saving || loading"
          >
            {{ saving ? 'Saving…' : isCreateMode ? 'Create article' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
