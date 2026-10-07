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
  DEFAULT_SETTINGS,
  type Appearance,
  type LibrarySettings,
  type PlaybackSettings,
  type Settings
} from '../shared/settings'

type SettingsState = {
  settings: Settings
  updateAppearance: (patch: Partial<Appearance>) => void
  resetAppearance: () => void
  updateLibrary: (patch: Partial<LibrarySettings>) => void
  updatePlayback: (patch: Partial<PlaybackSettings>) => void
}

const SAVE_DELAY_MS = 400

const SettingsContext = createContext<SettingsState | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const dirty = useRef(false)

  useEffect(() => {
    window.api
      .getSettings()
      .then(setSettings)
      .catch(() => setSettings(DEFAULT_SETTINGS))
  }, [])

  const appearance = settings?.appearance
  useEffect(() => {
    if (appearance) applyAppearance(appearance)
  }, [appearance])

  useEffect(() => {
    if (!settings || !dirty.current) return
    const timer = window.setTimeout(() => {
      dirty.current = false
      void window.api.saveSettings(settings)
    }, SAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [settings])

  const updateAppearance = useCallback((patch: Partial<Appearance>) => {
    dirty.current = true
    setSettings((previous) =>
      previous ? { ...previous, appearance: { ...previous.appearance, ...patch } } : previous
    )
  }, [])

  const resetAppearance = useCallback(() => {
    dirty.current = true
    setSettings((previous) =>
      previous ? { ...previous, appearance: DEFAULT_SETTINGS.appearance } : previous
    )
  }, [])

  const updateLibrary = useCallback((patch: Partial<LibrarySettings>) => {
    dirty.current = true
    setSettings((previous) =>
      previous ? { ...previous, library: { ...previous.library, ...patch } } : previous
    )
  }, [])

  const updatePlayback = useCallback((patch: Partial<PlaybackSettings>) => {
    dirty.current = true
    setSettings((previous) =>
      previous ? { ...previous, playback: { ...previous.playback, ...patch } } : previous
    )
  }, [])

  const value = useMemo(
    () =>
      settings
        ? { settings, updateAppearance, resetAppearance, updateLibrary, updatePlayback }
        : null,
    [settings, updateAppearance, resetAppearance, updateLibrary, updatePlayback]
  )

  if (!value) return null

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsState {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used inside SettingsProvider')
  return context
}
