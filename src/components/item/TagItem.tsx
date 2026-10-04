import './TagItem.css'

type Props = {
  name: string
  count?: number
  state?: 'include' | 'exclude'
  onClick?: () => void
}

export default function TagItem({ name, count, state, onClick }: Props) {
  const marker = state === 'include' ? '+' : state === 'exclude' ? '−' : ''

  return (
    <button
      type="button"
      className={`tag-item ${state ?? ''}`}
      aria-pressed={state !== undefined}
      onClick={onClick}
    >
      <span className="tag-item-marker" aria-hidden="true">
        {marker}
      </span>
      <span className="tag-item-name">{name}</span>
      {count !== undefined && <span className="tag-item-count">{count}</span>}
    </button>
  )
}
