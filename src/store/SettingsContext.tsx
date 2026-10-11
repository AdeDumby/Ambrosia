import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { applyAppearance } from '../lib/applyAppearance'
import {
  DEFAULT_APPEARANCE,
  DEFAULT_SETTINGS,
  WITHERING_LAVENDER,
  type Appearance,
  type LibrarySettings,
  type ListSettings,
  type PlaybackSettings,
  type Preset,
  type ReviewSettings,
  type Settings
} from '../shared/settings'

type SettingsState = {
  settings: Settings
  updateAppearance: (patch: Partial<Appearance>) => void
  resetAppearance: () => void
  updateLibrary: (patch: Partial<LibrarySettings>) => void
  updatePlayback: (patch: Partial<PlaybackSettings>) => void
  updateReview: (patch: Partial<ReviewSettings>) => void
  updateList: (patch: Partial<ListSettings>) => void
  applyPreset: (preset: Preset) => void
  savePreset: (name: string) => void
  deletePreset: (name: string) => void
  reloadSettings: () => Promise<void>
}

const SAVE_DELAY_MS = 400
const LIGHT_QUERY = '(prefers-color-scheme: light)'

const SettingsContext = createContext<SettingsState | null>(null)

function useSystemPrefersLight(): boolean {
  const [light, setLight] = useState(() => window.matchMedia(LIGHT_QUERY).matches)

  useEffect(() => {
    const query = window.matchMedia(LIGHT_QUERY)
    const update = () => setLight(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return light
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const systemPrefersLight = useSystemPrefersLight()
  const dirty = useRef(false)

  useEffect(() => {
    window.api
      .getSettings()
      .then(setSettings)
      .catch(() => setSettings(DEFAULT_SETTINGS))
  }, [])

  const appearance = settings?.appearance
  useEffect(() => {
    if (appearance) applyAppearance(appearance, systemPrefersLight)
  }, [appearance, systemPrefersLight])

  useEffect(() => {
    if (!settings || !dirty.current) return
    const timer = window.setTimeout(() => {
      dirty.current = false
      void window.api.saveSettings(settings)
    }, SAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [settings])

  const change = useCallback((update: (previous: Settings) => Settings) => {
    dirty.current = true
    setSettings((previous) => (previous ? update(previous) : previous))
  }, [])

  const updateAppearance = useCallback(
    (patch: Partial<Appearance>) =>
      change((previous) => ({
        ...previous,
        appearance: { ...previous.appearance, ...patch }
      })),
    [change]
  )

  const resetAppearance = useCallback(
    () =>
      change((previous) => ({
        ...previous,
        appearance: { ...DEFAULT_APPEARANCE, mode: previous.appearance.mode },
        activePreset: WITHERING_LAVENDER.name
      })),
    [change]
  )

  const updateLibrary = useCallback(
    (patch: Partial<LibrarySettings>) =>
      change((previous) => ({ ...previous, library: { ...previous.library, ...patch } })),
    [change]
  )

  const updatePlayback = useCallback(
    (patch: Partial<PlaybackSettings>) =>
      change((previous) => ({ ...previous, playback: { ...previous.playback, ...patch } })),
    [change]
  )

  const updateReview = useCallback(
    (patch: Partial<ReviewSettings>) =>
      change((previous) => ({ ...previous, review: { ...previous.review, ...patch } })),
    [change]
  )

  const updateList = useCallback(
    (patch: Partial<ListSettings>) =>
      change((previous) => ({ ...previous, list: { ...previous.list, ...patch } })),
    [change]
  )

  const applyPreset = useCallback(
    (preset: Preset) =>
      change((previous) => ({
        ...previous,
        appearance: { ...preset.appearance, mode: previous.appearance.mode },
        playback: {
          ...previous.playback,
          defaultVolume: preset.defaultVolume ?? previous.playback.defaultVolume,
          normalize: preset.normalize ?? previous.playback.normalize,
          targetLufs: preset.targetLufs ?? previous.playback.targetLufs
        },
        review:
          preset.hiddenFolders === undefined
            ? previous.review
            : { ...previous.review, hiddenFolders: [...preset.hiddenFolders] },
        activePreset: preset.name
      })),
    [change]
  )

  const savePreset = useCallback(
    (name: string) =>
      change((previous) => {
        const current = previous.appearance
        const preset: Preset = {
          name,
          appearance: {
            accentColor: current.accentColor,
            density: current.density,
            pageBackground: current.pageBackground,
            panelBackground: current.panelBackground,
            raisedBackground: current.raisedBackground,
            borderColor: current.borderColor
          },
          defaultVolume: previous.playback.defaultVolume,
          normalize: previous.playback.normalize,
          targetLufs: previous.playback.targetLufs,
          hiddenFolders: [...previous.review.hiddenFolders]
        }
        const others = previous.presets.filter(
          (existing) => existing.name.toLowerCase() !== name.toLowerCase()
        )
        return { ...previous, presets: [...others, preset], activePreset: name }
      }),
    [change]
  )

  const deletePreset = useCallback(
    (name: string) =>
      change((previous) => ({
        ...previous,
        presets: previous.presets.filter((preset) => preset.name !== name),
        activePreset: previous.activePreset === name ? null : previous.activePreset
      })),
    [change]
  )

  const reloadSettings = useCallback(async () => {
    const fresh = await window.api.getSettings()
    dirty.current = false
    setSettings(fresh)
  }, [])

  const value = useMemo(
    () =>
      settings
        ? {
            settings,
            updateAppearance,
            resetAppearance,
            updateLibrary,
            updatePlayback,
            updateReview,
            updateList,
            applyPreset,
            savePreset,
            deletePreset,
            reloadSettings
          }
        : null,
    [
      settings,
      updateAppearance,
      resetAppearance,
      updateLibrary,
      updatePlayback,
      updateReview,
      updateList,
      applyPreset,
      savePreset,
      deletePreset,
      reloadSettings
    ]
  )

  if (!value) return null

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsState {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used inside SettingsProvider')
  return context
}
