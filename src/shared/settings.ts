export type Density = 'spacey' | 'comfortable' | 'compact'

export const DENSITIES: Density[] = ['spacey', 'comfortable', 'compact']

export type Appearance = {
  accentColor: string
  density: Density
  pageBackground: string
  panelBackground: string
  raisedBackground: string
  borderColor: string
}

export type Settings = {
  appearance: Appearance
}

export const DEFAULT_APPEARANCE: Appearance = {
  accentColor: '#ad88dd',
  density: 'compact',
  pageBackground: '#0c0817',
  panelBackground: '#120623',
  raisedBackground: '#1d0f2f',
  borderColor: '#8c5dbb'
}

export const DEFAULT_SETTINGS: Settings = {
  appearance: DEFAULT_APPEARANCE
}
