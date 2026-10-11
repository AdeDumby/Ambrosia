export type Density = 'spacey' | 'comfortable' | 'compact'

export const DENSITIES: Density[] = ['spacey', 'comfortable', 'compact']

export type AppearanceMode = 'system' | 'light' | 'dark'

export const APPEARANCE_MODES: AppearanceMode[] = ['system', 'light', 'dark']

export type DeleteMode = 'deleted-folder' | 'permanent'

export const DELETE_MODES: DeleteMode[] = ['deleted-folder', 'permanent']

export const BATCH_SIZE_MIN = 20
export const BATCH_SIZE_MAX = 300
export const BATCH_SIZE_STEP = 10

export const LOUDNESS_MIN = -24
export const LOUDNESS_MAX = -8
export const LOUDNESS_PRESETS = [
  { value: -19, label: 'Quiet' },
  { value: -14, label: 'Normal' },
  { value: -11, label: 'Loud' }
]

export const MAX_PRESET_NAME = 40
export const MAX_PRESETS = 50

export type PresetAppearance = {
  accentColor: string
  density: Density
  pageBackground: string
  panelBackground: string
  raisedBackground: string
  borderColor: string
}

export type Appearance = PresetAppearance & {
  mode: AppearanceMode
}

export type Preset = {
  name: string
  appearance: PresetAppearance
  defaultVolume?: number
  normalize?: boolean
  targetLufs?: number
  hiddenFolders?: string[]
}

export type LibrarySettings = {
  deleteMode: DeleteMode
}

export type PlaybackSettings = {
  defaultVolume: number
  normalize: boolean
  targetLufs: number
}

export type ReviewSettings = {
  hiddenFolders: string[]
}

export type ListSettings = {
  batchSize: number
}

export type Settings = {
  appearance: Appearance
  library: LibrarySettings
  playback: PlaybackSettings
  review: ReviewSettings
  list: ListSettings
  presets: Preset[]
  activePreset: string | null
}

export const WITHERING_LAVENDER: Preset = {
  name: 'Withering Lavender',
  appearance: {
    accentColor: '#ad88dd',
    density: 'compact',
    pageBackground: '#0c0817',
    panelBackground: '#120623',
    raisedBackground: '#1d0f2f',
    borderColor: '#8c5dbb'
  }
}

export const BUILT_IN_PRESETS: Preset[] = [
  WITHERING_LAVENDER,
  {
    name: 'Brass',
    appearance: {
      accentColor: '#c19a49',
      density: 'comfortable',
      pageBackground: '#14161c',
      panelBackground: '#1b1e28',
      raisedBackground: '#242838',
      borderColor: '#333a4d'
    }
  },
  {
    name: 'Midnight Teal',
    appearance: {
      accentColor: '#4f8a82',
      density: 'comfortable',
      pageBackground: '#0e1418',
      panelBackground: '#152025',
      raisedBackground: '#1d2b31',
      borderColor: '#2b3d43'
    }
  },
  {
    name: 'Crimson Dusk',
    appearance: {
      accentColor: '#b5533c',
      density: 'comfortable',
      pageBackground: '#180f0e',
      panelBackground: '#211615',
      raisedBackground: '#2c1e1c',
      borderColor: '#43302c'
    }
  },
  {
    name: 'Forest Indigo',
    appearance: {
      accentColor: '#6b7fd7',
      density: 'comfortable',
      pageBackground: '#12141f',
      panelBackground: '#191c2b',
      raisedBackground: '#222639',
      borderColor: '#333a56'
    }
  }
]

export const DEFAULT_APPEARANCE: Appearance = {
  ...WITHERING_LAVENDER.appearance,
  mode: 'system'
}

export const DEFAULT_LIBRARY: LibrarySettings = {
  deleteMode: 'deleted-folder'
}

export const DEFAULT_PLAYBACK: PlaybackSettings = {
  defaultVolume: 0.5,
  normalize: true,
  targetLufs: -14
}

export const DEFAULT_REVIEW: ReviewSettings = {
  hiddenFolders: ['Franchise']
}

export const DEFAULT_LIST: ListSettings = {
  batchSize: 60
}

export const DEFAULT_SETTINGS: Settings = {
  appearance: DEFAULT_APPEARANCE,
  library: DEFAULT_LIBRARY,
  playback: DEFAULT_PLAYBACK,
  review: DEFAULT_REVIEW,
  list: DEFAULT_LIST,
  presets: [],
  activePreset: WITHERING_LAVENDER.name
}

export function presetMatches(settings: Settings, preset: Preset): boolean {
  const current = settings.appearance
  const wanted = preset.appearance
  const sameLook =
    current.accentColor === wanted.accentColor &&
    current.density === wanted.density &&
    current.pageBackground === wanted.pageBackground &&
    current.panelBackground === wanted.panelBackground &&
    current.raisedBackground === wanted.raisedBackground &&
    current.borderColor === wanted.borderColor
  if (!sameLook) return false

  if (
    preset.defaultVolume !== undefined &&
    Math.abs(settings.playback.defaultVolume - preset.defaultVolume) > 0.001
  ) {
    return false
  }
  if (preset.normalize !== undefined && settings.playback.normalize !== preset.normalize) {
    return false
  }
  if (preset.targetLufs !== undefined && settings.playback.targetLufs !== preset.targetLufs) {
    return false
  }

  if (preset.hiddenFolders !== undefined) {
    const mine = new Set(settings.review.hiddenFolders.map((name) => name.toLowerCase()))
    const theirs = new Set(preset.hiddenFolders.map((name) => name.toLowerCase()))
    if (mine.size !== theirs.size || [...theirs].some((name) => !mine.has(name))) return false
  }

  return true
}
