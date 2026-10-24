import { useEffect, useState } from 'react'
import { errorMessage } from '../../lib/errors'
import type { EmptyDeletedResult, RestoreResult } from '../../shared/types'
import { useLibrary } from '../../store/LibraryContext'
import { useScanRun } from '../../store/ScanRunContext'
import ConfirmDialog from '../item/ConfirmDialog'

type Pending = 'restore' | 'delete' | null
type Outcome = { ok: boolean; text: string; details: string[] }

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

function describeRestore(result: RestoreResult): Outcome {
  const parts = [`${plural(result.restored, 'track')} restored`]
  if (result.unhidden > 0) parts.push(`${plural(result.unhidden, 'track')} shown again`)
  if (result.failed.length > 0) parts.push(`${result.failed.length} could not be restored`)
  return {
    ok: result.failed.length === 0,
    text: `${parts.join(', ')}.`,
    details: result.failed.slice(0, 5).map((item) => `${item.filename}: ${item.message}`)
  }
}

function describeErase(result: EmptyDeletedResult): Outcome {
  const parts = [`${plural(result.erased, 'file')} erased`]
  if (result.failed.length > 0) parts.push(`${result.failed.length} could not be erased`)
  return {
    ok: result.failed.length === 0,
    text: `${parts.join(', ')}.`,
    details: result.failed.slice(0, 5).map((item) => `${item.filename}: ${item.message}`)
  }
}

export default function DeletedFolderPanel() {
  const { refreshTracks, refreshTags } = useLibrary()
  const { busy } = useScanRun()
  const [count, setCount] = useState(0)
  const [pending, setPending] = useState<Pending>(null)
  const [working, setWorking] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  useEffect(() => {
    window.api
      .countDeletedTracks()
      .then(setCount)
      .catch(() => setCount(0))
  }, [])

  async function run(action: 'restore' | 'delete') {
    setPending(null)
    setOutcome(null)
    setWorking(true)
    try {
      setOutcome(
        action === 'restore'
          ? describeRestore(await window.api.restoreDeletedTracks())
          : describeErase(await window.api.emptyDeletedFolder())
      )
      await Promise.all([refreshTracks(), refreshTags()])
      setCount(await window.api.countDeletedTracks())
    } catch (failure) {
      setOutcome({ ok: false, text: errorMessage(failure), details: [] })
    } finally {
      setWorking(false)
    }
  }

  const disabled = busy || working || count === 0

  return (
    <>
      <div className="settings-actions">
        <button
          type="button"
          className="btn"
          disabled={disabled}
          onClick={() => setPending('delete')}
        >
          Delete All in _Deleted
        </button>
        <button
          type="button"
          className="btn"
          disabled={disabled}
          onClick={() => setPending('restore')}
        >
          Restore All in _Deleted
        </button>
      </div>

      {outcome && (
        <p className={outcome.ok ? 'settings-success' : 'settings-error'} role="status">
          {outcome.text}
        </p>
      )}
      {outcome && outcome.details.length > 0 && (
        <ul className="analysis-errors">
          {outcome.details.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pending === 'delete'}
        title="Delete everything in _Deleted?"
        message="The files are erased from the disk and cannot be recovered."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => void run('delete')}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending === 'restore'}
        title="Restore all deleted tracks?"
        message="Every deleted track goes back to the folder it was deleted from."
        confirmLabel="Restore"
        cancelLabel="Cancel"
        onConfirm={() => void run('restore')}
        onCancel={() => setPending(null)}
      />
    </>
  )
}
