import { describe, expect, it } from 'vitest'
import {
  PRESET_LIBRARY_VERSION,
  normalizePresetName,
  parsePresetLibraryJson
} from '@/utils/presetLibrary'

describe('presetLibrary', () => {
  it('normalizes blank names', () => {
    expect(normalizePresetName('   ')).toBe('Untitled preset')
    expect(normalizePresetName('  Session A  ')).toBe('Session A')
  })

  it('parses a preset library and preserves clap and crash tracks', () => {
    const library = parsePresetLibraryJson(JSON.stringify({
      version: PRESET_LIBRARY_VERSION,
      folders: [
        {
          id: 'folder-a',
          name: ' Kits ',
          parentId: null,
          order: 2,
          createdAt: 1,
          updatedAt: 2
        }
      ],
      presets: [
        {
          id: 'preset-1',
          name: '  Clap Session  ',
          folderId: 'folder-a',
          order: 3,
          createdAt: 1,
          updatedAt: 2,
          sequencer: {
            bpm: 128,
            loopBars: 4,
            tracks: [
              {
                id: 'track-1',
                name: 'Clap',
                type: 'clap',
                volume: 0.8,
                pan: 0,
                velocity: 0.9,
                velRandom: 0.1,
                timeScale: 1,
                noteLength: 0.5,
                params: { midiKey: 39, snap: 0.85 },
                patterns: []
              },
              {
                id: 'track-2',
                name: 'Crash',
                type: 'crash',
                volume: 0.7,
                pan: 0.1,
                velocity: 0.85,
                velRandom: 0.05,
                timeScale: 1,
                noteLength: 0.5,
                params: { midiKey: 49, wash: 0.65 },
                patterns: []
              }
            ]
          }
        }
      ]
    }))

    expect(library.presets).toHaveLength(1)
    expect(library.folders).toHaveLength(1)
    expect(library.folders[0].name).toBe('Kits')
    expect(library.presets[0].name).toBe('Clap Session')
    expect(library.presets[0].folderId).toBe('folder-a')
    expect(library.presets[0].order).toBe(3)
    expect(library.presets[0].sequencer.tracks?.map(track => track.type)).toEqual(['clap', 'crash'])
    expect(library.presets[0].sequencer.bpm).toBe(128)
    expect(library.presets[0].sequencer.swingPercent).toBe(0)
    expect(library.presets[0].sequencer.swingGrid).toBe('eighth')
  })

  it('migrates version 1 libraries without folders', () => {
    const library = parsePresetLibraryJson(JSON.stringify({
      version: 1,
      presets: [
        {
          id: 'legacy-1',
          name: 'Legacy',
          createdAt: 1,
          updatedAt: 2,
          sequencer: {
            bpm: 100,
            loopBars: 4,
            tracks: []
          }
        }
      ]
    }))

    expect(library.version).toBe(PRESET_LIBRARY_VERSION)
    expect(library.folders).toHaveLength(0)
    expect(library.presets[0].folderId).toBeNull()
    expect(library.presets[0].order).toBe(0)
  })

  it('rejects unsupported preset library versions', () => {
    expect(() => parsePresetLibraryJson(JSON.stringify({ version: 99, presets: [] }))).toThrow(
      /Unsupported preset library version/
    )
  })
})
