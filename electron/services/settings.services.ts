import type { DatabaseSync } from 'node:sqlite'
import {
  DEFAULT_SETTINGS,
  DELETE_MODES,
  DENSITIES,
  type Appearance,
  type DeleteMode,
  type Density,
  type LibrarySettings,
  type PlaybackSettings,
  type Settings
} from '../../src/shared/settings.ts'

const SETTINGS_KEY = 'settings'
const HEX_COLOR = /^#[0-9a-f]{6}$/i

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : fallback
}

function parseAppearance(raw: unknown): Appearance {
  const source = asObject(raw)
  const defaults = DEFAULT_SETTINGS.appearance
  return {
    accentColor: color(source.accentColor, defaults.accentColor),
    density: DENSITIES.includes(source.density as Density)
      ? (source.density as Density)
      : defaults.density,
    pageBackground: color(source.pageBackground, defaults.pageBackground),
    panelBackground: color(source.panelBackground, defaults.panelBackground),
    raisedBackground: color(source.raisedBackground, defaults.raisedBackground),
    borderColor: color(source.borderColor, defaults.borderColor)
  }
}

function parseLibrary(raw: unknown): LibrarySettings {
  const source = asObject(raw)
  const defaults = DEFAULT_SETTINGS.library
  return {
    deleteMode: DELETE_MODES.includes(source.deleteMode as DeleteMode)
      ? (source.deleteMode as DeleteMode)
      : defaults.deleteMode
  }
}

function parsePlayback(raw: unknown): PlaybackSettings {
  const source = asObject(raw)
  const defaults = DEFAULT_SETTINGS.playback
  const volume = source.defaultVolume
  return {
    defaultVolume:
      typeof volume === 'number' && Number.isFinite(volume)
        ? Math.min(Math.max(volume, 0), 1)
        : defaults.defaultVolume
  }
}

export function parseSettings(raw: unknown): Settings {
  const source = asObject(raw)
  return {
    appearance: parseAppearance(source.appearance),
    library: parseLibrary(source.library),
    playback: parsePlayback(source.playback)
  }
}

export function getSettings(db: DatabaseSync): Settings {
  const row = db.prepare('SELECT value FROM setting WHERE key = ?').get(SETTINGS_KEY) as unknown as
    { value: string } | undefined
  if (!row) return parseSettings({})
  try {
    return parseSettings(JSON.parse(row.value))
  } catch {
    return parseSettings({})
  }
}

export function saveSettings(db: DatabaseSync, raw: unknown): void {
  const settings = parseSettings(raw)
  db.prepare(
    `INSERT INTO setting (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(SETTINGS_KEY, JSON.stringify(settings))
}
