import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'

const STORAGE_KEY = 'ambrosia.shortcuts'

type ShortcutsState = { enabled: boolean; toggle: () => void }

const ShortcutsContext = createContext<ShortcutsState | null>(null)

function load(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
    } catch {
      // storage unavailable: the shortcuts simply start enabled next time
    }
  }, [enabled])

  const toggle = useCallback(() => setEnabled((previous) => !previous), [])
  const value = useMemo(() => ({ enabled, toggle }), [enabled, toggle])

  return <ShortcutsContext.Provider value={value}>{children}</ShortcutsContext.Provider>
}

export function useShortcutsEnabled(): ShortcutsState {
  const context = useContext(ShortcutsContext)
  if (!context) throw new Error('useShortcutsEnabled must be used inside ShortcutsProvider')
  return context
}
