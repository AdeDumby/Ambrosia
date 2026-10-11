import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { analyzeTrack } from '../lib/analyseTrack'
import type { PendingAnalysis } from '../shared/types'
import { useLibrary } from './LibraryContext'

type Progress = { done: number; total: number; current: string }
type Summary = { analyzed: number; failed: number; stopped: boolean; errors: string[] }

type AnalysisState = {
  running: boolean
  progress: Progress | null
  summary: Summary | null
  start: (options?: { retryErrors?: boolean }) => Promise<void>
  stop: () => void
}

const AnalysisContext = createContext<AnalysisState | null>(null)

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const { refreshTracks } = useLibrary()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const runningRef = useRef(false)
  const stopRef = useRef(false)

  const start = useCallback(
    async (options?: { retryErrors?: boolean }) => {
      if (runningRef.current) return
      runningRef.current = true
      stopRef.current = false
      setRunning(true)
      setSummary(null)

      let analyzed = 0
      let failed = 0
      const errors: string[] = []

      try {
        if (options?.retryErrors) await window.api.clearAnalysisErrors()
        const pending: PendingAnalysis[] = await window.api.listPendingAnalysis()
        setProgress({ done: 0, total: pending.length, current: '' })

        for (const [index, track] of pending.entries()) {
          if (stopRef.current) break
          setProgress({ done: index, total: pending.length, current: track.filename })

          try {
            const result = await analyzeTrack(track.id, track.durationSec)
            await window.api.saveAnalysis(track.id, {
              ok: true,
              integrated: result.loudness.integrated,
              peak: result.loudness.peak,
              curve: result.loudness.curve
            })
            if (Number.isFinite(result.loudness.integrated)) analyzed += 1
            else failed += 1
          } catch (error) {
            const message = describeError(error)
            failed += 1
            if (errors.length < 5) errors.push(`${track.filename}: ${message}`)
            try {
              await window.api.saveAnalysis(track.id, { ok: false, message })
            } catch {
              // the error could not be stored, so this track stays pending for the next run
            }
          }
        }

        setSummary({ analyzed, failed, stopped: stopRef.current, errors })
      } catch (error) {
        setSummary({ analyzed, failed, stopped: true, errors: [describeError(error)] })
      } finally {
        runningRef.current = false
        setRunning(false)
        setProgress(null)
        await refreshTracks().catch(() => {})
      }
    },
    [refreshTracks]
  )

  const stop = useCallback(() => {
    stopRef.current = true
  }, [])

  const value = useMemo(
    () => ({ running, progress, summary, start, stop }),
    [running, progress, summary, start, stop]
  )

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>
}

export function useAnalysis(): AnalysisState {
  const context = useContext(AnalysisContext)
  if (!context) throw new Error('useAnalysis must be used inside AnalysisProvider')
  return context
}
