import './TagItem.css'

type Props = {
  name: string
  count?: number
}

export default function TagItem({ name, count }: Props) {
  return (
    <div className="tag-item">
      <span>{name}</span>
      {count !== undefined && <span className="tag-item-count">{count}</span>}
    </div>
  )
}
