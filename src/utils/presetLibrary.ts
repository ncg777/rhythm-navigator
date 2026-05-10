import type { PredicateGroup } from '@/types/predicateExpression'
import { defaultPredicateExpression } from '@/types/predicateExpression'
import type { RhythmSessionSnapshot } from '@/stores/rhythmStore'
import type { SavedPatternEntry, SavedTrack, SequencerSessionSnapshot, TrackType } from '@/stores/sequencerStore'
import type { Mode, RhythmItem } from '@/utils/rhythm'

export const PRESET_LIBRARY_VERSION = 1 as const

export type SessionPreset = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  rhythm: Partial<RhythmSessionSnapshot>
  sequencer: Partial<SequencerSessionSnapshot>
}

export type SessionPresetLibrary = {
  version: typeof PRESET_LIBRARY_VERSION
  presets: SessionPreset[]
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function asFiniteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function isMode(value: unknown): value is Mode {
  return value === 'binary' || value === 'octal' || value === 'hex'
}

function isTrackType(value: unknown): value is TrackType {
  return value === 'kick' || value === 'snare' || value === 'clap' || value === 'hat' || value === 'perc'
}

function isPredicateGroup(value: unknown): value is PredicateGroup {
  return isObject(value) && (value.type === 'and' || value.type === 'or') && Array.isArray(value.children)
}

function normalizeParams(value: unknown): Record<string, number | string> {
  if (!isObject(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number | string] => {
      return typeof entry[1] === 'number' || typeof entry[1] === 'string'
    })
  )
}

function normalizeSavedPatternEntry(value: unknown): SavedPatternEntry | null {
  if (!isObject(value) || !Array.isArray(value.digits) || !isMode(value.mode)) return null
  return {
    mode: value.mode,
    groupedDigitsString: asString(value.groupedDigitsString),
    digits: value.digits.map((digit) => Math.max(0, Math.floor(asFiniteNumber(digit, 0)))),
    numerator: Math.max(1, Math.floor(asFiniteNumber(value.numerator, 4))),
    denominator: Math.max(1, Math.floor(asFiniteNumber(value.denominator, 1))),
    repeats: Math.max(1, Math.floor(asFiniteNumber(value.repeats, 1)))
  }
}

function normalizeLegacyPattern(value: unknown): SavedTrack['pattern'] {
  if (!isObject(value) || !Array.isArray(value.digits) || !isMode(value.mode)) return null
  return {
    mode: value.mode,
    groupedDigitsString: asString(value.groupedDigitsString),
    digits: value.digits.map((digit) => Math.max(0, Math.floor(asFiniteNumber(digit, 0)))),
    numerator: Math.max(1, Math.floor(asFiniteNumber(value.numerator, 4))),
    denominator: Math.max(1, Math.floor(asFiniteNumber(value.denominator, 1)))
  }
}

function normalizeSavedTrack(value: unknown, index: number): SavedTrack | null {
  if (!isObject(value)) return null
  const type = isTrackType(value.type) ? value.type : 'perc'
  const patterns = Array.isArray(value.patterns)
    ? value.patterns.map(normalizeSavedPatternEntry).filter((entry): entry is SavedPatternEntry => !!entry)
    : []
  return {
    id: asString(value.id, `preset-track-${index}`),
    name: asString(value.name, type),
    type,
    volume: asFiniteNumber(value.volume, 0.8),
    pan: asFiniteNumber(value.pan, 0),
    velocity: asFiniteNumber(value.velocity, 0.8),
    velRandom: asFiniteNumber(value.velRandom, 0),
    timeScale: asFiniteNumber(value.timeScale, 1),
    noteLength: asFiniteNumber(value.noteLength, 0.5),
    params: normalizeParams(value.params),
    patterns,
    pattern: normalizeLegacyPattern(value.pattern)
  }
}

function normalizeRhythmItems(value: unknown): RhythmItem[] {
  return Array.isArray(value) ? value as RhythmItem[] : []
}

function normalizeRhythmSnapshot(value: unknown): Partial<RhythmSessionSnapshot> {
  if (!isObject(value)) throw new Error('Preset rhythm snapshot is missing or invalid.')
  return {
    mode: isMode(value.mode) ? value.mode : 'hex',
    numerator: Math.max(1, Math.floor(asFiniteNumber(value.numerator, 4))),
    denominator: Math.max(1, Math.floor(asFiniteNumber(value.denominator, 1))),
    maxReps: Math.max(0, Math.floor(asFiniteNumber(value.maxReps, 0))),
    predicateExpression: isPredicateGroup(value.predicateExpression) ? value.predicateExpression : defaultPredicateExpression(),
    retentionProbability: Math.max(0, Math.min(100, asFiniteNumber(value.retentionProbability, 100))),
    generationMethod: value.generationMethod === 'sample' ? 'sample' : 'enumerate',
    maxSampleAttempts: Math.max(1000, Math.floor(asFiniteNumber(value.maxSampleAttempts, 1_000_000))),
    matrixRows: Math.max(1, Math.floor(asFiniteNumber(value.matrixRows, 3))),
    matrixColumns: Math.max(1, Math.floor(asFiniteNumber(value.matrixColumns, 4))),
    matrixMaxAttempts: Math.max(1, Math.floor(asFiniteNumber(value.matrixMaxAttempts, 10_000))),
    matrixMaxCellRetries: Math.max(1, Math.floor(asFiniteNumber(value.matrixMaxCellRetries, 100))),
    items: normalizeRhythmItems(value.items),
    selectedId: asString(value.selectedId)
  }
}

function normalizeSequencerSnapshot(value: unknown): Partial<SequencerSessionSnapshot> {
  if (!isObject(value)) throw new Error('Preset sequencer snapshot is missing or invalid.')
  if (!Array.isArray(value.tracks)) throw new Error('Preset sequencer snapshot must include a tracks array.')
  return {
    bpm: Math.max(30, Math.min(300, Math.round(asFiniteNumber(value.bpm, 120)))),
    loopBars: Math.max(1, Math.round(asFiniteNumber(value.loopBars, 8))),
    midiEnabled: Boolean(value.midiEnabled),
    midiOutputId: value.midiOutputId == null ? null : asString(value.midiOutputId, null as any),
    midiChannel: Math.max(1, Math.min(16, Math.floor(asFiniteNumber(value.midiChannel, 10)))),
    tracks: value.tracks.map(normalizeSavedTrack).filter((track): track is SavedTrack => !!track)
  }
}

export function normalizePresetName(name: string) {
  const trimmed = name.trim()
  return trimmed || 'Untitled preset'
}

export function buildPresetLibrary(presets: SessionPreset[]): SessionPresetLibrary {
  return {
    version: PRESET_LIBRARY_VERSION,
    presets
  }
}

export function parsePresetLibraryJson(json: string): SessionPresetLibrary {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Preset JSON is not valid JSON.')
  }
  if (!isObject(parsed)) throw new Error('Preset JSON must be an object.')
  if (parsed.version !== PRESET_LIBRARY_VERSION) {
    throw new Error(`Unsupported preset library version: ${String(parsed.version)}`)
  }
  if (!Array.isArray(parsed.presets)) {
    throw new Error('Preset library must contain a presets array.')
  }
  const now = Date.now()
  const presets = parsed.presets.map((value, index) => {
    if (!isObject(value)) throw new Error(`Preset at index ${index} is invalid.`)
    return {
      id: asString(value.id, `preset-${index + 1}`),
      name: normalizePresetName(asString(value.name, `Preset ${index + 1}`)),
      createdAt: Math.floor(asFiniteNumber(value.createdAt, now)),
      updatedAt: Math.floor(asFiniteNumber(value.updatedAt, now)),
      rhythm: normalizeRhythmSnapshot(value.rhythm),
      sequencer: normalizeSequencerSnapshot(value.sequencer)
    } satisfies SessionPreset
  })
  return buildPresetLibrary(presets)
}