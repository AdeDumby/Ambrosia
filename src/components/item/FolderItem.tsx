import type { DragEvent, MouseEvent, ReactNode } from 'react'
import InlineEdit from './InlineEdit'
import './FolderItem.css'

type Props = {
  name: string
  color: string
  children?: ReactNode
  draggable?: boolean
  isDragging?: boolean
  dropIndicator?: 'before' | 'after' | null
  editing?: boolean
  maxNameLength?: number
  onStartEdit?: () => void
  onSubmitName?: (name: string) => Promise<void>
  onCancelEdit?: () => void
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void
  onDrop?: (event: DragEvent<HTMLDivElement>) => void
  onDragEnd?: (event: DragEvent<HTMLDivElement>) => void
}

export default function FolderItem({
  name,
  color,
  children,
  draggable = false,
  isDragging = false,
  dropIndicator = null,
  editing = false,
  maxNameLength,
  onStartEdit,
  onSubmitName,
  onCancelEdit,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd
}: Props) {
  const classes = ['folder-block']
  if (isDragging) classes.push('dragging')
  if (dropIndicator) classes.push(`drop-${dropIndicator}`)

  return (
    <div
      className={classes.join(' ')}
      draggable={draggable && !editing}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="folder-item" onContextMenu={onContextMenu} onDoubleClick={onStartEdit}>
        {draggable && !editing && (
          <span className="folder-grip" aria-hidden="true">
            ⋮⋮
          </span>
        )}
        <span className="folder-dot" style={{ backgroundColor: color }} />
        {editing && onSubmitName && onCancelEdit ? (
          <InlineEdit
            value={name}
            maxLength={maxNameLength}
            onSubmit={onSubmitName}
            onCancel={onCancelEdit}
          />
        ) : (
          <span className="folder-name">{name}</span>
        )}
      </div>
      {children}
    </div>
  )
}
