<template>
  <section>
    <div v-if="!items.length" class="mt-6 text-slate-400 text-sm">
      No rhythms yet. Click "Generate" above (only shadow-contour–isomorphic rhythms if enabled).
    </div>

    <DataTable
      v-else
      ref="dataTableRef"
      :columns="columns"
      :rows="items"
      :selectedKey="selectedId"
      :rowHeight="32"
      :mobileRowHeight="160"
      mobileLayout="table"
      @row-click="(row: any) => select(row.id)"
    >
      <template #toolbar-end>
        <input
          ref="fileInput"
          type="file"
          accept=".csv,text/csv"
          class="hidden"
          @change="importCsv"
        />
        <button
          class="dt-action-btn"
          @click="() => fileInput?.click()"
          title="Import CSV"
          aria-label="Import CSV"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
            <path d="M12 4l-6 6h4v6h4v-6h4l-6-6zM4 18h16v2H4v-2z" />
          </svg>
        </button>
        <button
          class="dt-action-btn"
          @click="exportCsv"
          title="Export to CSV"
          aria-label="Export to CSV"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
            <path d="M12 16l-6-6h4V4h4v6h4l-6 6zm-8 2h16v2H4v-2z" />
          </svg>
        </button>
      </template>

      <template #cell-base="{ value }">
        <span class="inline-block px-1.5 py-0.5 text-[10px] uppercase rounded border border-white/10 text-slate-400">{{ value }}</span>
      </template>
      <template #cell-groupedDigitsString="{ value }">
        <span class="font-mono text-brand-300">{{ value }}</span>
      </template>
      <template #cell-copy="{ row }">
        <button class="dt-copy-btn" @click.stop="copyPattern(row.groupedDigitsString)">
          ⧉ Copy
        </button>
      </template>
      <template #cell-canonicalContour="{ value }">
        <span class="font-mono text-xs text-slate-400">{{ value }}</span>
      </template>
      <template #cell-compare="{ row }">
        <button
          class="dt-compare-btn"
          :class="{ 'dt-compare-btn--active': comparisonStore.secondaryId === row.id }"
          @click.stop="markForComparison(row.id)"
        >
          {{ comparisonStore.secondaryId === row.id ? 'Target' : 'Compare' }}
        </button>
      </template>
      <template #cell-details="{ row }">
        <button class="dt-details-btn" title="View details" aria-label="View details" @click.stop="openDetails(row.id)">
          🔍
        </button>
      </template>
    </DataTable>

    <Modal :open="detailsOpen" @close="detailsOpen = false">
      <template #title><h3 class="text-lg font-semibold">Rhythm details</h3></template>
      <RhythmRelations />
    </Modal>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRhythmStore } from '@/stores/rhythmStore'
import { useComparisonStore } from '@/stores/comparisonStore'
import { useUiStore } from '@/stores/uiStore'
import DataTable from './DataTable.vue'
import type { ColumnDef } from './DataTable.vue'
import Modal from './Modal.vue'
import RhythmRelations from './RhythmRelations.vue'
import { storeToRefs } from 'pinia'
import type { Mode } from '@/utils/rhythm'

const store = useRhythmStore()
const { items, selectedId } = storeToRefs(store)
const comparisonStore = useComparisonStore()
const uiStore = useUiStore()
const fileInput = ref<HTMLInputElement | null>(null)
const dataTableRef = ref<InstanceType<typeof DataTable> | null>(null)
const detailsOpen = ref(false)

function modeShort(b: Mode): string {
  return b === 'binary' ? 'bin' : b === 'octal' ? 'oct' : 'hex'
}

const columns: ColumnDef[] = [
  {
    key: 'details',
    label: '',
    width: '44px',
    sortable: false,
    filterable: false,
    getValue: () => '',
  },
  {
    key: 'groupedDigitsString',
    label: 'Pattern',
    sortable: true,
    filterable: true,
  },
  {
    key: 'copy',
    label: 'Copy',
    width: '88px',
    sortable: false,
    filterable: false,
    getValue: () => '',
  },
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
    key: 'canonicalContour',
    label: 'Contour',
    width: '120px',
    sortable: true,
    filterable: true,
  },
  {
    key: 'compare',
    label: 'Compare',
    width: '90px',
    sortable: false,
    filterable: false,
    getValue: () => '',
  },
]

function select(id: string) {
  store.select(id)
}

function openDetails(id: string) {
  store.select(id)
  detailsOpen.value = true
}

function markForComparison(id: string) {
  comparisonStore.setSecondary(id)
  uiStore.pushToast('Comparison target updated.', 'success')
}

async function copyPattern(value: string) {
  const text = String(value ?? '').trim()
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    uiStore.pushToast('Pattern copied to clipboard.', 'success')
  } catch {
    uiStore.pushToast('Clipboard unavailable.', 'error')
  }
}

function exportCsv() {
  const header = ['mode', 'numerator', 'denominator', 'onsets', 'groupedDigitsString', 'canonicalContour']
  const source = dataTableRef.value?.processedRows ?? items.value
  const rows = source.map((r: any) => [
    modeShort(r.base),
    r.numerator ?? '',
    r.denominator ?? '',
    r.onsets,
    `"${(r.groupedDigitsString ?? '').replace(/"/g, '""')}"`,
    `"${(r.canonicalContour ?? '').replace(/"/g, '""')}"`
  ])
  const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'rhythms.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function importCsv(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = reader.result as string
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) return
    const modeMap: Record<string, Mode> = { bin: 'binary', oct: 'octal', hex: 'hex', binary: 'binary', octal: 'octal' }
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i])
      if (cols.length < 6) continue
      const [modeStr, numStr, denStr, onsetsStr, groupedDigitsString, canonicalContour] = cols
      const base = modeMap[modeStr.toLowerCase()] ?? 'hex'
      const numerator = parseInt(numStr, 10) || undefined
      const denominator = parseInt(denStr, 10) || undefined
      const onsets = parseInt(onsetsStr, 10) || 0
      const id = crypto.randomUUID()
      store.items.push({
        id,
        base,
        groupedDigitsString,
        onsets,
        canonicalContour,
        numerator,
        denominator
      })
    }
    input.value = ''
  }
  reader.readAsText(file)
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}
</script>

<style scoped>
.dt-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
  border-radius: 0.375rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
}
.dt-action-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #e2e8f0;
}

.dt-compare-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #cbd5e1;
  font-size: 0.75rem;
  transition: all 0.15s;
}

.dt-compare-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.dt-compare-btn--active {
  border-color: rgba(56, 189, 248, 0.55);
  color: #7dd3fc;
}

.dt-copy-btn {
  width: 100%;
  border: 1px solid rgba(125, 211, 252, 0.4);
  border-radius: 0.375rem;
  background: rgba(14, 116, 144, 0.2);
  color: #67e8f9;
  font-size: 0.7rem;
  padding: 0.2rem 0.35rem;
}

.dt-copy-btn:hover {
  background: rgba(14, 116, 144, 0.34);
}

.dt-details-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0.25rem;
  border-radius: 0.375rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #cbd5e1;
  font-size: 0.85rem;
  transition: all 0.15s;
}

.dt-details-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}
</style>
