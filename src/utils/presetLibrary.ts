import type { SavedPatternEntry, SavedTrack, SequencerSessionSnapshot } from '@/stores/sequencerStore'
import type { Mode } from '@/utils/rhythm'
import { isTrackType } from '@/utils/drumSounds'

export const PRESET_LIBRARY_VERSION = 2 as const

type LegacyPresetLibraryVersion = 1 | 2

export type PresetFolder = {
  id: string
  name: string
  parentId: string | null
  order: number
  createdAt: number
  updatedAt: number
}

export type SessionPreset = {
  id: string
  name: string
  folderId: string | null
  order: number
  createdAt: number
  updatedAt: number
  sequencer: Partial<SequencerSessionSnapshot>
}

export type SessionPresetLibrary = {
  version: typeof PRESET_LIBRARY_VERSION
  folders: PresetFolder[]
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

function isSwingGrid(value: unknown): value is SequencerSessionSnapshot['swingGrid'] {
  return value === 'eighth' || value === 'sixteenth'
}

function normalizeParams(value: unknown): Record<string, number | string> {
  if (!isObject(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number | string] => {
      return typeof entry[1] === 'number' || typeof entry[1] === 'string'
    })
  )
}

function normalizeFolderName(name: string) {
  const trimmed = name.trim()
  return trimmed || 'Untitled folder'
}

function normalizeFolderId(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null
}

function normalizeFolderOrder(value: unknown, fallback: number) {
  return Math.max(0, Math.floor(asFiniteNumber(value, fallback)))
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
  const type = isTrackType(value.type) ? value.type : 'tom'
  const patterns = Array.isArray(value.patterns)
    ? value.patterns.map(normalizeSavedPatternEntry).filter((entry): entry is SavedPatternEntry => !!entry)
    : []
  return {
    id: asString(value.id, `preset-track-${index}`),
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
    loopBars: Math.max(1, Math.round(asFiniteNumber(value.loopBars, 8))),
    swingPercent: Math.max(0, Math.min(100, Math.round(asFiniteNumber(value.swingPercent, 0)))),
    swingGrid: isSwingGrid(value.swingGrid) ? value.swingGrid : 'eighth',
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

function normalizeFolder(value: unknown, index: number, now: number): PresetFolder {
  if (!isObject(value)) {
    return {
      id: `folder-${index + 1}`,
      name: `Folder ${index + 1}`,
      parentId: null,
      order: index,
      createdAt: now,
      updatedAt: now
    }
  }
  return {
    id: asString(value.id, `folder-${index + 1}`),
    name: normalizeFolderName(asString(value.name, `Folder ${index + 1}`)),
    parentId: normalizeFolderId(value.parentId),
    order: normalizeFolderOrder(value.order, index),
    createdAt: Math.floor(asFiniteNumber(value.createdAt, now)),
    updatedAt: Math.floor(asFiniteNumber(value.updatedAt, now))
  }
}

function normalizeFolders(value: unknown, now: number): PresetFolder[] {
  if (!Array.isArray(value)) return []

  const folderById = new Map<string, PresetFolder>()
  for (let index = 0; index < value.length; index++) {
    const folder = normalizeFolder(value[index], index, now)
    if (!folderById.has(folder.id)) {
      folderById.set(folder.id, folder)
    }
  }

  const folders = [...folderById.values()]
  const idSet = new Set(folders.map((folder) => folder.id))

  for (const folder of folders) {
    if (!folder.parentId || !idSet.has(folder.parentId) || folder.parentId === folder.id) {
      folder.parentId = null
    }
  }

  // Break cycles by resetting the current folder parent to root whenever a cycle is detected.
  const parentOf = new Map(folders.map((folder) => [folder.id, folder.parentId]))
  for (const folder of folders) {
    let cursor = folder.parentId
    const visited = new Set<string>([folder.id])
    while (cursor) {
      if (visited.has(cursor)) {
        folder.parentId = null
        parentOf.set(folder.id, null)
        break
      }
      visited.add(cursor)
      cursor = parentOf.get(cursor) ?? null
    }
  }

  return folders
}

export function buildPresetLibrary(presets: SessionPreset[], folders: PresetFolder[] = []): SessionPresetLibrary {
  return {
    version: PRESET_LIBRARY_VERSION,
    folders,
    presets
  }
}

function normalizePresets(
  value: unknown,
  now: number,
  version: LegacyPresetLibraryVersion,
  folderIds: Set<string>
): SessionPreset[] {
  if (!Array.isArray(value)) {
    throw new Error('Preset library must contain a presets array.')
  }

  return value.map((entry, index) => {
    if (!isObject(entry)) throw new Error(`Preset at index ${index} is invalid.`)
    const fallbackFolderId = version >= 2 ? normalizeFolderId(entry.folderId) : null
    const folderId = fallbackFolderId && folderIds.has(fallbackFolderId) ? fallbackFolderId : null

    return {
      id: asString(entry.id, `preset-${index + 1}`),
      name: normalizePresetName(asString(entry.name, `Preset ${index + 1}`)),
      folderId,
      order: normalizeFolderOrder(entry.order, index),
      createdAt: Math.floor(asFiniteNumber(entry.createdAt, now)),
      updatedAt: Math.floor(asFiniteNumber(entry.updatedAt, now)),
      sequencer: normalizeSequencerSnapshot(entry.sequencer)
    } satisfies SessionPreset
  })
}

export function parsePresetLibraryJson(json: string): SessionPresetLibrary {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Preset JSON is not valid JSON.')
  }
  if (!isObject(parsed)) throw new Error('Preset JSON must be an object.')
  const rawVersion = Math.floor(asFiniteNumber(parsed.version, Number.NaN))
  if (rawVersion !== 1 && rawVersion !== 2) {
    throw new Error(`Unsupported preset library version: ${String(parsed.version)}`)
  }

  const version = rawVersion as LegacyPresetLibraryVersion
  const now = Date.now()
  const folders = version >= 2 ? normalizeFolders(parsed.folders, now) : []
  const folderIds = new Set(folders.map((folder) => folder.id))
  const presets = normalizePresets(parsed.presets, now, version, folderIds)

  return buildPresetLibrary(presets, folders)
}
