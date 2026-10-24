import { useEffect, useRef, useState } from 'react'
import type { ScanPhase } from '../../shared/types'
import { useAnalysis } from '../../store/AnalysisContext'
import { useScanRun, type Run, type StepStatus } from '../../store/ScanRunContext'
import './ScanDialog.css'

type StepView = { current: string; value?: number; max: number; output: string }
type LiveAnalysis = { done: number; total: number; current: string }

const TITLES: Record<Run['kind'], string> = {
  scan: 'Scanning the library',
  apply: 'Scanning the library',
  analyze: 'Measuring loudness'
}

const PHASE_TEXT: Record<ScanPhase, string> = {
  idle: 'Looking through the folders',
  walking: 'Looking through the folders',
  reading: 'Reading new files',
  checking: 'Checking known tracks',
  applying: 'Adding to the library'
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function scanStep(run: Run): StepView {
  const { progress, report, applyResult } = run
  const found = progress?.found ?? 0

  switch (run.step1) {
    case 'running': {
      const phase = progress && progress.phase !== 'idle' ? progress.phase : 'walking'
      const total = progress?.total ?? 0
      const determinate = (phase === 'reading' || phase === 'checking') && total > 0
      return {
        current: progress?.current ?? '',
        value: determinate ? progress?.done : undefined,
        max: determinate ? total : 1,
        output: `${plural(found, 'file')} found · ${PHASE_TEXT[phase]}...`
      }
    }
    case 'done': {
      const files = report?.filesFound ?? applyResult?.filesFound ?? found
      const detail = report
        ? `${report.toAdd.length} new, ${report.missing.length} missing`
        : applyResult
          ? `${applyResult.added} added, ${applyResult.dropped} removed${applyResult.skipped > 0 ? `, ${applyResult.skipped} left alone` : ''}`
          : ''
      return {
        current: '',
        value: 1,
        max: 1,
        output: `${plural(files, 'file')} found${detail ? ` · ${detail}` : ''}`
      }
    }
    case 'stopped':
      return { current: '', value: 0, max: 1, output: 'Stopped. Nothing was changed.' }
    case 'failed':
      return { current: '', value: 0, max: 1, output: 'Failed' }
    case 'waiting':
      return { current: '', value: 0, max: 1, output: 'Waiting' }
    default:
      return { current: '', value: 0, max: 1, output: 'Not part of this action' }
  }
}

function analysisStep(run: Run, live: LiveAnalysis | null): StepView {
  const summary = run.analysis

  switch (run.step2) {
    case 'running':
      if (!live) return { current: '', value: undefined, max: 1, output: 'Preparing...' }
      if (live.total === 0) return { current: '', value: 1, max: 1, output: 'Nothing to analyze' }
      return {
        current: live.current,
        value: live.done,
        max: live.total,
        output: `${live.done} of ${plural(live.total, 'file')} analyzed`
      }
    case 'done': {
      if (!summary) return { current: '', value: 1, max: 1, output: 'Done' }
      if (summary.analyzed + summary.failed === 0) {
        return { current: '', value: 1, max: 1, output: 'Nothing to analyze' }
      }
      const failed = summary.failed > 0 ? `, ${summary.failed} failed` : ''
      return {
        current: '',
        value: 1,
        max: 1,
        output: `${plural(summary.analyzed, 'file')} analyzed${failed}`
      }
    }
    case 'stopped':
      return {
        current: '',
        value: 0,
        max: 1,
        output: `Stopped. ${plural(summary?.analyzed ?? 0, 'file')} analyzed so far.`
      }
    case 'failed':
      return { current: '', value: 0, max: 1, output: 'Failed' }
    case 'waiting':
      return { current: '', value: 0, max: 1, output: 'Waiting for step 1' }
    default:
      return { current: '', value: 0, max: 1, output: 'Not part of this action' }
  }
}

function Step({ title, status, view }: { title: string; status: StepStatus; view: StepView }) {
  return (
    <section className={`scan-step ${status}`}>
      <div className="scan-step-head">
        <strong>{title}</strong>
        {view.current && (
          <span className="scan-step-current" title={view.current}>
            {view.current}
          </span>
        )}
      </div>
      <progress max={view.max} value={view.value} />
      <p className="scan-step-output">{view.output}</p>
    </section>
  )
}

export default function ScanDialog() {
  const { run, stop, dismiss } = useScanRun()
  const { progress: live } = useAnalysis()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [stoppingId, setStoppingId] = useState<number | null>(null)

  const open = run !== null
  const finished = run?.finished ?? false
  const stopping = run !== null && stoppingId === run.id && !run.finished
  const applying = run?.step1 === 'running' && run.progress?.phase === 'applying'

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (finished) closeRef.current?.focus()
  }, [finished])

  return (
    <dialog
      ref={dialogRef}
      className="scan-dialog"
      onCancel={(event) => {
        event.preventDefault()
        if (finished) dismiss()
      }}
    >
      {run && (
        <>
          <h2 className="scan-dialog-title">{TITLES[run.kind]}</h2>
          <Step title="Step 1: Scanning" status={run.step1} view={scanStep(run)} />
          <Step title="Step 2: Loudness" status={run.step2} view={analysisStep(run, live)} />

          {run.error && (
            <p className="scan-dialog-error" role="alert">
              {run.error}
            </p>
          )}
          {run.analysis && run.analysis.errors.length > 0 && (
            <ul className="scan-dialog-list">
              {run.analysis.errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
          {run.applyResult && run.applyResult.vanishedFolders.length > 0 && (
            <div className="scan-dialog-alarm" role="alert">
              <strong>Folders not found, their tracks were left alone</strong>
              <ul>
                {run.applyResult.vanishedFolders.map((folder) => (
                  <li key={folder.path}>
                    {folder.path} ({folder.tracks})
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="scan-dialog-buttons">
            {finished ? (
              <button ref={closeRef} type="button" className="btn btn-primary" onClick={dismiss}>
                Close
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                disabled={stopping || applying}
                onClick={() => {
                  setStoppingId(run.id)
                  stop()
                }}
              >
                {stopping ? 'Stopping...' : 'Stop'}
              </button>
            )}
          </div>
        </>
      )}
    </dialog>
  )
}
