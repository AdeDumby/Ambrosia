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
import { DEFAULT_SETTINGS, type Appearance, type Settings } from '../shared/settings'

type SettingsState = {
  settings: Settings
  updateAppearance: (patch: Partial<Appearance>) => void
  resetAppearance: () => void
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

  const value = useMemo(
    () => (settings ? { settings, updateAppearance, resetAppearance } : null),
    [settings, updateAppearance, resetAppearance]
  )

  if (!value) return null

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsState {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used inside SettingsProvider')
  return context
}
