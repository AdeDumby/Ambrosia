import { useCallback, useEffect, useState } from 'react'
import { errorMessage } from '../../lib/errors'
import type { BackupEntry, ImportPreview } from '../../shared/types'
import { useScanRun } from '../../store/ScanRunContext'
import ConfirmDialog from '../item/ConfirmDialog'
import SettingsSection from '../item/SettingsSection'

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function size(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

type Pending =
  { kind: 'entry'; entry: BackupEntry } | { kind: 'file'; preview: ImportPreview } | null

export default function BackupSettings() {
  const { busy } = useScanRun()
  const [entries, setEntries] = useState<BackupEntry[]>([])
  const [working, setWorking] = useState(false)
  const [pending, setPending] = useState<Pending>(null)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setEntries(await window.api.listBackups())
    } catch {
      setEntries([])
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function run(action: () => Promise<void>) {
    setError(null)
    setNote(null)
    setWorking(true)
    try {
      await action()
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setWorking(false)
      void reload()
    }
  }

  async function backUp() {
    await run(async () => {
      const file = await window.api.backupNow()
      setNote(`Saved to ${file}`)
    })
  }

  async function chooseFile() {
    await run(async () => {
      const preview = await window.api.chooseBackupFile()
      if (preview) setPending({ kind: 'file', preview })
    })
  }

  async function confirmRestore() {
    const target = pending
    setPending(null)
    if (!target) return
    setError(null)
    setWorking(true)
    try {
      await window.api.restoreBackup(target.kind === 'entry' ? target.entry.path : null)
      window.location.reload()
    } catch (failure) {
      setError(errorMessage(failure))
      setWorking(false)
    }
  }

  const disabled = busy || working

  return (
    <SettingsSection
      title="Backups"
      description="A copy of your library database (tracks, tags, folders and settings, not the music files) is made automatically once a day and before risky actions. The newest 10 automatic copies are kept. Backups you make yourself go to your Downloads folder."
    >
      <div className="settings-row">
        <span>Back up now</span>
        <div className="settings-actions">
          <button type="button" className="btn" disabled={disabled} onClick={() => void backUp()}>
            Back up now
          </button>
          <button
            type="button"
            className="btn"
            disabled={disabled}
            onClick={() => void run(() => window.api.openBackupFolder())}
          >
            Open folder
          </button>
          <button
            type="button"
            className="btn"
            disabled={disabled}
            onClick={() => void chooseFile()}
          >
            Restore from file...
          </button>
        </div>
      </div>

      {note && (
        <p className="settings-success" role="status">
          {note}
        </p>
      )}
      {error && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}

      {entries.length === 0 ? (
        <p className="settings-hint">No backups yet.</p>
      ) : (
        <ul className="backup-list">
          {entries.map((entry) => (
            <li key={entry.path} className="backup-row">
              <span className="backup-name" title={entry.path}>
                {entry.name}
              </span>
              <span className="backup-meta">
                {entry.manual ? 'Manual' : 'Automatic'} ·{' '}
                {new Date(entry.modified).toLocaleString()} · {size(entry.bytes)}
              </span>
              <button
                type="button"
                className="btn"
                disabled={disabled}
                onClick={() => setPending({ kind: 'entry', entry })}
              >
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pending !== null}
        title="Restore this backup?"
        message={
          pending
            ? `${pending.kind === 'entry' ? pending.entry.name : pending.preview.fileName}${
                pending.kind === 'file'
                  ? ` holds ${plural(pending.preview.tracks, 'track')}, ${plural(pending.preview.tags, 'tag')} and ${plural(pending.preview.folders, 'folder')}.`
                  : '.'
              } It replaces everything in your current library. A safety copy of the current library is made first, so you can undo this from the list. The library folder location is kept.`
            : ''
        }
        confirmLabel="Restore"
        cancelLabel="Cancel"
        onConfirm={() => void confirmRestore()}
        onCancel={() => setPending(null)}
      />
    </SettingsSection>
  )
}
