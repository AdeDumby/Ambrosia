import './FolderItem.css'

type Props = {
  name: string
  color: string
}

export default function FolderItem({ name, color }: Props) {
  return (
    <div className="folder-item">
      <span className="folder-dot" style={{ backgroundColor: color }} />
      <span className="folder-name">{name}</span>
    </div>
  )
}
