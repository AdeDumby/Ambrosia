import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { errorMessage } from '../lib/errors'
import type { ApplyResult, ScanProgress, ScanReport } from '../shared/types'
import { useAnalysis, type AnalysisSummary } from './AnalysisContext'
import { useLibrary } from './LibraryContext'

export type RunKind = 'scan' | 'apply' | 'analyze'
export type StepStatus = 'waiting' | 'running' | 'done' | 'skipped' | 'stopped' | 'failed'

export type Run = {
  id: number
  kind: RunKind
  step1: StepStatus
  step2: StepStatus
  progress: ScanProgress | null
  report: ScanReport | null
  applyResult: ApplyResult | null
  analysis: AnalysisSummary | null
  error: string | null
  finished: boolean
}

type ScanRunState = {
  run: Run | null
  busy: boolean
  lastReport: ScanReport | null
  lastApplyResult: ApplyResult | null
  clearReport: () => void
  startScan: () => Promise<void>
  startApply: () => Promise<void>
  stop: () => void
  dismiss: () => void
}

const CANCELLED = 'Scan cancelled'
const POLL_MS = 150

const ScanRunContext = createContext<ScanRunState | null>(null)

export function ScanRunProvider({ children }: { children: ReactNode }) {
  const { refreshTracks, refreshTags } = useLibrary()
  const { start: runAnalysis, stop: stopAnalysis } = useAnalysis()
  const [run, setRun] = useState<Run | null>(null)
  const [lastReport, setLastReport] = useState<ScanReport | null>(null)
  const [lastApplyResult, setLastApplyResult] = useState<ApplyResult | null>(null)
  const busyRef = useRef(false)
  const counter = useRef(0)

  const patch = useCallback((changes: Partial<Run>) => {
    setRun((previous) => (previous ? { ...previous, ...changes } : previous))
  }, [])

  const begin = useCallback((kind: RunKind): boolean => {
    if (busyRef.current) return false
    busyRef.current = true
    counter.current += 1
    setRun({
      id: counter.current,
      kind,
      step1: kind === 'analyze' ? 'skipped' : 'running',
      step2: kind === 'scan' ? 'skipped' : kind === 'analyze' ? 'running' : 'waiting',
      progress: null,
      report: null,
      applyResult: null,
      analysis: null,
      error: null,
      finished: false
    })
    return true
  }, [])

  const poll = useCallback((): (() => void) => {
    const timer = window.setInterval(() => {
      window.api
        .getScanProgress()
        .then((progress) => patch({ progress }))
        .catch(() => {})
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [patch])

  const startScan = useCallback(async () => {
    if (!begin('scan')) return
    setLastReport(null)
    setLastApplyResult(null)
    const stopPolling = poll()
    try {
      const report = await window.api.scanLibrary()
      setLastReport(report)
      patch({ step1: 'done', report, finished: true })
    } catch (error) {
      const message = errorMessage(error)
      patch(
        message === CANCELLED
          ? { step1: 'stopped', finished: true }
          : { step1: 'failed', error: message, finished: true }
      )
    } finally {
      stopPolling()
      busyRef.current = false
    }
  }, [begin, poll, patch])

  const startApply = useCallback(async () => {
    if (!begin('apply')) return
    const stopPolling = poll()

    let applied: ApplyResult
    try {
      applied = await window.api.applyScan()
    } catch (error) {
      stopPolling()
      const message = errorMessage(error)
      patch(
        message === CANCELLED
          ? { step1: 'stopped', step2: 'skipped', finished: true }
          : { step1: 'failed', step2: 'skipped', error: message, finished: true }
      )
      busyRef.current = false
      return
    }

    stopPolling()
    setLastApplyResult(applied)
    setLastReport(null)
    patch({ step1: 'done', step2: 'running', applyResult: applied })

    await Promise.all([refreshTracks(), refreshTags()]).catch(() => {})
    const summary = await runAnalysis()
    patch({ step2: summary?.stopped ? 'stopped' : 'done', analysis: summary, finished: true })
    busyRef.current = false
  }, [begin, poll, patch, refreshTracks, refreshTags, runAnalysis])

  const stop = useCallback(() => {
    if (!run || run.finished) return
    if (run.step1 === 'running') void window.api.cancelScan()
    else if (run.step2 === 'running') stopAnalysis()
  }, [run, stopAnalysis])

  const dismiss = useCallback(() => {
    setRun((previous) => (previous && previous.finished ? null : previous))
  }, [])

  const clearReport = useCallback(() => {
    setLastReport(null)
    setLastApplyResult(null)
  }, [])

  const busy = run !== null && !run.finished

  const value = useMemo(
    () => ({
      run,
      busy,
      lastReport,
      lastApplyResult,
      clearReport,
      startScan,
      startApply,
      stop,
      dismiss
    }),
    [run, busy, lastReport, lastApplyResult, clearReport, startScan, startApply, stop, dismiss]
  )

  return <ScanRunContext.Provider value={value}>{children}</ScanRunContext.Provider>
}

export function useScanRun(): ScanRunState {
  const context = useContext(ScanRunContext)
  if (!context) throw new Error('useScanRun must be used inside ScanRunProvider')
  return context
}
