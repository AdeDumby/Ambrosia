import type { Appearance, Density } from '../shared/settings'
import { flipLightness, isLight, readableOn } from './color'

const DENSITY_FACTOR: Record<Density, number> = {
  spacey: 1.25,
  comfortable: 1,
  compact: 0.75
}

function adapt(appearance: Appearance, wantLight: boolean): Appearance {
  if (isLight(appearance.pageBackground) === wantLight) return appearance
  return {
    ...appearance,
    pageBackground: flipLightness(appearance.pageBackground),
    panelBackground: flipLightness(appearance.panelBackground),
    raisedBackground: flipLightness(appearance.raisedBackground),
    borderColor: flipLightness(appearance.borderColor)
  }
}

export function applyAppearance(
  appearance: Appearance,
  systemPrefersLight: boolean
): { background: string; symbol: string } {
  const wantLight = appearance.mode === 'system' ? systemPrefersLight : appearance.mode === 'light'
  const palette = adapt(appearance, wantLight)

  const root = document.documentElement
  root.style.setProperty('--accent', palette.accentColor)
  root.style.setProperty('--accent-text', readableOn(palette.accentColor))
  root.style.setProperty('--page-bg', palette.pageBackground)
  root.style.setProperty('--panel', palette.panelBackground)
  root.style.setProperty('--raised', palette.raisedBackground)
  root.style.setProperty('--border', palette.borderColor)
  root.style.setProperty('--text', readableOn(palette.pageBackground))
  root.style.setProperty('--density', String(DENSITY_FACTOR[palette.density]))
  root.style.colorScheme = isLight(palette.pageBackground) ? 'light' : 'dark'
  return { background: palette.panelBackground, symbol: readableOn(palette.panelBackground) }
}
