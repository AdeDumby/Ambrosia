import { useRef } from 'react'
import './SearchField.css'

type Props = {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
}

export default function SearchField({ value, onChange, label, placeholder }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="search-field">
      <input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onChange('')
        }}
      />
      {value !== '' && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}
