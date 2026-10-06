import type { CSSProperties } from 'react'
import './TagChoice.css'

type Props = {
  name: string
  color?: string
  selected?: boolean
  onClick: () => void
}

export default function TagChoice({ name, color = '#888888', selected = false, onClick }: Props) {
  return (
    <button
      type="button"
      className={`tag-choice ${selected ? 'selected' : ''}`}
      style={{ '--choice-color': color } as CSSProperties}
      aria-pressed={selected}
      onClick={onClick}
    >
      {name}
    </button>
  )
}
