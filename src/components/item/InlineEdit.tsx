import { useEffect, useRef, useState } from 'react'
import { errorMessage } from '../../lib/errors'
import './InlineEdit.css'

type Props = {
  value: string
  onSubmit: (value: string) => Promise<void>
  onCancel: () => void
  maxLength?: number
  caret?: number
  suffix?: string
}

export default function InlineEdit({ value, onSubmit, onCancel, maxLength, caret, suffix }: Props) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const settled = useRef(false)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    const position = Math.min(caret ?? value.length, value.length)
    input.setSelectionRange(position, position)
  }, [caret, value.length])

  async function commit() {
    if (settled.current || busy) return
    const trimmed = draft.trim()
    if (trimmed === value || trimmed === '') {
      settled.current = true
      onCancel()
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(trimmed)
      settled.current = true
    } catch (failure) {
      setError(errorMessage(failure))
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="inline-edit">
      <div className="inline-edit-row">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          maxLength={maxLength}
          disabled={busy}
          aria-label="Edit name"
          aria-invalid={error !== null}
          onChange={(event) => {
            setDraft(event.target.value)
            setError(null)
          }}
          onBlur={() => void commit()}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void commit()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              settled.current = true
              onCancel()
            }
          }}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          onDragStart={(event) => event.preventDefault()}
        />
        {suffix && <span className="inline-edit-suffix">{suffix}</span>}
      </div>
      {error && (
        <p className="inline-edit-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
