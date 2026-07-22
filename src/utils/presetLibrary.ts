import type { SavedPatternEntry, SavedTrack, SequencerSessionSnapshot, TrackType } from '@/stores/sequencerStore'
import type { Mode } from '@/utils/rhythm'

export const PRESET_LIBRARY_VERSION = 1 as const

export type SessionPreset = {
  id: string
  name: string
  folder?: string
  createdAt: number
  updatedAt: number
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
  return value === 'kick' || value === 'snare' || value === 'clap' || value === 'hat' || value === 'crash' || value === 'perc'
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

function normalizeSequencerSnapshot(value: unknown): Partial<SequencerSessionSnapshot> {
  if (!isObject(value)) throw new Error('Preset sequencer snapshot is missing or invalid.')
  if (!Array.isArray(value.tracks)) throw new Error('Preset sequencer snapshot must include a tracks array.')
  return {
    bpm: Math.max(30, Math.min(300, Math.round(asFiniteNumber(value.bpm, 120)))),
    swing: Math.max(0, Math.min(100, Math.round(asFiniteNumber(value.swing, 50)))),
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
      folder: typeof value.folder === 'string' ? value.folder : undefined,
      createdAt: Math.floor(asFiniteNumber(value.createdAt, now)),
      updatedAt: Math.floor(asFiniteNumber(value.updatedAt, now)),
      sequencer: normalizeSequencerSnapshot(value.sequencer)
    } satisfies SessionPreset
  })
  return buildPresetLibrary(presets)
}
