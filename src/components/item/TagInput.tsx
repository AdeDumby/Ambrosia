import { useState, type KeyboardEvent } from 'react'
import { foldText } from '../../shared/tags'
import './TagInput.css'

export type TagOption = { id: number; name: string }

type Props = {
  getOptions: () => TagOption[]
  onAdd: (tagId: number) => void
  onCreate?: (name: string) => void
}

const MIN_CHARS = 3

export default function TagInput({ getOptions, onAdd, onCreate }: Props) {
  const [value, setValue] = useState('')

  const typed = foldText(value)
  const suggestion =
    value.length >= MIN_CHARS
      ? getOptions().find((option) => foldText(option.name).startsWith(typed))
      : undefined
  const remainder = suggestion ? suggestion.name.slice(value.length) : ''

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Tab' && suggestion && remainder) {
      event.preventDefault()
      setValue(suggestion.name)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const wanted = value.trim()
      if (wanted === '') return

      const exact = getOptions().find((option) => foldText(option.name) === foldText(wanted))
      if (exact) {
        onAdd(exact.id)
      } else if (onCreate) {
        onCreate(wanted)
      } else {
        return
      }
      setValue('')
    } else if (event.key === 'Escape') {
      setValue('')
    }
  }

  return (
    <span className="tag-input">
      <span className="tag-input-ghost" aria-hidden="true">
        <span className="tag-input-typed">{value}</span>
        {remainder}
      </span>
      <input
        className="tag-input-field"
        type="text"
        size={1}
        value={value}
        placeholder="+ tag"
        aria-label="Add a tag"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
      />
    </span>
  )
}
