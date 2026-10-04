import TagBubble from './TagBubble'
import './TrackItem.css'

type TrackTag = {
  id: number
  name: string
  color?: string
}

type Props = {
  filename: string
  durationSec: number
  peakDb: number | null
  tags?: TrackTag[]
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function TrackItem({ filename, durationSec, peakDb, tags = [] }: Props) {
  return (
    <div className="track-item">
      <div className="track-name">{filename}</div>
      <div className="track-meta">
        <span>{formatDuration(durationSec)}</span>
        {peakDb !== null && <span>{peakDb} dB max</span>}
      </div>
      {tags.length > 0 && (
        <div className="track-tags">
          {tags.map((tag) => (
            <TagBubble key={tag.id} name={tag.name} color={tag.color} />
          ))}
        </div>
      )}
    </div>
  )
}
