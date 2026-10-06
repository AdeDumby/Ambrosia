import { memo } from 'react'
import type { TrackKind } from '../../shared/types'
import { formatDuration } from '../../lib/formatDuration'
import TagBubble from './TagBubble'
import TagInput, { type TagOption } from './TagInput'
import TrackActions from './TrackActions'
import './TrackItem.css'

type TrackTag = {
  id: number
  name: string
  color: string | null
}

type Props = {
  id: number
  filename: string
  durationSec: number
  peakDb: number | null
  kind?: TrackKind
  tags: TrackTag[]
  allTags: TagOption[]
  isPlaying: boolean
  onPlay?: (id: number, filename: string) => void
  onSetKind?: (id: number, kind: TrackKind) => void
  onFinish?: (id: number) => void
  onDelete?: (id: number, filename: string) => void
  onRemoveTag?: (id: number, tagId: number) => void
  onAddTag?: (id: number, tagId: number) => void
  onCreateTag?: (id: number, name: string) => void
}

function TrackItem({
  id,
  filename,
  durationSec,
  peakDb,
  kind,
  tags,
  allTags,
  isPlaying,
  onPlay,
  onSetKind,
  onFinish,
  onDelete,
  onRemoveTag,
  onAddTag,
  onCreateTag
}: Props) {
  const ownedIds = new Set(tags.map((tag) => tag.id))
  const availableTags = allTags.filter((tag) => !ownedIds.has(tag.id))
  console.log('row', filename)
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
                color={tag.color ?? undefined}
                onRemove={onRemoveTag ? () => onRemoveTag(id, tag.id) : undefined}
              />
            ))}
            {onAddTag && (
              <TagInput
                options={availableTags}
                onAdd={(tagId) => onAddTag(id, tagId)}
                onCreate={onCreateTag ? (name) => onCreateTag(id, name) : undefined}
              />
            )}
          </div>
        )}
      </div>
      {onPlay && (
        <TrackActions
          isPlaying={isPlaying}
          onPlay={() => onPlay(id, filename)}
          kind={kind}
          onSetKind={onSetKind ? (next) => onSetKind(id, next) : undefined}
          onFinish={onFinish ? () => onFinish(id) : undefined}
          onDelete={onDelete ? () => onDelete(id, filename) : undefined}
        />
      )}
    </div>
  )
}

export default memo(TrackItem)
