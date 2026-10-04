import type { CSSProperties } from 'react'
import './TagBubble.css'

type Props = {
  name: string
  color?: string
  mode?: 'include' | 'exclude'
  onRemove?: () => void
  onClick?: () => void
}

export default function TagBubble({ name, color = '#888888', mode, onRemove, onClick }: Props) {
  const style = { '--tag-color': color } as CSSProperties
  const className = ['tag-bubble', mode, onClick ? 'clickable' : ''].filter(Boolean).join(' ')

  const content = (
    <>
      {mode && (
        <span className="tag-bubble-mode" aria-hidden="true">
          {mode === 'include' ? '+' : '−'}
        </span>
      )}
      <span className="tag-bubble-name">{name}</span>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        style={style}
        title="Click to clear this filter"
        aria-label={`Clear filter ${name}`}
        onClick={onClick}
      >
        {content}
      </button>
    )
  }

  return (
    <span className={className} style={style}>
      {content}
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
