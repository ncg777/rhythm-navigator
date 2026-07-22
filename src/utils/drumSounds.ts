export const TRACK_TYPES = [
  'kick',
  'rimshot',
  'snare',
  'clap',
  'tomLowFloor',
  'hat',
  'tomHighFloor',
  'hatPedal',
  'tom',
  'hatOpen',
  'tomLowMid',
  'tomHighMid',
  'crash',
  'tomHigh',
  'chineseCymbal',
  'ride',
  'rideBell',
  'splash',
  'cowbell',
  'crash2',
  'ride2',
  'congaMuted',
  'congaOpen',
  'conga',
  'timbale',
  'timbaleLow',
  'triangleMuted',
  'triangle',
  'shaker',
  'chimes'
] as const

export type TrackType = typeof TRACK_TYPES[number]

const TRACK_TYPE_LABELS: Record<TrackType, string> = {
  kick: 'Kick',
  snare: 'Snare',
  clap: 'Clap',
  rimshot: 'Rimshot / Side Stick',
  hat: 'Closed Hi-Hat',
  hatPedal: 'Pedal Hi-Hat',
  hatOpen: 'Open Hi-Hat',
  tomLowFloor: 'Low Floor Tom',
  tomHighFloor: 'High Floor Tom',
  tom: 'Low Tom',
  tomLowMid: 'Low-Mid Tom',
  tomHighMid: 'High-Mid Tom',
  tomHigh: 'High Tom',
  crash: 'Crash Cymbal 1',
  chineseCymbal: 'Chinese Cymbal',
  ride: 'Ride Cymbal 1',
  rideBell: 'Ride Bell',
  splash: 'Splash Cymbal',
  crash2: 'Crash Cymbal 2',
  ride2: 'Ride Cymbal 2',
  cowbell: 'Cowbell',
  congaMuted: 'Mute High Conga',
  congaOpen: 'Open High Conga',
  conga: 'Low Conga',
  timbale: 'High Timbale',
  timbaleLow: 'Low Timbale',
  triangleMuted: 'Mute Triangle',
  triangle: 'Open Triangle',
  shaker: 'Shaker',
  chimes: 'Bell Tree / Chimes'
}

export function isTrackType(value: unknown): value is TrackType {
  return typeof value === 'string' && (TRACK_TYPES as readonly string[]).includes(value)
}

export function trackTypeLabel(type: TrackType): string {
  return TRACK_TYPE_LABELS[type]
}

export function defaultMidiKeyForTrackType(type: TrackType): number {
  switch (type) {
    case 'kick': return 36
    case 'rimshot': return 37
    case 'snare': return 38
    case 'clap': return 39
    case 'tomLowFloor': return 41
    case 'hat': return 42
    case 'tomHighFloor': return 43
    case 'hatPedal': return 44
    case 'hatOpen': return 46
    case 'tomLowMid': return 47
    case 'tomHighMid': return 48
    case 'crash': return 49
    case 'tomHigh': return 50
    case 'ride': return 51
    case 'chineseCymbal': return 52
    case 'rideBell': return 53
    case 'splash': return 55
    case 'cowbell': return 56
    case 'crash2': return 57
    case 'ride2': return 59
    case 'congaMuted': return 62
    case 'congaOpen': return 63
    case 'tom': return 45
    case 'conga': return 64
    case 'timbale': return 65
    case 'timbaleLow': return 66
    case 'triangleMuted': return 80
    case 'triangle': return 81
    case 'shaker': return 82
    case 'chimes': return 84
  }
}