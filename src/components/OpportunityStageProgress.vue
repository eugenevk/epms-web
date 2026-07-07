<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { stageBadgeClass } from '@/lib/opportunities'
import { loadOpportunityStages, opportunityStageSummary, opportunityStageTooltip, type OpportunityStage } from '@/lib/stages'

const props = withDefaults(
  defineProps<{
    modelValue: OpportunityStage | null
    likelihood?: number
    readonly?: boolean
    loading?: boolean
    embedded?: boolean
  }>(),
  {
    embedded: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [stage: OpportunityStage]
}>()

const stages = ref<OpportunityStage[]>([])
const stagesLoading = ref(true)
const hoveredStage = ref<OpportunityStage | null>(null)
const tooltipStyle = ref<Record<string, string>>({})

const currentStageValue = computed(() => props.modelValue?.stageValue ?? -1)

const resolvedCurrentStage = computed(() => {
  if (!props.modelValue) return null
  return stages.value.find((stage) => stage.id === props.modelValue?.id) ?? props.modelValue
})

onMounted(async () => {
  try {
    stages.value = await loadOpportunityStages()
  } finally {
    stagesLoading.value = false
  }
})

function isStageReached(stage: OpportunityStage): boolean {
  if (currentStageValue.value < 0) return false
  return stage.stageValue <= currentStageValue.value
}

function isCurrentStage(stage: OpportunityStage): boolean {
  return props.modelValue?.id === stage.id
}

function selectStage(stage: OpportunityStage) {
  if (props.readonly || props.loading || stagesLoading.value) return
  emit('update:modelValue', stage)
}

function nodeButtonClass(stage: OpportunityStage): string {
  const size = isCurrentStage(stage) ? 'h-11 w-11 text-sm' : 'h-10 w-10 text-xs'
  const interactive = !props.readonly && !props.loading
  const base = `relative flex ${size} shrink-0 items-center justify-center rounded-full border-2 font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-epms-600/40 ${
    interactive ? 'cursor-pointer' : 'cursor-default'
  }`

  if (isCurrentStage(stage)) {
    if (stage.stageValue === 0) {
      return `${base} border-red-700 bg-red-500 text-white shadow-md`
    }
    return `${base} border-transparent ${stageBadgeClass(stage.stageValue)} shadow-md ring-2 ring-epms-700/20`
  }

  if (!isStageReached(stage)) {
    return `${base} border-stone-300 bg-white text-stone-400${
      interactive ? ' hover:border-stone-400 hover:text-stone-600' : ''
    }`
  }

  if (stage.stageValue === 0) {
    return `${base} border-red-600 bg-red-500 text-white shadow-sm`
  }

  return `${base} border-transparent ${stageBadgeClass(stage.stageValue)} shadow-sm`
}

function connectorClass(nextStage: OpportunityStage): string {
  return isStageReached(nextStage) ? 'bg-emerald-500' : 'bg-stone-200'
}

function updateTooltipPosition(target: HTMLElement) {
  const rect = target.getBoundingClientRect()
  tooltipStyle.value = {
    left: `${rect.left + rect.width / 2}px`,
    top: `${rect.top - 8}px`,
    transform: 'translate(-50%, -100%)',
  }
}

function showStageTooltip(stage: OpportunityStage, event: MouseEvent | FocusEvent) {
  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) return
  hoveredStage.value = stage
  updateTooltipPosition(target)
}

function hideStageTooltip() {
  hoveredStage.value = null
}
</script>

<template>
  <section :class="embedded ? '' : 'rounded-2xl border border-epms-200 bg-white p-4 shadow-sm sm:p-5'">
    <div
      class="flex flex-wrap items-center gap-3"
      :class="embedded ? 'justify-center text-center' : 'justify-between'"
    >
      <div>
        <h2 class="text-sm font-semibold uppercase tracking-wide text-epms-700">Stage</h2>
        <p v-if="resolvedCurrentStage" class="mt-1 text-sm text-stone-600">
          <span class="font-medium text-stone-800">
            {{ opportunityStageSummary(resolvedCurrentStage, likelihood) }}
          </span>
        </p>
        <p v-else class="mt-1 text-sm text-stone-500">No stage selected</p>
      </div>

      <p v-if="stagesLoading" class="text-sm text-stone-500">Loading stages…</p>
    </div>

    <div v-if="!stagesLoading" class="mt-2 flex justify-center overflow-x-auto py-1">
      <div class="inline-flex min-w-max items-center justify-center gap-0 px-1">
        <template v-for="(stage, index) in stages" :key="stage.id">
          <button
            type="button"
            :class="nodeButtonClass(stage)"
            :disabled="readonly || loading"
            :aria-label="`Set stage to ${stage.label}: ${opportunityStageTooltip(stage)}`"
            :aria-describedby="hoveredStage?.id === stage.id ? 'stage-tooltip' : undefined"
            :aria-current="isCurrentStage(stage) ? 'step' : undefined"
            @click="selectStage(stage)"
            @mouseenter="showStageTooltip(stage, $event)"
            @mouseleave="hideStageTooltip"
            @focus="showStageTooltip(stage, $event)"
            @blur="hideStageTooltip"
          >
            <FontAwesomeIcon v-if="isStageReached(stage) && !isCurrentStage(stage)" icon="check" class="h-4 w-4" />
            <span v-else>{{ stage.label }}</span>
          </button>

          <div
            v-if="index < stages.length - 1"
            class="h-0.5 w-10 shrink-0 rounded-full sm:w-14"
            :class="connectorClass(stages[index + 1]!)"
            aria-hidden="true"
          />
        </template>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="hoveredStage"
        id="stage-tooltip"
        class="pointer-events-none fixed z-[200] w-max max-w-[14rem] rounded-lg bg-stone-900 px-2.5 py-1.5 text-center text-xs font-medium leading-snug text-white shadow-lg"
        :style="tooltipStyle"
        role="tooltip"
      >
        {{ opportunityStageTooltip(hoveredStage) }}
      </div>
    </Teleport>
  </section>
</template>
