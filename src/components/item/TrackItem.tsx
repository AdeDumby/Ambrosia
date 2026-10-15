import { memo, useState, type MouseEvent } from 'react'
import { textOffsetAt } from '../../lib/caret'
import { formatDuration } from '../../lib/formatDuration'
import { MAX_FILE_STEM, splitFileName } from '../../shared/files'
import type { TrackKind, TrackTag } from '../../shared/types'
import InlineEdit from './InlineEdit'
import TagBubble from './TagBubble'
import TagInput, { type TagOption } from './TagInput'
import TrackActions from './TrackActions'
import './TrackItem.css'

type Props = {
  id: number
  filename: string
  durationSec: number
  peakDb: number | null
  kind?: TrackKind
  tags: TrackTag[]
  getTagOptions: () => TagOption[]
  isPlaying: boolean
  onPlay?: (id: number, filename: string) => void
  onRename?: (id: number, name: string) => Promise<void>
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
  getTagOptions,
  isPlaying,
  onPlay,
  onRename,
  onSetKind,
  onFinish,
  onDelete,
  onRemoveTag,
  onAddTag,
  onCreateTag
}: Props) {
  const [caret, setCaret] = useState<number | null>(null)
  const { stem, ext } = splitFileName(filename)
  const ownedIds = new Set(tags.map((tag) => tag.id))

  function startEdit(event: MouseEvent<HTMLDivElement>) {
    const offset = textOffsetAt(event.currentTarget, event.clientX, event.clientY)
    setCaret(Math.min(offset, stem.length))
  }

  return (
    <div className="track-item">
      <div className="track-main">
        {caret !== null && onRename ? (
          <InlineEdit
            value={stem}
            suffix={ext}
            caret={caret}
            maxLength={MAX_FILE_STEM}
            onSubmit={async (next) => {
              await onRename(id, next)
              setCaret(null)
            }}
            onCancel={() => setCaret(null)}
          />
        ) : (
          <div
            className="track-name"
            onMouseDown={
              onRename
                ? (event) => {
                    if (event.detail > 1) event.preventDefault()
                  }
                : undefined
            }
            onDoubleClick={onRename ? startEdit : undefined}
          >
            {filename}
          </div>
        )}
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
                getOptions={() => getTagOptions().filter((tag) => !ownedIds.has(tag.id))}
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
