export type Density = 'spacey' | 'comfortable' | 'compact'

export const DENSITIES: Density[] = ['spacey', 'comfortable', 'compact']

export type DeleteMode = 'deleted-folder' | 'permanent'

export const DELETE_MODES: DeleteMode[] = ['deleted-folder', 'permanent']

export const BATCH_SIZE_MIN = 20
export const BATCH_SIZE_MAX = 300
export const BATCH_SIZE_STEP = 10

export type Appearance = {
  accentColor: string
  density: Density
  pageBackground: string
  panelBackground: string
  raisedBackground: string
  borderColor: string
}

export type LibrarySettings = {
  deleteMode: DeleteMode
}

export type PlaybackSettings = {
  defaultVolume: number
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
}

export const DEFAULT_APPEARANCE: Appearance = {
  accentColor: '#ad88dd',
  density: 'compact',
  pageBackground: '#0c0817',
  panelBackground: '#120623',
  raisedBackground: '#1d0f2f',
  borderColor: '#8c5dbb'
}

export const DEFAULT_LIBRARY: LibrarySettings = {
  deleteMode: 'deleted-folder'
}

export const DEFAULT_PLAYBACK: PlaybackSettings = {
  defaultVolume: 0.5
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
  list: DEFAULT_LIST
}
