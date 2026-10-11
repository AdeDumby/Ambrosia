import { useEffect, useRef, useState } from 'react'
import { isFullHex, parseHex } from '../../lib/color'
import './ColorField.css'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
}

export default function ColorField({ label, value, onChange }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  function flash(message: string) {
    window.clearTimeout(timer.current)
    setNote(message)
    timer.current = window.setTimeout(() => setNote(null), 2500)
  }

  function type(text: string) {
    setDraft(text)
    if (isFullHex(text)) {
      const parsed = parseHex(text)
      if (parsed && parsed !== value) onChange(parsed)
    }
  }

  function finish() {
    const parsed = draft === null ? null : parseHex(draft)
    if (parsed && parsed !== value) onChange(parsed)
    setDraft(null)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      flash('Copied')
    } catch {
      flash('Could not copy. Select the text and press Ctrl+C.')
    }
  }

  async function paste() {
    try {
      const parsed = parseHex(await navigator.clipboard.readText())
      if (parsed) {
        if (parsed !== value) onChange(parsed)
        setDraft(null)
      } else {
        flash('The clipboard does not hold a color')
      }
    } catch {
      flash('Could not read the clipboard. Click the box and press Ctrl+V.')
    }
  }

  const invalid = draft !== null && parseHex(draft) === null

  return (
    <div className="color-field">
      <span className="color-field-label">{label}</span>
      <input
        type="color"
        aria-label={`${label}, color picker`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <input
        type="text"
        className={`color-field-hex ${invalid ? 'invalid' : ''}`}
        aria-label={`${label}, hex value`}
        aria-invalid={invalid}
        spellCheck={false}
        maxLength={9}
        value={draft ?? value}
        onChange={(event) => type(event.target.value)}
        onBlur={finish}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          else if (event.key === 'Escape') setDraft(null)
        }}
      />
      <button type="button" className="color-field-button" onClick={copy}>
        Copy
      </button>
      <button type="button" className="color-field-button" onClick={paste}>
        Paste
      </button>
      {note && (
        <span className="color-field-note" role="status">
          {note}
        </span>
      )}
    </div>
  )
}
