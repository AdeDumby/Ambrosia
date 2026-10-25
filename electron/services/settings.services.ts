import type { DatabaseSync } from 'node:sqlite'
import {
  APPEARANCE_MODES,
  BATCH_SIZE_MAX,
  BATCH_SIZE_MIN,
  BUILT_IN_PRESETS,
  DEFAULT_SETTINGS,
  DELETE_MODES,
  DENSITIES,
  MAX_PRESETS,
  MAX_PRESET_NAME,
  type Appearance,
  type AppearanceMode,
  type DeleteMode,
  type Density,
  type LibrarySettings,
  type ListSettings,
  type PlaybackSettings,
  type Preset,
  type PresetAppearance,
  type ReviewSettings,
  type Settings,
  type UpdateSettings,
  LOUDNESS_MAX,
  LOUDNESS_MIN
} from '../../src/shared/settings.ts'

const SETTINGS_KEY = 'settings'
const HEX_COLOR = /^#[0-9a-f]{6}$/i
const MAX_HIDDEN_FOLDERS = 200
const MAX_FOLDER_NAME = 100

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : fallback
}

function volume(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(value, 0), 1)
    : undefined
}

function folderList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null

  const seen = new Set<string>()
  const folders: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const name = item.trim()
    if (name === '' || name.length > MAX_FOLDER_NAME || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    folders.push(name)
    if (folders.length >= MAX_HIDDEN_FOLDERS) break
  }
  return folders
}

function parsePalette(raw: unknown): PresetAppearance {
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

function parseAppearance(raw: unknown): Appearance {
  const source = asObject(raw)
  return {
    ...parsePalette(raw),
    mode: APPEARANCE_MODES.includes(source.mode as AppearanceMode)
      ? (source.mode as AppearanceMode)
      : DEFAULT_SETTINGS.appearance.mode
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

function targetLoudness(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(Math.max(Math.round(value), LOUDNESS_MIN), LOUDNESS_MAX)
    : undefined
}

function parsePlayback(raw: unknown): PlaybackSettings {
  const source = asObject(raw)
  const defaults = DEFAULT_SETTINGS.playback
  return {
    defaultVolume: volume(source.defaultVolume) ?? defaults.defaultVolume,
    normalize: typeof source.normalize === 'boolean' ? source.normalize : defaults.normalize,
    targetLufs: targetLoudness(source.targetLufs) ?? defaults.targetLufs
  }
}

function parseReview(raw: unknown): ReviewSettings {
  const source = asObject(raw)
  return {
    hiddenFolders: folderList(source.hiddenFolders) ?? [...DEFAULT_SETTINGS.review.hiddenFolders]
  }
}

function parseList(raw: unknown): ListSettings {
  const source = asObject(raw)
  const size = source.batchSize
  return {
    batchSize:
      typeof size === 'number' && Number.isFinite(size)
        ? Math.min(Math.max(Math.round(size), BATCH_SIZE_MIN), BATCH_SIZE_MAX)
        : DEFAULT_SETTINGS.list.batchSize
  }
}

function parseUpdates(raw: unknown): UpdateSettings {
  const source = asObject(raw)
  return {
    autoCheck:
      typeof source.autoCheck === 'boolean' ? source.autoCheck : DEFAULT_SETTINGS.updates.autoCheck
  }
}

function parsePresets(raw: unknown): Preset[] {
  if (!Array.isArray(raw)) return []

  const taken = new Set(BUILT_IN_PRESETS.map((preset) => preset.name.toLowerCase()))
  const presets: Preset[] = []
  for (const item of raw) {
    const source = asObject(item)
    const name = typeof source.name === 'string' ? source.name.trim() : ''
    if (name === '' || name.length > MAX_PRESET_NAME || taken.has(name.toLowerCase())) continue
    taken.add(name.toLowerCase())

    presets.push({
      name,
      appearance: parsePalette(source.appearance),
      defaultVolume: volume(source.defaultVolume),
      normalize: typeof source.normalize === 'boolean' ? source.normalize : undefined,
      targetLufs: targetLoudness(source.targetLufs),
      hiddenFolders: folderList(source.hiddenFolders) ?? undefined
    })
    if (presets.length >= MAX_PRESETS) break
  }
  return presets
}

function parseActivePreset(value: unknown): string | null {
  if (value === null) return null
  if (typeof value === 'string') {
    const name = value.trim()
    return name !== '' && name.length <= MAX_PRESET_NAME ? name : null
  }
  return DEFAULT_SETTINGS.activePreset
}

export function parseSettings(raw: unknown): Settings {
  const source = asObject(raw)
  return {
    appearance: parseAppearance(source.appearance),
    library: parseLibrary(source.library),
    playback: parsePlayback(source.playback),
    review: parseReview(source.review),
    list: parseList(source.list),
    updates: parseUpdates(source.updates),
    presets: parsePresets(source.presets),
    activePreset: parseActivePreset(source.activePreset)
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
