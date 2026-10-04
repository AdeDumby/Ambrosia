import type { ReactNode } from 'react'
import './FolderItem.css'

type Props = {
  name: string
  color: string
  children?: ReactNode
}

export default function FolderItem({ name, color, children }: Props) {
  return (
    <div>
      <div className="folder-item">
        <span className="folder-dot" style={{ backgroundColor: color }} />
        <span className="folder-name">{name}</span>
      </div>
      {children}
    </div>
  )
}
