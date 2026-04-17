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
import type { Mode } from '@/utils/rhythm'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'pick', id: string): void }>()

const store = useRhythmStore()
const items = computed(() => store.items)

function modeShort(b: Mode): string {
  return b === 'binary' ? 'bin' : b === 'octal' ? 'oct' : 'hex'
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
]

function pickById(id: string) { emit('pick', id); emit('close') }
</script>
