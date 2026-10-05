import TagBubble from './TagBubble'
import TagInput, { type TagOption } from './TagInput'
import TrackActions from './TrackActions'
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
  allTags?: TagOption[]
  isPlaying?: boolean
  onPlay?: () => void
  onRemoveTag?: (tagId: number) => void
  onAddTag?: (tagId: number) => void
  onCreateTag?: (name: string) => void
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function TrackItem({
  filename,
  durationSec,
  peakDb,
  tags = [],
  allTags = [],
  isPlaying = false,
  onPlay,
  onRemoveTag,
  onAddTag,
  onCreateTag
}: Props) {
  const ownedIds = new Set(tags.map((tag) => tag.id))
  const availableTags = allTags.filter((tag) => !ownedIds.has(tag.id))

  return (
    <div className="track-item">
      <div className="track-main">
        <div className="track-name">{filename}</div>
        <div className="track-meta">
          <span>{formatDuration(durationSec)}</span>
          {peakDb !== null && <span>{peakDb} dB max</span>}
        </div>
        {(tags.length > 0 || onAddTag) && (
          <div className="track-tags">
            {tags.map((tag) => (
              <TagBubble
                key={tag.id}
                name={tag.name}
                color={tag.color}
                onRemove={onRemoveTag ? () => onRemoveTag(tag.id) : undefined}
              />
            ))}
            {onAddTag && (
              <TagInput options={availableTags} onAdd={onAddTag} onCreate={onCreateTag} />
            )}
          </div>
        )}
      </div>
      {onPlay && <TrackActions isPlaying={isPlaying} onPlay={onPlay} />}
    </div>
  )
}
