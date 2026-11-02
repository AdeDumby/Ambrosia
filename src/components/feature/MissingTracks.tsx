import { useState } from 'react'
import { errorMessage } from '../../lib/errors'
import { formatDuration, type MissingReport } from '../../shared/missing'
import './MissingTracks.css'

type Props = {
  franchise: string
  url: string
  /** The franchise and the link are filled in and valid. */
  ready: boolean
  onDownload: (items: number[], total: number) => Promise<void>
}

export default function MissingTracks({ franchise, url, ready, onDownload }: Props) {
  // A report belongs to the folder and the link it was made for, and goes away when they change.
  const key = `${franchise}\n${url}`
  const [result, setResult] = useState<{
    key: string
    report: MissingReport | null
    error: string | null
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const current = result?.key === key ? result : null
  const report = current?.report ?? null
  const error = current?.error ?? null
  const [downloadError, setDownloadError] = useState<string | null>(null)

  async function check() {
    setBusy(true)
    setDownloadError(null)
    setResult(null)
    try {
      setResult({ key, report: await window.api.checkMissingTracks(franchise, url), error: null })
    } catch (failure) {
      setResult({ key, report: null, error: errorMessage(failure) })
    } finally {
      setBusy(false)
    }
  }

  async function download(items: number[], total: number) {
    setDownloadError(null)
    try {
      await onDownload(items, total)
    } catch (failure) {
      setDownloadError(errorMessage(failure))
    }
  }

  const found = report ? report.matched.id + report.matched.title + report.matched.length : 0
  const wanted = report?.missing.filter((track) => !track.unavailable) ?? []
  const unavailable = report?.missing.filter((track) => track.unavailable) ?? []

  return (
    <section className="missing" aria-label="Missing tracks">
      <div className="missing-head">
        <button
          type="button"
          className="btn"
          disabled={!ready || busy}
          onClick={() => void check()}
        >
          {busy ? 'Checking...' : 'Check for missing tracks'}
        </button>
        <span className="missing-hint">
          Compares the playlist with the folder. Nothing is downloaded yet.
        </span>
      </div>

      {(error ?? downloadError) && (
        <p className="download-problem" role="alert">
          {error ?? downloadError}
        </p>
      )}

      {report && (
        <div className="missing-report" role="status">
          <p>
            The playlist has <strong>{report.playlistTotal}</strong> tracks.{' '}
            {report.folderMissing ? 'The folder does not exist yet. ' : ''}
            <strong>{found}</strong> {found === 1 ? 'is' : 'are'} in the folder
            {found > 0 &&
              ` (${[
                report.matched.id > 0 && `${report.matched.id} by video ID`,
                report.matched.title > 0 && `${report.matched.title} by title`,
                report.matched.length > 0 && `${report.matched.length} by length`
              ]
                .filter(Boolean)
                .join(', ')})`}
            . <strong>{wanted.length}</strong> {wanted.length === 1 ? 'is' : 'are'} missing
            {unavailable.length > 0 && `, and ${unavailable.length} can no longer be downloaded`}.
          </p>

          {wanted.length > 0 && (
            <>
              <ul className="missing-list">
                {wanted.map((track) => (
                  <li key={track.index}>
                    <span className="missing-number">{track.index}</span>
                    <span className="missing-title">{track.title || track.id}</span>
                    <span className="missing-length">{formatDuration(track.durationSec)}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  void download(
                    wanted.map((track) => track.index),
                    report.playlistTotal
                  )
                }
              >
                {`Download the ${wanted.length} missing ${wanted.length === 1 ? 'track' : 'tracks'}`}
              </button>
            </>
          )}
          {wanted.length === 0 && <p>Nothing to download: the folder has every track.</p>}

          {unavailable.length > 0 && (
            <details>
              <summary>{unavailable.length} deleted or private (can not be downloaded)</summary>
              <ul className="missing-list">
                {unavailable.map((track) => (
                  <li key={track.index}>
                    <span className="missing-number">{track.index}</span>
                    <span className="missing-title">{track.title}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {report.extraFiles.length > 0 && (
            <details>
              <summary>
                {report.extraFiles.length} files in the folder are not in this playlist
              </summary>
              <ul className="missing-list">
                {report.extraFiles.map((name) => (
                  <li key={name}>
                    <span className="missing-title">{name}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
