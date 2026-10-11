import { useAnalysis } from '../../store/AnalysisContext'
import './AnalysisPanel.css'

export default function AnalysisPanel() {
  const { running, progress, summary, start, stop } = useAnalysis()
  const percent =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="analysis-panel">
      <div className="settings-row">
        <span>Measure the loudness of tracks that have none yet</span>
        <div className="settings-actions">
          {running ? (
            <button type="button" className="btn" onClick={stop}>
              Stop
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => start({ retryErrors: true })}>
              Analyze loudness
            </button>
          )}
        </div>
      </div>
      <p className="settings-hint">
        It also retries tracks that failed before. Everything measured so far is kept, so stopping
        is safe.
      </p>

      {running && progress && (
        <div className="analysis-progress" role="status">
          <progress value={progress.done} max={Math.max(progress.total, 1)} />
          <span>
            {progress.done} / {progress.total} ({percent}%)
          </span>
          <span className="analysis-current" title={progress.current}>
            {progress.current}
          </span>
        </div>
      )}

      {!running && summary && (
        <p className={summary.failed > 0 ? 'settings-error' : 'settings-success'} role="status">
          {summary.stopped ? 'Stopped. ' : 'Done. '}
          {summary.analyzed} analyzed, {summary.failed} failed.
        </p>
      )}
      {!running && summary && summary.errors.length > 0 && (
        <ul className="analysis-errors">
          {summary.errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
