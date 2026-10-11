import { errorMessage } from '../../lib/errors'
import { useState } from 'react'
import './AddField.css'

type Props = {
  label: string
  placeholder: string
  onSubmit: (value: string) => Promise<void>
}

export default function AddField({ label, placeholder, onSubmit }: Props) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    const wanted = value.trim()
    if (wanted === '' || busy) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit(wanted)
      setValue('')
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="add-field">
      <div className="add-field-row">
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          aria-label={label}
          disabled={busy}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void submit()
            } else if (event.key === 'Escape') {
              setValue('')
              setError(null)
            }
          }}
        />
        <button
          type="button"
          aria-label={label}
          disabled={busy || value.trim() === ''}
          onClick={() => void submit()}
        >
          +
        </button>
      </div>
      {error && (
        <p className="add-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
