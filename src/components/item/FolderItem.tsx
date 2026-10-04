import type { DragEvent, ReactNode } from 'react'
import './FolderItem.css'

type Props = {
  name: string
  color: string
  children?: ReactNode
  draggable?: boolean
  isDragging?: boolean
  dropIndicator?: 'before' | 'after' | null
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
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="folder-item">
        {draggable && (
          <span className="folder-grip" aria-hidden="true">
            ⋮⋮
          </span>
        )}
        <span className="folder-dot" style={{ backgroundColor: color }} />
        <span className="folder-name">{name}</span>
      </div>
      {children}
    </div>
  )
}
