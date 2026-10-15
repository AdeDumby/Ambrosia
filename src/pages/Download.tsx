import { useState } from 'react'
import InlineError from '../components/item/InlineError'
import { errorMessage } from '../lib/errors'
import { checkFranchise, checkUrl, MAX_FRANCHISE_NAME } from '../shared/download'
import { useDownload } from '../store/DownloadContext'
import './Download.css'

const STATUS_TEXT = {
  downloading: 'Downloading',
  converting: 'Converting',
  done: 'Done',
  failed: 'Failed'
}

const PHASE_TEXT = {
  downloaded: 'Downloads finished.',
  failed: 'The download failed.',
  cancelled: 'The download was cancelled.'
}

export default function Download() {
  const { state, start, cancel, reset } = useDownload()
  const [franchise, setFranchise] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const idle = state.phase === 'idle'
  const running = state.phase === 'downloading'
  const franchiseProblem = franchise.trim() === '' ? null : checkFranchise(franchise)
  const urlProblem = url.trim() === '' ? null : checkUrl(url)
  const canStart =
    idle && franchise.trim() !== '' && url.trim() !== '' && !franchiseProblem && !urlProblem

  const done = state.items.filter((item) => item.status === 'done').length
  const overall = state.total ? Math.round((done / state.total) * 100) : undefined

  async function begin() {
    setError(null)
    try {
      await start(franchise, url)
    } catch (failure) {
      setError(errorMessage(failure))
    }
  }

  async function run(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
    } catch (failure) {
      setError(errorMessage(failure))
    }
  }

  return (
    <div className="download">
      {idle ? (
        <form
          className="download-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (canStart) void begin()
          }}
        >
          <label>
            <span>Franchise folder</span>
            <input
              type="text"
              value={franchise}
              maxLength={MAX_FRANCHISE_NAME}
              placeholder="FTL"
              onChange={(event) => setFranchise(event.target.value)}
            />
            {franchiseProblem && <small className="download-problem">{franchiseProblem}</small>}
          </label>
          <label>
            <span>YouTube playlist or video link</span>
            <input
              type="text"
              value={url}
              placeholder="https://www.youtube.com/playlist?list=..."
              onChange={(event) => setUrl(event.target.value)}
            />
            {urlProblem && <small className="download-problem">{urlProblem}</small>}
          </label>
          <button type="submit" className="btn btn-primary" disabled={!canStart}>
            Start download
          </button>
        </form>
      ) : (
        <div className="download-summary">
          <div>
            <strong>{state.franchise}</strong>
            <span className="download-folder">{state.folder}</span>
          </div>
          {running ? (
            <button type="button" className="btn" onClick={() => void run(cancel)}>
              Cancel
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => void run(reset)}>
              Start over
            </button>
          )}
        </div>
      )}

      {error && <InlineError message={error} onDismiss={() => setError(null)} />}

      {running && (
        <div className="download-overall">
          <progress max={100} value={overall} />
          <span>{state.total ? `${done} of ${state.total} tracks` : 'Starting...'}</span>
        </div>
      )}

      {!idle && !running && (
        <p
          className={
            state.phase === 'downloaded' && !state.error ? 'settings-success' : 'settings-error'
          }
        >
          {PHASE_TEXT[state.phase as keyof typeof PHASE_TEXT]} {state.error}
        </p>
      )}

      {state.items.length > 0 && (
        <ul className="download-list">
          {state.items.map((item) => (
            <li key={item.index} className={`download-item ${item.status}`}>
              <span className="download-index">{item.index}</span>
              <span className="download-title" title={item.error ?? item.title}>
                {item.title || 'Waiting for the title...'}
                {item.error && <small className="download-problem"> {item.error}</small>}
              </span>
              {item.status === 'downloading' ? (
                <progress max={100} value={item.percent} />
              ) : (
                <span className="download-status">{STATUS_TEXT[item.status]}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {state.log.length > 0 && (
        <details className="download-details">
          <summary>Details</summary>
          <pre>{state.log.join('\n')}</pre>
        </details>
      )}
    </div>
  )
}
