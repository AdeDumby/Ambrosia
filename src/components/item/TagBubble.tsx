import type { CSSProperties } from 'react'
import './TagBubble.css'

type Props = {
  name: string
  color?: string
  onRemove?: () => void
}

export default function TagBubble({ name, color = '#888888', onRemove }: Props) {
  return (
    <span className="tag-bubble" style={{ '--tag-color': color } as CSSProperties}>
      <span className="tag-bubble-name">{name}</span>
      {onRemove && (
        <button
          type="button"
          className="tag-bubble-remove"
          aria-label={`Remove tag ${name}`}
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </span>
  )
}
