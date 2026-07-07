import { computed, nextTick, ref, watch, type MaybeRefOrGetter, toValue } from 'vue'
import { commitFormSnapshot, isDirtySnapshot } from '@/lib/formSnapshot'

export function useDialogFormDirty<T>(
  open: MaybeRefOrGetter<boolean>,
  getState: () => T | null,
) {
  const snapshot = ref<string | null>(null)

  async function commitSnapshot() {
    await nextTick()
    const current = getState()
    if (current === null) {
      snapshot.value = null
      return
    }
    snapshot.value = await commitFormSnapshot(() => current)
  }

  const isDirty = computed(() => {
    const current = getState()
    if (current === null || snapshot.value === null) return false
    return isDirtySnapshot(current, snapshot.value)
  })

  watch(
    () => toValue(open),
    (isOpen) => {
      if (!isOpen) snapshot.value = null
    },
  )

  return { commitSnapshot, isDirty }
}
