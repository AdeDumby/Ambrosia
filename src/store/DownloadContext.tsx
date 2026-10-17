import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react'
import { errorMessage } from '../lib/errors'
import type { RenameRule } from '../lib/renameRules'
import { idleDownloadState, type DownloadState, type FinishResult } from '../shared/download'
import type { ApplyResult, ScanProgress } from '../shared/types'
import { useAnalysis, type AnalysisSummary } from './AnalysisContext'
import { useLibrary } from './LibraryContext'

export type StepStatus = 'waiting' | 'running' | 'done' | 'stopped' | 'failed'

export type Chain = {
  rename: FinishResult | null
  scan: StepStatus
  scanProgress: ScanProgress | null
  applied: ApplyResult | null
  loudness: StepStatus
  analysis: AnalysisSummary | null
  error: string | null
  finished: boolean
}

type DownloadContextState = {
  state: DownloadState
  chain: Chain | null
  chainBusy: boolean
  rules: RenameRule[]
  setRules: Dispatch<SetStateAction<RenameRule[]>>
  manual: Record<number, string>
  setManual: Dispatch<SetStateAction<Record<number, string>>>
  start: (franchise: string, url: string) => Promise<void>
  cancel: () => Promise<void>
  reset: () => Promise<void>
  finish: (entries: { index: number; name: string }[]) => Promise<void>
  stopChain: () => void
  dismissChain: () => void
}

const POLL_MS = 400
const SCAN_POLL_MS = 150
const CANCELLED = 'Scan cancelled'

const DownloadContext = createContext<DownloadContextState | null>(null)

export function DownloadProvider({ children }: { children: ReactNode }) {
  const { refreshTracks, refreshTags } = useLibrary()
  const { start: runAnalysis, stop: stopAnalysis } = useAnalysis()
  const [state, setState] = useState<DownloadState>(idleDownloadState)
  const [chain, setChain] = useState<Chain | null>(null)
  const [rules, setRules] = useState<RenameRule[]>([])
  const [manual, setManual] = useState<Record<number, string>>({})
  const busyRef = useRef(false)
  const phaseRef = useRef<'scan' | 'loudness' | null>(null)

  const refresh = useCallback(async () => {
    try {
      setState(await window.api.getDownloadState())
    } catch {
      // the next poll tries again
    }
  }, [])

  const patch = useCallback((changes: Partial<Chain>) => {
    setChain((previous) => (previous ? { ...previous, ...changes } : previous))
  }, [])

  const clearRenaming = useCallback(() => {
    setRules([])
    setManual({})
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
      clearRenaming()
      setChain(null)
      await window.api.startDownload(franchise, url)
      await refresh()
    },
    [clearRenaming, refresh]
  )

  const cancel = useCallback(async () => {
    await window.api.cancelDownload()
    await refresh()
  }, [refresh])

  const reset = useCallback(async () => {
    if (busyRef.current) return
    await window.api.resetDownload()
    clearRenaming()
    setChain(null)
    await refresh()
  }, [clearRenaming, refresh])

  const finish = useCallback(
    async (entries: { index: number; name: string }[]) => {
      if (busyRef.current) return
      busyRef.current = true
      phaseRef.current = null

      let renamed: FinishResult
      try {
        renamed = await window.api.finishDownload(entries)
      } catch (error) {
        busyRef.current = false
        throw error
      }

      clearRenaming()
      await refresh()
      setChain({
        rename: renamed,
        scan: 'running',
        scanProgress: null,
        applied: null,
        loudness: 'waiting',
        analysis: null,
        error: null,
        finished: false
      })

      phaseRef.current = 'scan'
      const timer = window.setInterval(() => {
        window.api
          .getScanProgress()
          .then((progress) => patch({ scanProgress: progress }))
          .catch(() => {})
      }, SCAN_POLL_MS)

      let applied: ApplyResult
      try {
        applied = await window.api.applyDownloads()
      } catch (error) {
        window.clearInterval(timer)
        const message = errorMessage(error)
        patch(
          message === CANCELLED
            ? { scan: 'stopped', finished: true }
            : { scan: 'failed', error: message, finished: true }
        )
        busyRef.current = false
        phaseRef.current = null
        return
      }

      window.clearInterval(timer)
      patch({ scan: 'done', applied, loudness: 'running' })
      await Promise.all([refreshTracks(), refreshTags()]).catch(() => {})

      phaseRef.current = 'loudness'
      const summary = await runAnalysis()
      patch({
        loudness: summary?.stopped ? 'stopped' : 'done',
        analysis: summary,
        finished: true
      })
      busyRef.current = false
      phaseRef.current = null
    },
    [clearRenaming, refresh, patch, refreshTracks, refreshTags, runAnalysis]
  )

  const stopChain = useCallback(() => {
    if (phaseRef.current === 'scan') void window.api.cancelScan()
    else if (phaseRef.current === 'loudness') stopAnalysis()
  }, [stopAnalysis])

  const dismissChain = useCallback(() => {
    if (busyRef.current) return
    void window.api.resetDownload().catch(() => {})
    setChain(null)
  }, [])

  const chainBusy = chain !== null && !chain.finished

  const value = useMemo(
    () => ({
      state,
      chain,
      chainBusy,
      rules,
      setRules,
      manual,
      setManual,
      start,
      cancel,
      reset,
      finish,
      stopChain,
      dismissChain
    }),
    [state, chain, chainBusy, rules, manual, start, cancel, reset, finish, stopChain, dismissChain]
  )

  return <DownloadContext.Provider value={value}>{children}</DownloadContext.Provider>
}

export function useDownload(): DownloadContextState {
  const context = useContext(DownloadContext)
  if (!context) throw new Error('useDownload must be used inside DownloadProvider')
  return context
}
