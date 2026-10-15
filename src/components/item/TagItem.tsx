import { useEffect, useRef, type MouseEvent } from 'react'
import { MAX_TAG_NAME } from '../../shared/tags'
import InlineEdit from './InlineEdit'
import './TagItem.css'

type Props = {
  name: string
  count?: number
  state?: 'include' | 'exclude'
  editing?: boolean
  onClick?: () => void
  onDoubleClick?: () => void
  onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void
  onSubmitName?: (name: string) => Promise<void>
  onCancelEdit?: () => void
}

const CLICK_DELAY_MS = 250

export default function TagItem({
  name,
  count,
  state,
  editing = false,
  onClick,
  onDoubleClick,
  onContextMenu,
  onSubmitName,
  onCancelEdit
}: Props) {
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  if (editing && onSubmitName && onCancelEdit) {
    return (
      <div className="tag-item editing">
        <InlineEdit
          value={name}
          maxLength={MAX_TAG_NAME}
          onSubmit={onSubmitName}
          onCancel={onCancelEdit}
        />
      </div>
    )
  }

  const marker = state === 'include' ? '+' : state === 'exclude' ? '−' : ''

  return (
    <button
      type="button"
      className={`tag-item ${state ?? ''}`}
      aria-pressed={state !== undefined}
      onClick={() => {
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => onClick?.(), CLICK_DELAY_MS)
      }}
      onDoubleClick={() => {
        window.clearTimeout(timer.current)
        onDoubleClick?.()
      }}
      onContextMenu={onContextMenu}
    >
      <span className="tag-item-marker" aria-hidden="true">
        {marker}
      </span>
      <span className="tag-item-name">{name}</span>
      {count !== undefined && <span className="tag-item-count">{count}</span>}
    </button>
  )
}
