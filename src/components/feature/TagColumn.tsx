import { useState, type CSSProperties, type KeyboardEvent } from 'react'
import TagChoice from '../item/TagChoice'
import './TagColumn.css'

type ColumnTag = { id: number; name: string }

type Props = {
  name: string
  color: string
  tags: ColumnTag[]
  selectedIds: Set<number>
  onToggle: (tagId: number) => void
  onCreate?: (name: string) => void
}

export default function TagColumn({ name, color, tags, selectedIds, onToggle, onCreate }: Props) {
  const [value, setValue] = useState('')

  function submit() {
    const wanted = value.trim()
    if (wanted === '' || !onCreate) return
    onCreate(wanted)
    setValue('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      submit()
    } else if (event.key === 'Escape') {
      setValue('')
    }
  }

  return (
    <section className="tag-column" style={{ '--column-color': color } as CSSProperties}>
      <h2 className="tag-column-title">{name}</h2>

      <div className="tag-column-list">
        {tags.map((tag) => (
          <TagChoice
            key={tag.id}
            name={tag.name}
            color={color}
            selected={selectedIds.has(tag.id)}
            onClick={() => onToggle(tag.id)}
          />
        ))}
      </div>

      {onCreate && (
        <div className="tag-column-new">
          <input
            type="text"
            value={value}
            placeholder={`+ new ${name} tag`}
            aria-label={`New ${name} tag`}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            aria-label={`Add new ${name} tag`}
            disabled={value.trim() === ''}
            onClick={submit}
          >
            +
          </button>
        </div>
      )}
    </section>
  )
}
