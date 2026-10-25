import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { errorMessage } from '../../lib/errors'
import { MAX_MIXTAPE_NAME } from '../../shared/mixtape'
import InlineError from '../item/InlineError'
import './SaveMixtapeDialog.css'

type Props = {
  layerCount: number
  onSave: (name: string) => Promise<void>
  onClose: () => void
}

export default function SaveMixtapeDialog({ layerCount, onSave, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
    inputRef.current?.focus()
  }, [])

  const canSave = name.trim() !== '' && !busy

  async function submit() {
    if (!canSave) return
    setBusy(true)
    setError(null)
    try {
      await onSave(name)
      onClose()
    } catch (failure) {
      setError(errorMessage(failure))
      setBusy(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void submit()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog save-mixtape-dialog"
      aria-labelledby="save-mixtape-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <h2 id="save-mixtape-title" className="confirm-dialog-title">
        Save as mixtape
      </h2>
      <p className="confirm-dialog-message">
        {`The ${layerCount} ${layerCount === 1 ? 'layer' : 'layers'} of the mix, with all their settings, are saved in the Mixtapes category of the Library.`}
      </p>

      <label className="save-mixtape-field">
        <span>Name</span>
        <input
          ref={inputRef}
          type="text"
          value={name}
          maxLength={MAX_MIXTAPE_NAME}
          disabled={busy}
          onChange={(event) => {
            setName(event.target.value)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
        />
      </label>

      {error && <InlineError message={error} onDismiss={() => setError(null)} />}

      <div className="confirm-dialog-buttons">
        <button type="button" className="btn" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canSave}
          onClick={() => void submit()}
        >
          Save
        </button>
      </div>
    </dialog>
  )
}
