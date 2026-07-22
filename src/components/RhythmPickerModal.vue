<template>
  <teleport to="body">
    <Modal :open="open" @close="emit('close')">
      <template #title>
        <h3 class="text-lg font-semibold">Select a rhythm</h3>
      </template>
      <DataTable
        :columns="columns"
        :rows="items"
        :selectedKey="''"
        :rowHeight="32"
        :mobileRowHeight="140"
        mobileLayout="table"
        @row-click="(row: any) => pickById(row.id)"
      >
        <template #cell-base="{ value }">
          <span class="inline-block px-1.5 py-0.5 text-[10px] uppercase rounded border border-white/10 text-slate-400">{{ value }}</span>
        </template>
        <template #cell-groupedDigitsString="{ value }">
          <span class="font-mono text-brand-300">{{ value }}</span>
        </template>
        <template #cell-canonicalContour="{ value }">
          <span class="font-mono text-xs text-slate-400">{{ value }}</span>
        </template>
      </DataTable>
    </Modal>
  </teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Modal from './Modal.vue'
import DataTable from './DataTable.vue'
import type { ColumnDef } from './DataTable.vue'
import { useRhythmStore } from '@/stores/rhythmStore'
import { digitsToBits, type Mode, type RhythmItem } from '@/utils/rhythm'
import { parseDigitsFromGroupedString } from '@/utils/relations'
import { evaluatePredicateTree } from '@/utils/predicateEval'
import { ALL_PREDICATE_IDS, PREDICATE_LABELS, type PredicateId } from '@/types/predicateExpression'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'pick', id: string): void }>()

const store = useRhythmStore()
const items = computed(() => store.items)

function modeShort(b: Mode): string {
  return b === 'binary' ? 'bin' : b === 'octal' ? 'oct' : 'hex'
}

const predicateResultCache = new WeakMap<RhythmItem, Record<PredicateId, boolean>>()

function predicateResults(item: RhythmItem): Record<PredicateId, boolean> {
  const cached = predicateResultCache.get(item)
  if (cached) return cached

  const digits = item.digits ?? parseDigitsFromGroupedString(item.groupedDigitsString, item.base)
  const bits = digitsToBits(digits, item.base)
  const onsets: number[] = []
  for (let index = 0; index < bits.length; index++) if (bits[index]) onsets.push(index)

  const results = Object.fromEntries(
    ALL_PREDICATE_IDS.map(id => [id, evaluatePredicateTree({ type: 'predicate', id }, onsets, bits.length)])
  ) as Record<PredicateId, boolean>
  predicateResultCache.set(item, results)
  return results
}

function predicateColumn(id: PredicateId): ColumnDef {
  return {
    key: `predicate-${id}`,
    label: PREDICATE_LABELS[id],
    group: 'Theory predicates',
    width: '118px',
    filterType: 'boolean',
    getValue: (item: RhythmItem) => predicateResults(item)[id],
    format: value => value ? 'Pass' : 'Fail',
  }
}

const columns: ColumnDef[] = [
  {
    key: 'base',
    label: 'Mode',
    width: '70px',
    getValue: (r: any) => modeShort(r.base ?? 'hex'),
    sortable: true,
    filterable: true,
  },
  {
    key: 'numerator',
    label: 'Beats',
    width: '65px',
    numeric: true,
    getValue: (r: any) => r.numerator ?? 0,
  },
  {
    key: 'denominator',
    label: 'Digits/Beat',
    width: '85px',
    numeric: true,
    getValue: (r: any) => r.denominator ?? 0,
  },
  {
    key: 'onsets',
    label: 'Onsets',
    width: '70px',
    numeric: true,
  },
  {
    key: 'groupedDigitsString',
    label: 'Pattern',
    sortable: true,
    filterable: true,
  },
  {
    key: 'canonicalContour',
    label: 'Contour',
    width: '120px',
    sortable: true,
    filterable: true,
  },
  ...ALL_PREDICATE_IDS.map(predicateColumn),
]

function pickById(id: string) { emit('pick', id); emit('close') }
</script>
