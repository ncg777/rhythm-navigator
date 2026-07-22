import { describe, expect, it } from 'vitest'
import {
  PRESET_LIBRARY_VERSION,
  normalizePresetName,
  parsePresetLibraryJson
} from '@/utils/presetLibrary'
import { TRACK_TYPES, defaultMidiKeyForTrackType } from '@/utils/drumSounds'

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
    expect(library.presets[0].sequencer.tracks?.[0]).not.toHaveProperty('name')
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

  it('preserves the expanded GM percussion track types and migrates legacy Perc to Tom', () => {
    const requestedTypes = [...TRACK_TYPES]
    const tracks = [
      ...requestedTypes.map((type, index) => ({
        id: `track-${type}`,
        name: type,
        type,
        volume: 1,
        pan: 0,
        velocity: 1,
        velRandom: 0,
        timeScale: 1,
        noteLength: 0.5,
        params: { midiKey: 50 + index },
        patterns: []
      })),
      {
        id: 'legacy-perc',
        name: 'Perc',
        type: 'perc',
        volume: 1,
        pan: 0,
        velocity: 1,
        velRandom: 0,
        timeScale: 1,
        noteLength: 0.5,
        params: { midiKey: 40 },
        patterns: []
      }
    ]

    const library = parsePresetLibraryJson(JSON.stringify({
      version: PRESET_LIBRARY_VERSION,
      folders: [],
      presets: [{
        id: 'preset-gm',
        name: 'GM kit',
        folderId: null,
        order: 0,
        createdAt: 1,
        updatedAt: 1,
        sequencer: { bpm: 120, loopBars: 4, tracks }
      }]
    }))

    const parsedTracks = library.presets[0].sequencer.tracks ?? []
    expect(parsedTracks.slice(0, requestedTypes.length).map(track => track.type)).toEqual(requestedTypes)
    expect(parsedTracks.slice(0, requestedTypes.length).map(track => track.params.midiKey)).toEqual(
      requestedTypes.map((_, index) => 50 + index)
    )
    expect(parsedTracks.at(-1)?.type).toBe('tom')
    expect(parsedTracks.at(-1)?.params.midiKey).toBe(40)
  })

  it('uses GM percussion defaults for every named voice', () => {
    expect({
      kick: defaultMidiKeyForTrackType('kick'),
      rimshot: defaultMidiKeyForTrackType('rimshot'),
      snare: defaultMidiKeyForTrackType('snare'),
      clap: defaultMidiKeyForTrackType('clap'),
      hat: defaultMidiKeyForTrackType('hat'),
      hatPedal: defaultMidiKeyForTrackType('hatPedal'),
      hatOpen: defaultMidiKeyForTrackType('hatOpen'),
      tomLowFloor: defaultMidiKeyForTrackType('tomLowFloor'),
      tomHighFloor: defaultMidiKeyForTrackType('tomHighFloor'),
      tomLowMid: defaultMidiKeyForTrackType('tomLowMid'),
      tomHighMid: defaultMidiKeyForTrackType('tomHighMid'),
      tomHigh: defaultMidiKeyForTrackType('tomHigh'),
      crash: defaultMidiKeyForTrackType('crash'),
      chineseCymbal: defaultMidiKeyForTrackType('chineseCymbal'),
      ride: defaultMidiKeyForTrackType('ride'),
      rideBell: defaultMidiKeyForTrackType('rideBell'),
      splash: defaultMidiKeyForTrackType('splash'),
      crash2: defaultMidiKeyForTrackType('crash2'),
      ride2: defaultMidiKeyForTrackType('ride2'),
      cowbell: defaultMidiKeyForTrackType('cowbell'),
      tom: defaultMidiKeyForTrackType('tom'),
      congaMuted: defaultMidiKeyForTrackType('congaMuted'),
      congaOpen: defaultMidiKeyForTrackType('congaOpen'),
      conga: defaultMidiKeyForTrackType('conga'),
      timbale: defaultMidiKeyForTrackType('timbale'),
      timbaleLow: defaultMidiKeyForTrackType('timbaleLow'),
      triangleMuted: defaultMidiKeyForTrackType('triangleMuted'),
      triangle: defaultMidiKeyForTrackType('triangle'),
      shaker: defaultMidiKeyForTrackType('shaker'),
      chimes: defaultMidiKeyForTrackType('chimes')
    }).toEqual({
      kick: 36,
      rimshot: 37,
      snare: 38,
      clap: 39,
      hat: 42,
      hatPedal: 44,
      hatOpen: 46,
      tomLowFloor: 41,
      tomHighFloor: 43,
      tomLowMid: 47,
      tomHighMid: 48,
      tomHigh: 50,
      crash: 49,
      chineseCymbal: 52,
      ride: 51,
      rideBell: 53,
      splash: 55,
      crash2: 57,
      ride2: 59,
      cowbell: 56,
      tom: 45,
      congaMuted: 62,
      congaOpen: 63,
      conga: 64,
      timbale: 65,
      timbaleLow: 66,
      triangleMuted: 80,
      triangle: 81,
      shaker: 82,
      chimes: 84
    })
  })

  it('rejects unsupported preset library versions', () => {
    expect(() => parsePresetLibraryJson(JSON.stringify({ version: 99, presets: [] }))).toThrow(
      /Unsupported preset library version/
    )
  })
})
