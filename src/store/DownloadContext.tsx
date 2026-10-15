import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { idleDownloadState, type DownloadState } from '../shared/download'

type DownloadContextState = {
  state: DownloadState
  start: (franchise: string, url: string) => Promise<void>
  cancel: () => Promise<void>
  reset: () => Promise<void>
}

const POLL_MS = 400

const DownloadContext = createContext<DownloadContextState | null>(null)

export function DownloadProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DownloadState>(idleDownloadState)

  const refresh = useCallback(async () => {
    try {
      setState(await window.api.getDownloadState())
    } catch {
      // the next poll tries again
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (state.phase !== 'downloading') return
    const timer = window.setInterval(() => void refresh(), POLL_MS)
    return () => window.clearInterval(timer)
  }, [state.phase, refresh])

  const start = useCallback(
    async (franchise: string, url: string) => {
      await window.api.startDownload(franchise, url)
      await refresh()
    },
    [refresh]
  )

  const cancel = useCallback(async () => {
    await window.api.cancelDownload()
    await refresh()
  }, [refresh])

  const reset = useCallback(async () => {
    await window.api.resetDownload()
    await refresh()
  }, [refresh])

  const value = useMemo(() => ({ state, start, cancel, reset }), [state, start, cancel, reset])

  return <DownloadContext.Provider value={value}>{children}</DownloadContext.Provider>
}

export function useDownload(): DownloadContextState {
  const context = useContext(DownloadContext)
  if (!context) throw new Error('useDownload must be used inside DownloadProvider')
  return context
}
