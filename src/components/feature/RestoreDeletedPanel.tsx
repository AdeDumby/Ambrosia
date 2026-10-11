import { useEffect, useState } from 'react'
import ConfirmDialog from '../item/ConfirmDialog'
import { useLibrary } from '../../store/LibraryContext'
import type { PurgeResult, RestoreResult } from '../../shared/types'

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

type Pending = 'restore' | 'purge' | null

export default function RestoreDeletedPanel() {
  const { refreshTracks, refreshTags } = useLibrary()
  const [count, setCount] = useState<number | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [busy, setBusy] = useState(false)
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null)
  const [purgeResult, setPurgeResult] = useState<PurgeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api
      .countDeletedTracks()
      .then(setCount)
      .catch(() => setCount(null))
  }, [])

  async function run(action: 'restore' | 'purge') {
    setPending(null)
    setError(null)
    setRestoreResult(null)
    setPurgeResult(null)
    setBusy(true)
    try {
      if (action === 'restore') {
        setRestoreResult(await window.api.restoreDeletedTracks())
      } else {
        setPurgeResult(await window.api.purgeGoneDeletedTracks())
      }
      await Promise.all([refreshTracks(), refreshTags()])
      setCount(await window.api.countDeletedTracks())
    } catch {
      setError('That failed. Some tracks may have been changed before the error.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="settings-row">
        <span>Deleted tracks{count !== null ? `: ${count}` : ''}</span>
        <div className="settings-actions">
          <button
            type="button"
            className="btn"
            disabled={busy || !count}
            onClick={() => setPending('purge')}
          >
            Forget the ones whose file is gone
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy || !count}
            onClick={() => setPending('restore')}
          >
            {busy ? 'Working...' : 'Restore all'}
          </button>
        </div>
      </div>

      {error && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}

      {restoreResult && (
        <p
          className={restoreResult.failed.length > 0 ? 'settings-error' : 'settings-success'}
          role="status"
        >
          {plural(restoreResult.restored, 'track')} restored
          {restoreResult.unhidden > 0 && `, ${plural(restoreResult.unhidden, 'track')} shown again`}
          {restoreResult.failed.length > 0 &&
            `, ${restoreResult.failed.length} could not be restored`}
          .
        </p>
      )}
      {restoreResult && restoreResult.failed.length > 0 && (
        <ul className="analysis-errors">
          {restoreResult.failed.slice(0, 5).map((item) => (
            <li key={item.filename}>
              {item.filename}: {item.message}
            </li>
          ))}
        </ul>
      )}

      {purgeResult && (
        <p className="settings-success" role="status">
          {plural(purgeResult.purged, 'track')} forgotten
          {purgeResult.tagsRemoved > 0 &&
            `, ${plural(purgeResult.tagsRemoved, 'unused tag')} removed`}
          .
        </p>
      )}

      <ConfirmDialog
        open={pending === 'restore'}
        title="Restore all deleted tracks?"
        message={`${plural(count ?? 0, 'track')} will go back to the folder they were deleted from and reappear in the library.`}
        confirmLabel="Restore"
        cancelLabel="Cancel"
        onConfirm={() => run('restore')}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending === 'purge'}
        title="Forget the deleted tracks whose file is gone?"
        message="Deleted tracks whose file can be found neither in _Deleted nor in its original folder are removed from the database for good. Deleted tracks whose file still exists are left alone."
        confirmLabel="Forget them"
        cancelLabel="Cancel"
        onConfirm={() => run('purge')}
        onCancel={() => setPending(null)}
      />
    </>
  )
}
