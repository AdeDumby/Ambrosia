import type { Appearance, Density } from '../shared/settings'
import { isLight, readableOn } from './color'

const DENSITY_FACTOR: Record<Density, number> = {
  spacey: 1.25,
  comfortable: 1,
  compact: 0.75
}

export function applyAppearance(appearance: Appearance): void {
  const root = document.documentElement
  root.style.setProperty('--accent', appearance.accentColor)
  root.style.setProperty('--accent-text', readableOn(appearance.accentColor))
  root.style.setProperty('--page-bg', appearance.pageBackground)
  root.style.setProperty('--panel', appearance.panelBackground)
  root.style.setProperty('--raised', appearance.raisedBackground)
  root.style.setProperty('--border', appearance.borderColor)
  root.style.setProperty('--text', readableOn(appearance.pageBackground))
  root.style.setProperty('--density', String(DENSITY_FACTOR[appearance.density]))
  root.style.colorScheme = isLight(appearance.pageBackground) ? 'light' : 'dark'
}
