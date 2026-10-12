import type { MouseEvent } from 'react'
import { useRef } from 'react'
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
  const marker = state === 'include' ? '+' : state === 'exclude' ? '−' : ''

  const timer = useRef<number | undefined>(undefined)

  function handleClick() {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onClick?.(), 250)
  }

  function handleDoubleClick() {
    window.clearTimeout(timer.current)
    onDoubleClick?.()
  }

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

  return (
    <button
      type="button"
      className={`tag-item ${state ?? ''}`}
      aria-pressed={state !== undefined}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
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
