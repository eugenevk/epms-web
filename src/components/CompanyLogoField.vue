<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  getImageFileFromClipboard,
  removeCompanyLogo,
  uploadCompanyLogo,
  validateCompanyLogoFile,
} from '@/lib/companyLogo'

const logoUrl = defineModel<string | null>('logoUrl', { default: null })
const logoPath = defineModel<string | null>('logoPath', { default: null })

const props = defineProps<{
  companyId?: string | null
  companyName?: string
  readonly?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  pendingLogo: [file: File | null]
  error: [message: string]
  uploaded: []
  removed: []
}>()

const uploading = ref(false)
const removing = ref(false)
const pendingPreviewUrl = ref<string | null>(null)
const pasteTargetRef = ref<HTMLElement | null>(null)
const isPasteTarget = ref(false)

const previewUrl = computed(() => logoUrl.value ?? pendingPreviewUrl.value)
const canEdit = computed(() => !props.readonly && !props.disabled)
const helperText = computed(() =>
  props.companyId
    ? 'Upload an image or paste one from your clipboard (Ctrl+V / Cmd+V).'
    : 'Upload or paste a logo now. It will be saved when you create the company.',
)

function setPendingPreview(file: File | null) {
  if (pendingPreviewUrl.value) {
    URL.revokeObjectURL(pendingPreviewUrl.value)
    pendingPreviewUrl.value = null
  }

  if (!file) {
    emit('pendingLogo', null)
    return
  }

  pendingPreviewUrl.value = URL.createObjectURL(file)
  emit('pendingLogo', file)
}

function clearPasteTargetFocus() {
  isPasteTarget.value = false
  pasteTargetRef.value?.blur()
}

async function applyLogoFile(file: File) {
  try {
    validateCompanyLogoFile(file)
  } catch (error) {
    emit('error', error instanceof Error ? error.message : 'Invalid image.')
    return
  }

  setPendingPreview(file)

  if (!props.companyId) {
    clearPasteTargetFocus()
    return
  }

  uploading.value = true
  try {
    const logo = await uploadCompanyLogo(props.companyId, file, logoPath.value)
    logoUrl.value = logo.logoUrl
    logoPath.value = logo.logoPath
    setPendingPreview(null)
    emit('uploaded')
  } catch (error) {
    emit('error', error instanceof Error ? error.message : 'Could not upload logo.')
  } finally {
    uploading.value = false
    clearPasteTargetFocus()
  }
}

async function handleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  await applyLogoFile(file)
}

async function handlePaste(event: ClipboardEvent) {
  if (!canEdit.value || uploading.value || removing.value) return

  const file = getImageFileFromClipboard(event)
  if (!file) return

  event.preventDefault()
  await applyLogoFile(file)
}

function activatePasteTarget() {
  if (!canEdit.value || uploading.value || removing.value) return
  pasteTargetRef.value?.focus()
}

function handlePasteTargetFocus() {
  isPasteTarget.value = true
}

function handlePasteTargetBlur() {
  isPasteTarget.value = false
}

async function handleRemove() {
  if (!canEdit.value || uploading.value || removing.value) return

  if (!props.companyId) {
    setPendingPreview(null)
    logoUrl.value = null
    logoPath.value = null
    emit('removed')
    return
  }

  removing.value = true
  try {
    await removeCompanyLogo(props.companyId, logoPath.value)
    logoUrl.value = null
    logoPath.value = null
    setPendingPreview(null)
    emit('removed')
  } catch (error) {
    emit('error', error instanceof Error ? error.message : 'Could not remove logo.')
  } finally {
    removing.value = false
  }
}

watch(
  () => logoUrl.value,
  (nextUrl) => {
    if (nextUrl) return
    setPendingPreview(null)
  },
)

onBeforeUnmount(() => {
  if (pendingPreviewUrl.value) {
    URL.revokeObjectURL(pendingPreviewUrl.value)
  }
})
</script>

<template>
  <div class="flex flex-wrap items-start gap-4">
    <div
      ref="pasteTargetRef"
      class="flex h-36 w-36 items-center justify-center overflow-hidden rounded-2xl border-[0.5px] border-stone-300 bg-stone-50 outline-none transition"
      :class="[
        canEdit && 'cursor-pointer hover:border-epms-400 hover:bg-epms-50/60',
        isPasteTarget && 'border-epms-600 bg-epms-50 ring-2 ring-epms-600/35',
        (uploading || removing) && 'pointer-events-none opacity-60',
      ]"
      :tabindex="canEdit ? 0 : undefined"
      :role="canEdit ? 'button' : undefined"
      :aria-label="canEdit ? 'Company logo. Click to paste an image from clipboard.' : undefined"
      :title="canEdit && !previewUrl ? 'Click, then paste (Ctrl+V / Cmd+V)' : undefined"
      @click="activatePasteTarget"
      @focus="handlePasteTargetFocus"
      @blur="handlePasteTargetBlur"
      @paste="handlePaste"
    >
      <div v-if="previewUrl" class="relative h-full w-full">
        <img
          :src="previewUrl"
          :alt="companyName ? `${companyName} logo` : 'Company logo'"
          class="h-full w-full object-contain"
          :class="{ 'opacity-90': isPasteTarget }"
        />
        <div
          v-if="isPasteTarget"
          class="absolute inset-0 flex flex-col items-center justify-center bg-epms-900/10 px-2 text-center text-xs font-semibold text-epms-900"
        >
          Paste to replace
          <span class="mt-1 font-normal text-epms-800/80">Ctrl+V / Cmd+V</span>
        </div>
      </div>
      <div
        v-else-if="isPasteTarget"
        class="px-3 text-center text-xs font-semibold text-epms-800"
      >
        Paste image
        <span class="mt-1 block font-normal text-epms-700/80">Ctrl+V / Cmd+V</span>
      </div>
      <div v-else class="px-3 text-center text-xs font-medium text-stone-400">
        No logo
      </div>
    </div>

    <div class="min-w-[14rem] flex-1">
      <p class="text-sm font-semibold text-stone-700">Company logo</p>
      <p class="mt-1 text-xs text-stone-500">{{ helperText }}</p>
      <p class="mt-1 text-xs text-stone-500">JPEG, PNG, WebP, or GIF, max. 2 MB.</p>

      <div v-if="canEdit" class="mt-3 flex flex-wrap gap-2">
        <label
          class="cursor-pointer rounded-lg border border-epms-300 px-3 py-2 text-sm font-semibold text-epms-800 transition hover:bg-epms-50"
          :class="{ 'pointer-events-none opacity-50': uploading || removing }"
        >
          {{ uploading ? 'Uploading…' : 'Choose image' }}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            class="sr-only"
            :disabled="uploading || removing"
            @change="handleFileSelected"
          />
        </label>

        <button
          v-if="previewUrl"
          type="button"
          class="rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
          :disabled="uploading || removing"
          @click="handleRemove"
        >
          {{ removing ? 'Removing…' : 'Remove' }}
        </button>
      </div>
    </div>
  </div>
</template>
