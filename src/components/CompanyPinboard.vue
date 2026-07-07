<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useToast } from '@/composables/useToast'
import { getImageFileFromClipboard } from '@/lib/companyLogo'
import {
  clampPinboardRect,
  countPinboardItems,
  dataTransferHasImage,
  deletePinboardImage,
  getImageFileFromDataTransfer,
  loadCompanyPinboardDocument,
  nextPinboardPageName,
  nextPinboardZIndex,
  normalizePlacementRect,
  PINBOARD_MIN_ITEM_SIZE,
  saveCompanyPinboardDocument,
  uploadPinboardImage,
  type CompanyPinboardItem,
  type CompanyPinboardPage,
  type PinboardRect,
} from '@/lib/companyPinboard'

const PINBOARD_PAGE_QUERY_PARAM = 'pinboardPage'

const props = defineProps<{
  companyId: string
  editable?: boolean
}>()

const emit = defineEmits<{
  changed: [itemCount: number]
}>()

const route = useRoute()
const router = useRouter()
const toast = useToast()

const canvasRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const pages = ref<CompanyPinboardPage[]>([])
const activePageId = ref('')
const items = ref<CompanyPinboardItem[]>([])
const selectedId = ref<string | null>(null)
const renamingPageId = ref<string | null>(null)
const renameDraft = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)
const showDeletePageDialog = ref(false)
const deletingPage = ref(false)
const pageIdToDelete = ref<string | null>(null)
const isFocused = ref(false)
const fileDragDepth = ref(0)
const pendingFile = ref<File | null>(null)
const placementPreview = ref<PinboardRect | null>(null)

const moving = ref<{
  id: string
  offsetX: number
  offsetY: number
} | null>(null)

const placing = ref<{
  startX: number
  startY: number
} | null>(null)

const resizing = ref<{
  id: string
  startX: number
  startY: number
  origin: PinboardRect
} | null>(null)

const editable = computed(() => props.editable === true)

const activePage = computed(() => pages.value.find((page) => page.id === activePageId.value) ?? null)
const pagePendingDelete = computed(
  () => pages.value.find((page) => page.id === pageIdToDelete.value) ?? null,
)
const canDeletePage = computed(() => editable.value && pages.value.length > 1)

function resolveActivePageId(loadedPages: CompanyPinboardPage[]): string {
  const fromQuery = route.query[PINBOARD_PAGE_QUERY_PARAM]
  if (typeof fromQuery === 'string') {
    const match = loadedPages.find((page) => page.id === fromQuery)
    if (match) return match.id
  }

  return loadedPages[0]?.id ?? ''
}

function setRoutePage(pageId: string) {
  const query: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (value === null || value === undefined) continue
    query[key] = value as string | string[]
  }

  if (pageId) {
    query[PINBOARD_PAGE_QUERY_PARAM] = pageId
  } else {
    delete query[PINBOARD_PAGE_QUERY_PARAM]
  }

  void router.replace({ path: route.path, query })
}

function syncItemsFromActivePage() {
  items.value = [...(activePage.value?.items ?? [])]
}

function syncActivePageFromItems() {
  const page = activePage.value
  if (!page) return

  page.items = [...items.value]
  pages.value = [...pages.value]
}

function emitItemCount() {
  syncActivePageFromItems()
  emit('changed', countPinboardItems({ pages: pages.value }))
}

const canvasHeight = computed(() => {
  const minHeight = 28 * 16
  const maxBottom = items.value.reduce((max, item) => Math.max(max, item.y + item.height), 0)
  const previewBottom = placementPreview.value
    ? placementPreview.value.y + placementPreview.value.height
    : 0
  return Math.max(minHeight, maxBottom + 120, previewBottom + 80)
})

const isFileDragOver = computed(() => editable.value && fileDragDepth.value > 0)
const isPlacingImage = computed(() => Boolean(pendingFile.value))
const canvasCursor = computed(() => {
  if (!editable.value) return 'default'
  if (pendingFile.value) return 'crosshair'
  return 'default'
})

function canvasPoint(event: PointerEvent | DragEvent): { x: number; y: number } | null {
  const canvas = canvasRef.value
  if (!canvas) return null

  const rect = canvas.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function getCanvasSize() {
  const canvas = canvasRef.value
  return {
    width: canvas?.clientWidth ?? 960,
    height: canvasHeight.value,
  }
}

async function loadBoard() {
  loading.value = true
  clearPendingFile()
  selectedId.value = null
  renamingPageId.value = null

  try {
    const document = await loadCompanyPinboardDocument(props.companyId)
    pages.value = document.pages
    activePageId.value = resolveActivePageId(document.pages)
    syncItemsFromActivePage()
    setRoutePage(activePageId.value)
    emitItemCount()
  } catch (error) {
    pages.value = []
    activePageId.value = ''
    items.value = []
    toast.showError(error instanceof Error ? error.message : 'Could not load pinboard.')
  } finally {
    loading.value = false
  }
}

async function persistDocument() {
  syncActivePageFromItems()
  saving.value = true

  try {
    await saveCompanyPinboardDocument(props.companyId, { pages: pages.value })
    emitItemCount()
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Could not save pinboard.')
  } finally {
    saving.value = false
  }
}

async function persistItems() {
  await persistDocument()
}

async function switchPage(pageId: string) {
  if (pageId === activePageId.value) return

  syncActivePageFromItems()
  activePageId.value = pageId
  syncItemsFromActivePage()
  selectedId.value = null
  clearPendingFile()
  renamingPageId.value = null
  setRoutePage(pageId)

  if (editable.value) {
    await persistDocument()
  }
}

async function addPage() {
  syncActivePageFromItems()

  const page: CompanyPinboardPage = {
    id: crypto.randomUUID(),
    name: nextPinboardPageName(pages.value),
    items: [],
  }

  pages.value = [...pages.value, page]
  await switchPage(page.id)
}

function startRenamePage(page: CompanyPinboardPage) {
  if (!editable.value) return

  renamingPageId.value = page.id
  renameDraft.value = page.name
  void nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

function cancelRenamePage() {
  renamingPageId.value = null
  renameDraft.value = ''
}

async function commitRenamePage() {
  const pageId = renamingPageId.value
  if (!pageId) return

  const trimmed = renameDraft.value.trim()
  cancelRenamePage()

  if (!trimmed) return

  const page = pages.value.find((entry) => entry.id === pageId)
  if (!page || page.name === trimmed) return

  page.name = trimmed
  pages.value = [...pages.value]
  await persistDocument()
}

function requestDeletePage(pageId: string) {
  if (!canDeletePage.value) return

  pageIdToDelete.value = pageId
  showDeletePageDialog.value = true
}

function cancelDeletePage() {
  showDeletePageDialog.value = false
  pageIdToDelete.value = null
}

async function confirmDeletePage() {
  const pageId = pageIdToDelete.value
  if (!pageId || pages.value.length <= 1) {
    cancelDeletePage()
    return
  }

  syncActivePageFromItems()
  deletingPage.value = true

  try {
    const index = pages.value.findIndex((page) => page.id === pageId)
    if (index < 0) return

    const [removed] = pages.value.splice(index, 1)
    for (const item of removed.items) {
      await deletePinboardImage(item.imagePath)
    }

    pages.value = [...pages.value]

    if (activePageId.value === pageId) {
      const nextPage = pages.value[Math.min(index, pages.value.length - 1)]
      activePageId.value = nextPage.id
      syncItemsFromActivePage()
      setRoutePage(nextPage.id)
    }

    selectedId.value = null
    clearPendingFile()
    await persistDocument()
    cancelDeletePage()
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Could not delete page.')
  } finally {
    deletingPage.value = false
  }
}

function focusCanvas() {
  canvasRef.value?.focus()
  isFocused.value = true
}

function blurCanvas() {
  isFocused.value = false
}

function selectItem(id: string) {
  selectedId.value = id
}

function bringToFront(id: string) {
  const item = items.value.find((entry) => entry.id === id)
  if (!item) return

  item.zIndex = nextPinboardZIndex(items.value)
  items.value = [...items.value].sort((left, right) => left.zIndex - right.zIndex)
}

function clearPendingFile() {
  pendingFile.value = null
  placementPreview.value = null
  placing.value = null
}

function queueImageFile(file: File) {
  if (!editable.value) return

  pendingFile.value = file
  placementPreview.value = null
  focusCanvas()
}

async function addImageFile(file: File, rect: PinboardRect) {
  if (!editable.value || uploading.value) return

  uploading.value = true

  try {
    const itemId = crypto.randomUUID()
    const { imageUrl, imagePath } = await uploadPinboardImage(props.companyId, file, itemId)
    const { width: canvasWidth, height: boardHeight } = getCanvasSize()
    const clamped = clampPinboardRect(rect, canvasWidth, boardHeight)

    const item: CompanyPinboardItem = {
      id: itemId,
      imageUrl,
      imagePath,
      x: clamped.x,
      y: clamped.y,
      width: clamped.width,
      height: clamped.height,
      zIndex: nextPinboardZIndex(items.value),
    }

    items.value = [...items.value, item]
    selectedId.value = item.id
    await persistItems()
  } catch (error) {
    toast.showError(error instanceof Error ? error.message : 'Could not add image.')
  } finally {
    uploading.value = false
  }
}

async function onPaste(event: ClipboardEvent) {
  if (!editable.value) return

  const file = getImageFileFromClipboard(event)
  if (!file) return

  event.preventDefault()
  queueImageFile(file)
}

function onDragEnter(event: DragEvent) {
  if (!editable.value || !dataTransferHasImage(event.dataTransfer)) return

  event.preventDefault()
  fileDragDepth.value += 1
}

function onDragLeave(event: DragEvent) {
  if (fileDragDepth.value === 0) return

  event.preventDefault()
  fileDragDepth.value = Math.max(0, fileDragDepth.value - 1)
}

function onDragOver(event: DragEvent) {
  if (!editable.value || !dataTransferHasImage(event.dataTransfer)) return

  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function onDrop(event: DragEvent) {
  fileDragDepth.value = 0
  if (!editable.value) return

  const file = getImageFileFromDataTransfer(event.dataTransfer)
  if (!file) return

  event.preventDefault()
  queueImageFile(file)
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''

  if (!file) return
  queueImageFile(file)
}

function isCanvasBackgroundTarget(target: EventTarget | null): boolean {
  return target === canvasRef.value
}

function onCanvasPointerDown(event: PointerEvent) {
  if (!editable.value || event.button !== 0 || uploading.value) return
  if (!isCanvasBackgroundTarget(event.target)) return

  focusCanvas()

  if (pendingFile.value) {
    const point = canvasPoint(event)
    if (!point) return

    event.preventDefault()
    placing.value = { startX: point.x, startY: point.y }
    placementPreview.value = {
      x: point.x,
      y: point.y,
      width: PINBOARD_MIN_ITEM_SIZE,
      height: PINBOARD_MIN_ITEM_SIZE,
    }

    window.addEventListener('pointermove', onPlacementPointerMove)
    window.addEventListener('pointerup', onPlacementPointerUp)
    window.addEventListener('pointercancel', onPlacementPointerUp)
    return
  }

  selectedId.value = null
}

function onPlacementPointerMove(event: PointerEvent) {
  if (!placing.value) return

  const point = canvasPoint(event)
  if (!point) return

  const { width: canvasWidth, height: boardHeight } = getCanvasSize()
  const rect = normalizePlacementRect(
    placing.value.startX,
    placing.value.startY,
    point.x,
    point.y,
  )
  placementPreview.value = clampPinboardRect(rect, canvasWidth, boardHeight)
}

async function onPlacementPointerUp() {
  window.removeEventListener('pointermove', onPlacementPointerMove)
  window.removeEventListener('pointerup', onPlacementPointerUp)
  window.removeEventListener('pointercancel', onPlacementPointerUp)

  const file = pendingFile.value
  const preview = placementPreview.value

  placing.value = null
  placementPreview.value = null
  pendingFile.value = null

  if (!file || !preview) return

  await addImageFile(file, preview)
}

function onItemPointerDown(event: PointerEvent, item: CompanyPinboardItem) {
  if (!editable.value || event.button !== 0 || uploading.value || pendingFile.value) return

  const canvas = canvasRef.value
  if (!canvas) return

  event.preventDefault()
  event.stopPropagation()
  selectItem(item.id)
  bringToFront(item.id)

  const rect = canvas.getBoundingClientRect()
  moving.value = {
    id: item.id,
    offsetX: event.clientX - rect.left - item.x,
    offsetY: event.clientY - rect.top - item.y,
  }

  window.addEventListener('pointermove', onMovePointerMove)
  window.addEventListener('pointerup', onMovePointerUp)
  window.addEventListener('pointercancel', onMovePointerUp)
}

function onMovePointerMove(event: PointerEvent) {
  if (!moving.value || !canvasRef.value) return

  const item = items.value.find((entry) => entry.id === moving.value!.id)
  if (!item) return

  const { width: canvasWidth, height: boardHeight } = getCanvasSize()
  const rect = canvasRef.value.getBoundingClientRect()
  const next = clampPinboardRect(
    {
      x: event.clientX - rect.left - moving.value.offsetX,
      y: event.clientY - rect.top - moving.value.offsetY,
      width: item.width,
      height: item.height,
    },
    canvasWidth,
    boardHeight,
  )

  item.x = next.x
  item.y = next.y
}

async function onMovePointerUp() {
  window.removeEventListener('pointermove', onMovePointerMove)
  window.removeEventListener('pointerup', onMovePointerUp)
  window.removeEventListener('pointercancel', onMovePointerUp)

  if (!moving.value) return

  moving.value = null
  await persistItems()
}

function onResizePointerDown(event: PointerEvent, item: CompanyPinboardItem) {
  if (!editable.value || event.button !== 0 || uploading.value || pendingFile.value) return

  event.preventDefault()
  event.stopPropagation()
  selectItem(item.id)
  bringToFront(item.id)

  resizing.value = {
    id: item.id,
    startX: event.clientX,
    startY: event.clientY,
    origin: {
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
    },
  }

  window.addEventListener('pointermove', onResizePointerMove)
  window.addEventListener('pointerup', onResizePointerUp)
  window.addEventListener('pointercancel', onResizePointerUp)
}

function onResizePointerMove(event: PointerEvent) {
  if (!resizing.value || !canvasRef.value) return

  const item = items.value.find((entry) => entry.id === resizing.value!.id)
  if (!item) return

  const deltaX = event.clientX - resizing.value.startX
  const deltaY = event.clientY - resizing.value.startY
  const { width: canvasWidth, height: boardHeight } = getCanvasSize()

  const next = clampPinboardRect(
    {
      x: resizing.value.origin.x,
      y: resizing.value.origin.y,
      width: resizing.value.origin.width + deltaX,
      height: resizing.value.origin.height + deltaY,
    },
    canvasWidth,
    boardHeight,
  )

  item.x = next.x
  item.y = next.y
  item.width = next.width
  item.height = next.height
}

async function onResizePointerUp() {
  window.removeEventListener('pointermove', onResizePointerMove)
  window.removeEventListener('pointerup', onResizePointerUp)
  window.removeEventListener('pointercancel', onResizePointerUp)

  if (!resizing.value) return

  resizing.value = null
  await persistItems()
}

async function removeSelectedItem() {
  if (!editable.value || !selectedId.value) return

  const index = items.value.findIndex((item) => item.id === selectedId.value)
  if (index < 0) return

  const [removed] = items.value.splice(index, 1)
  selectedId.value = null

  try {
    await deletePinboardImage(removed.imagePath)
    await persistItems()
  } catch (error) {
    items.value.splice(index, 0, removed)
    toast.showError(error instanceof Error ? error.message : 'Could not remove image.')
  }
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    clearPendingFile()
    return
  }

  if (!editable.value || !selectedId.value) return
  if (event.key !== 'Delete' && event.key !== 'Backspace') return

  event.preventDefault()
  void removeSelectedItem()
}

function cleanupPointerListeners() {
  window.removeEventListener('pointermove', onPlacementPointerMove)
  window.removeEventListener('pointerup', onPlacementPointerUp)
  window.removeEventListener('pointercancel', onPlacementPointerUp)
  window.removeEventListener('pointermove', onMovePointerMove)
  window.removeEventListener('pointerup', onMovePointerUp)
  window.removeEventListener('pointercancel', onMovePointerUp)
  window.removeEventListener('pointermove', onResizePointerMove)
  window.removeEventListener('pointerup', onResizePointerUp)
  window.removeEventListener('pointercancel', onResizePointerUp)
  moving.value = null
  placing.value = null
  resizing.value = null
}

watch(
  () => props.editable,
  (isEditable) => {
    if (!isEditable) {
      clearPendingFile()
      cleanupPointerListeners()
      cancelRenamePage()
    }
  },
)

watch(
  () => props.companyId,
  () => {
    void loadBoard()
  },
)

watch(
  () => route.query[PINBOARD_PAGE_QUERY_PARAM],
  (value) => {
    if (loading.value || typeof value !== 'string' || value === activePageId.value) return

    const match = pages.value.find((page) => page.id === value)
    if (!match) return

    syncActivePageFromItems()
    activePageId.value = value
    syncItemsFromActivePage()
    selectedId.value = null
    clearPendingFile()
    renamingPageId.value = null
  },
)

onMounted(() => {
  void loadBoard()
})

onBeforeUnmount(() => {
  cleanupPointerListeners()
})
</script>

<template>
  <div>
    <p v-if="editable && isPlacingImage" class="mb-2 text-sm font-medium text-epms-800">
      Drag on the board to draw a frame. Release the mouse button to place the image.
    </p>

    <div class="flex flex-wrap items-end justify-between gap-3 border-b border-stone-200 pb-2">
      <div class="flex min-w-0 flex-wrap items-center gap-1">
        <div
          v-for="page in pages"
          :key="page.id"
          class="group inline-flex max-w-full items-center"
        >
          <button
            v-if="renamingPageId !== page.id"
            type="button"
            class="inline-flex max-w-full items-center gap-1 rounded-t-lg px-3 py-2 text-sm font-medium transition"
            :class="
              page.id === activePageId
                ? 'border-b-2 border-epms-700 text-epms-900'
                : 'text-stone-500 hover:text-stone-700'
            "
            @click="switchPage(page.id)"
          >
            <span class="truncate">{{ page.name }}</span>
          </button>
          <input
            v-else
            ref="renameInputRef"
            v-model="renameDraft"
            type="text"
            class="w-36 rounded-lg border border-epms-300 px-2 py-1.5 text-sm text-stone-900 field-focus"
            @keydown.enter.prevent="commitRenamePage"
            @keydown.escape.prevent="cancelRenamePage"
            @blur="commitRenamePage"
          />
          <div
            v-if="editable && page.id === activePageId && renamingPageId !== page.id"
            class="ml-0.5 flex items-center gap-0.5"
          >
            <button
              type="button"
              class="rounded p-1 text-stone-400 transition hover:bg-epms-50 hover:text-epms-800"
              aria-label="Rename page"
              @click.stop="startRenamePage(page)"
            >
              <FontAwesomeIcon icon="pencil" class="h-3.5 w-3.5" />
            </button>
            <button
              v-if="canDeletePage"
              type="button"
              class="rounded p-1 text-stone-400 transition hover:bg-red-50 hover:text-red-700"
              aria-label="Delete page"
              @click.stop="requestDeletePage(page.id)"
            >
              <FontAwesomeIcon icon="trash" class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="editable" class="flex shrink-0 flex-wrap items-center gap-2">
        <input
          ref="fileInputRef"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          class="sr-only"
          @change="onFileSelected"
        />
        <button
          type="button"
          class="rounded-lg border border-epms-300 px-3 py-2 text-sm font-semibold text-epms-800 transition hover:bg-epms-50 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="uploading || loading"
          @click="fileInputRef?.click()"
        >
          Add image
        </button>
        <button
          type="button"
          class="rounded-lg border border-epms-300 px-3 py-2 text-sm font-semibold text-epms-800 transition hover:bg-epms-50 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="uploading || loading || saving"
          @click="addPage"
        >
          Add page
        </button>
        <button
          v-if="pendingFile"
          type="button"
          class="rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
          @click="clearPendingFile"
        >
          Cancel placement
        </button>
        <button
          v-if="selectedId"
          type="button"
          class="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-800 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="uploading || loading"
          @click="removeSelectedItem"
        >
          Remove selected
        </button>
      </div>
    </div>

    <div
      ref="canvasRef"
      tabindex="0"
      role="application"
      aria-label="Company pinboard"
      class="pinboard-canvas mt-3 rounded-xl border border-stone-300 bg-stone-100 outline-none transition"
      :class="{
        'border-epms-500 ring-2 ring-epms-600/20': isFocused && editable,
        'pinboard-canvas-dragover border-epms-500 bg-epms-50/50': isFileDragOver,
        'pinboard-canvas-placing': isPlacingImage,
      }"
      :style="{ minHeight: `${canvasHeight}px`, cursor: canvasCursor }"
      @focus="isFocused = true"
      @blur="blurCanvas"
      @click="focusCanvas"
      @pointerdown="onCanvasPointerDown"
      @paste="onPaste"
      @keydown="onKeyDown"
      @dragenter="onDragEnter"
      @dragleave="onDragLeave"
      @dragover="onDragOver"
      @drop="onDrop"
    >
      <p v-if="loading" class="pinboard-empty">Loading pinboard…</p>
      <p v-else-if="uploading" class="pinboard-empty">Uploading image…</p>
      <p v-else-if="isFileDragOver" class="pinboard-empty pinboard-empty-active">Drop image here</p>
      <p v-else-if="editable && items.length === 0 && !isPlacingImage" class="pinboard-empty">
        Add an image, then drag on the board to place and size it.
      </p>

      <div
        v-if="placementPreview"
        class="pinboard-placement-preview"
        :style="{
          left: `${placementPreview.x}px`,
          top: `${placementPreview.y}px`,
          width: `${placementPreview.width}px`,
          height: `${placementPreview.height}px`,
        }"
      />

      <article
        v-for="item in items"
        :key="item.id"
        class="pinboard-item"
        :class="{
          'pinboard-item-selected': selectedId === item.id,
          'pinboard-item-readonly': !editable,
        }"
        :style="{
          left: `${item.x}px`,
          top: `${item.y}px`,
          width: `${item.width}px`,
          height: `${item.height}px`,
          zIndex: item.zIndex,
        }"
        @pointerdown="onItemPointerDown($event, item)"
      >
        <img
          :src="item.imageUrl"
          alt=""
          draggable="false"
          class="pinboard-item-image pointer-events-none h-full w-full"
        />
        <button
          v-if="editable && selectedId === item.id"
          type="button"
          class="pinboard-resize-handle"
          aria-label="Resize image"
          @pointerdown="onResizePointerDown($event, item)"
        />
      </article>
    </div>

    <p v-if="saving" class="mt-2 text-xs text-stone-500">Saving…</p>

    <ConfirmDialog
      v-model="showDeletePageDialog"
      title="Delete pinboard page"
      :message="`Delete “${pagePendingDelete?.name ?? 'this page'}” and all images on it? This cannot be undone.`"
      confirm-label="Delete page"
      destructive
      :loading="deletingPage"
      @confirm="confirmDeletePage"
      @cancel="cancelDeletePage"
    />
  </div>
</template>

<style scoped>
.pinboard-canvas {
  position: relative;
  overflow: auto;
  background-image: radial-gradient(circle, #d6d3d1 1px, transparent 1px);
  background-size: 20px 20px;
}

.pinboard-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: #78716c;
  pointer-events: none;
}

.pinboard-empty-active {
  font-weight: 600;
  color: #075985;
}

.pinboard-canvas-dragover {
  cursor: copy;
}

.pinboard-placement-preview {
  position: absolute;
  z-index: 9999;
  border: 2px dashed #0369a1;
  background: rgb(224 242 254 / 0.45);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.7);
  pointer-events: none;
}

.pinboard-item {
  position: absolute;
  touch-action: none;
  cursor: grab;
  user-select: none;
}

.pinboard-item-readonly {
  cursor: default;
}

.pinboard-item:active:not(.pinboard-item-readonly) {
  cursor: grabbing;
}

.pinboard-item-image {
  border-radius: 0.75rem;
  border: 1px solid #e7e5e4;
  background: #fff;
  object-fit: contain;
  box-shadow: 0 1px 2px rgb(12 74 110 / 0.05);
}

.pinboard-item-selected .pinboard-item-image {
  border-color: #0369a1;
  box-shadow: 0 0 0 2px rgb(3 105 161 / 0.25);
}

.pinboard-resize-handle {
  position: absolute;
  right: -0.4rem;
  bottom: -0.4rem;
  z-index: 2;
  height: 0.9rem;
  width: 0.9rem;
  border-radius: 0.2rem;
  border: 2px solid #fff;
  background: #0369a1;
  box-shadow: 0 1px 3px rgb(12 74 110 / 0.35);
  cursor: nwse-resize;
  touch-action: none;
}

.pinboard-resize-handle:hover {
  background: #075985;
}
</style>
