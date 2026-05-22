<script lang="ts">
export default { name: 'PredicateExplainTree' }
</script>

<script setup lang="ts">
import { computed } from 'vue'
import type { PredicateTrace } from '@/utils/predicateEval'

const props = withDefaults(defineProps<{
  trace: PredicateTrace
  depth?: number
}>(), {
  depth: 0,
})

const isGroup = computed(() => props.trace.kind === 'group')
const groupBadgeClass = computed(() => {
  if (props.trace.kind !== 'group') return ''
  return props.trace.operator === 'and'
    ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
})
</script>

<template>
  <div class="space-y-2" :style="depth > 0 ? { marginLeft: `${depth * 14}px` } : undefined">
    <div v-if="trace.kind === 'group'" class="rounded border border-white/10 bg-slate-950/40 px-3 py-2">
      <div class="flex items-center gap-2 text-xs">
        <span class="rounded border px-2 py-0.5 font-semibold uppercase tracking-wide" :class="groupBadgeClass">
          {{ trace.operator }}
        </span>
        <span :class="trace.result ? 'text-emerald-300' : 'text-rose-300'">
          {{ trace.result ? 'Pass' : 'Fail' }}
        </span>
        <span v-if="trace.shortCircuited" class="text-slate-500">Short-circuited</span>
      </div>
      <div v-if="trace.children.length === 0" class="mt-2 text-xs text-slate-500">
        Empty group, so this branch imposes no filter.
      </div>
    </div>

    <div v-else class="rounded border border-white/10 bg-slate-950/40 px-3 py-2">
      <div class="flex items-center justify-between gap-3 text-xs">
        <span class="font-medium text-slate-200">{{ trace.label }}</span>
        <span :class="trace.result ? 'text-emerald-300' : 'text-rose-300'">{{ trace.result ? 'Pass' : 'Fail' }}</span>
      </div>
      <div class="mt-1 text-xs text-slate-500">{{ trace.summary }}</div>
    </div>

    <template v-if="trace.kind === 'group'">
      <PredicateExplainTree
        v-for="(child, index) in trace.children"
        :key="`${depth}:${index}`"
        :trace="child"
        :depth="depth + 1"
      />
    </template>
  </div>
</template>