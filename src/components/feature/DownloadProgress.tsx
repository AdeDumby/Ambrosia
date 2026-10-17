import type { ScanPhase } from '../../shared/types'
import { useDownload, type Chain, type StepStatus } from '../../store/DownloadContext'
import { useAnalysis } from '../../store/AnalysisContext'
import type { DownloadState } from '../../shared/download'
import './DownloadProgress.css'

type View = { current: string; value?: number; max: number; output: string }

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

function downloadStep(state: DownloadState): { status: StepStatus; view: View } {
  const done = state.items.filter((item) => item.status === 'done').length
  const active = state.items.find(
    (item) => item.status === 'downloading' || item.status === 'converting'
  )
  const total = state.total ?? state.items.length

  if (state.phase === 'downloading') {
    return {
      status: 'running',
      view: {
        current: active?.title ?? '',
        value: state.total ? done : undefined,
        max: Math.max(total, 1),
        output: state.total ? `${done} of ${plural(total, 'track')} downloaded` : 'Starting...'
      }
    }
  }
  if (state.phase === 'downloaded') {
    const failed = state.items.filter((item) => item.status === 'failed').length
    return {
      status: 'done',
      view: {
        current: '',
        value: 1,
        max: 1,
        output: `${plural(done, 'track')} downloaded${failed > 0 ? `, ${failed} failed` : ''}`
      }
    }
  }
  if (state.phase === 'failed') {
    return { status: 'failed', view: { current: '', value: 0, max: 1, output: 'Failed' } }
  }
  if (state.phase === 'cancelled') {
    return { status: 'stopped', view: { current: '', value: 0, max: 1, output: 'Cancelled' } }
  }
  return { status: 'waiting', view: { current: '', value: 0, max: 1, output: 'Waiting' } }
}

function scanStep(chain: Chain | null): { status: StepStatus; view: View } {
  if (!chain)
    return { status: 'waiting', view: { current: '', value: 0, max: 1, output: 'Waiting' } }
  const { scan, scanProgress: progress, applied } = chain
  const found = progress?.found ?? 0

  if (scan === 'running') {
    const phase = progress && progress.phase !== 'idle' ? progress.phase : 'walking'
    const total = progress?.total ?? 0
    const determinate = (phase === 'reading' || phase === 'checking') && total > 0
    return {
      status: scan,
      view: {
        current: progress?.current ?? '',
        value: determinate ? progress?.done : undefined,
        max: determinate ? total : 1,
        output: `${plural(found, 'file')} found · ${PHASE_TEXT[phase]}...`
      }
    }
  }
  if (scan === 'done') {
    return {
      status: scan,
      view: {
        current: '',
        value: 1,
        max: 1,
        output: `${plural(applied?.filesFound ?? found, 'file')} found · ${applied?.added ?? 0} added to the library`
      }
    }
  }
  if (scan === 'stopped') {
    return {
      status: scan,
      view: { current: '', value: 0, max: 1, output: 'Stopped. Nothing was added.' }
    }
  }
  return {
    status: scan,
    view: { current: '', value: 0, max: 1, output: scan === 'failed' ? 'Failed' : 'Waiting' }
  }
}

function loudnessStep(
  chain: Chain | null,
  live: { done: number; total: number; current: string } | null
): { status: StepStatus; view: View } {
  if (!chain || chain.loudness === 'waiting') {
    return { status: 'waiting', view: { current: '', value: 0, max: 1, output: 'Waiting' } }
  }
  const summary = chain.analysis

  if (chain.loudness === 'running') {
    if (!live) return { status: 'running', view: { current: '', max: 1, output: 'Preparing...' } }
    if (live.total === 0) {
      return {
        status: 'running',
        view: { current: '', value: 1, max: 1, output: 'Nothing to analyze' }
      }
    }
    return {
      status: 'running',
      view: {
        current: live.current,
        value: live.done,
        max: live.total,
        output: `${live.done} of ${plural(live.total, 'file')} analyzed`
      }
    }
  }
  if (chain.loudness === 'done') {
    if (!summary || summary.analyzed + summary.failed === 0) {
      return {
        status: 'done',
        view: { current: '', value: 1, max: 1, output: 'Nothing to analyze' }
      }
    }
    return {
      status: 'done',
      view: {
        current: '',
        value: 1,
        max: 1,
        output: `${plural(summary.analyzed, 'file')} analyzed${summary.failed > 0 ? `, ${summary.failed} failed` : ''}`
      }
    }
  }
  return {
    status: chain.loudness,
    view: {
      current: '',
      value: 0,
      max: 1,
      output:
        chain.loudness === 'stopped'
          ? `Stopped. ${plural(summary?.analyzed ?? 0, 'file')} analyzed so far.`
          : 'Failed'
    }
  }
}

function Step({ title, status, view }: { title: string; status: StepStatus; view: View }) {
  return (
    <section className={`dp-step ${status}`}>
      <div className="dp-step-head">
        <strong>{title}</strong>
        {view.current && (
          <span className="dp-step-current" title={view.current}>
            {view.current}
          </span>
        )}
      </div>
      <progress max={view.max} value={view.value} />
      <p className="dp-step-output">{view.output}</p>
    </section>
  )
}

export default function DownloadProgress() {
  const { state, chain, chainBusy, cancel, reset, stopChain, dismissChain } = useDownload()
  const { progress: live } = useAnalysis()
  const running = state.phase === 'downloading'
  const idle = state.phase === 'idle' && chain === null

  if (idle) {
    return (
      <aside className="dp">
        <p className="dp-empty">Progress appears here once a download starts.</p>
      </aside>
    )
  }

  const download = downloadStep(state)
  const scan = scanStep(chain)
  const loudness = loudnessStep(chain, live)
  const stopLabel = chain?.scan === 'running' && chain.scanProgress?.phase === 'applying'
  const finished = chain?.finished ?? false

  return (
    <aside className="dp">
      <div className="dp-summary">
        <div>
          <strong>{state.franchise || 'Download'}</strong>
          <span className="dp-folder" title={state.folder}>
            {state.folder}
          </span>
        </div>
        {running ? (
          <button type="button" className="btn" onClick={() => void cancel()}>
            Cancel
          </button>
        ) : chainBusy ? (
          <button type="button" className="btn" disabled={stopLabel} onClick={stopChain}>
            Stop
          </button>
        ) : finished ? (
          <button type="button" className="btn btn-primary" onClick={dismissChain}>
            Done
          </button>
        ) : (
          <button type="button" className="btn" onClick={() => void reset()}>
            Start over
          </button>
        )}
      </div>

      {chain?.rename && (
        <p className="dp-note">
          {chain.rename.renamed} of {chain.rename.total} files renamed.
        </p>
      )}

      <Step title="Step 1: Downloading" status={download.status} view={download.view} />
      <Step title="Step 2: Scanning" status={scan.status} view={scan.view} />
      <Step title="Step 3: Loudness" status={loudness.status} view={loudness.view} />

      {chain?.error && (
        <p className="dp-error" role="alert">
          {chain.error}
        </p>
      )}
      {chain?.scan === 'stopped' || chain?.scan === 'failed' ? (
        <p className="dp-note">
          The files are renamed but not in the library. Use Scan library, then Apply changes in
          Settings to add them.
        </p>
      ) : null}
      {chain?.analysis && chain.analysis.errors.length > 0 && (
        <ul className="dp-list">
          {chain.analysis.errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </aside>
  )
}
