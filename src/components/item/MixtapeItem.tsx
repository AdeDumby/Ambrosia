import { memo, useState, type MouseEvent } from 'react'
import { textOffsetAt } from '../../lib/caret'
import { MAX_MIXTAPE_NAME, type Mixtape } from '../../shared/mixtape'
import InlineEdit from './InlineEdit'
import TagBubble from './TagBubble'
import TagInput, { type TagOption } from './TagInput'
import TrackActions from './TrackActions'
import './TrackItem.css'

type Props = {
  mixtape: Mixtape
  getTagOptions: () => TagOption[]
  isPlaying: boolean
  onPlay: (mixtape: Mixtape) => void
  onRename: (id: number, name: string) => Promise<void>
  onDelete: (id: number, name: string) => void
  onRemoveTag: (id: number, tagId: number) => void
  onAddTag: (id: number, tagId: number) => void
  onCreateTag: (id: number, name: string) => void
}

/** SQLite stores the date in UTC, as "2026-10-25 10:00:00". */
function savedOn(createdAt: string): string {
  const date = new Date(`${createdAt.replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString()
}

function MixtapeItem({
  mixtape,
  getTagOptions,
  isPlaying,
  onPlay,
  onRename,
  onDelete,
  onRemoveTag,
  onAddTag,
  onCreateTag
}: Props) {
  const [caret, setCaret] = useState<number | null>(null)
  const { id, name, layers, tags } = mixtape
  const ownedIds = new Set(tags.map((tag) => tag.id))
  const date = savedOn(mixtape.createdAt)

  function startEdit(event: MouseEvent<HTMLDivElement>) {
    const offset = textOffsetAt(event.currentTarget, event.clientX, event.clientY)
    setCaret(Math.min(offset, name.length))
  }

  return (
    <div className="track-item mixtape-item">
      <div className="track-main">
        {caret !== null ? (
          <InlineEdit
            value={name}
            caret={caret}
            maxLength={MAX_MIXTAPE_NAME}
            onSubmit={async (next) => {
              await onRename(id, next)
              setCaret(null)
            }}
            onCancel={() => setCaret(null)}
          />
        ) : (
          <div
            className="track-name"
            onMouseDown={(event) => {
              if (event.detail > 1) event.preventDefault()
            }}
            onDoubleClick={startEdit}
          >
            {name}
          </div>
        )}
        <div className="track-meta">
          <span>{`${layers.length} ${layers.length === 1 ? 'layer' : 'layers'}`}</span>
          {date !== '' && <span>{`Saved ${date}`}</span>}
        </div>
        <div className="track-tags">
          {tags.map((tag) => (
            <TagBubble
              key={tag.id}
              name={tag.name}
              color={tag.color ?? undefined}
              onRemove={() => onRemoveTag(id, tag.id)}
            />
          ))}
          <TagInput
            getOptions={() => getTagOptions().filter((tag) => !ownedIds.has(tag.id))}
            onAdd={(tagId) => onAddTag(id, tagId)}
            onCreate={(tagName) => onCreateTag(id, tagName)}
          />
        </div>
      </div>
      <TrackActions
        isPlaying={isPlaying}
        onPlay={() => onPlay(mixtape)}
        onDelete={() => onDelete(id, name)}
        deleteLabel="Delete mixtape"
      />
    </div>
  )
}

export default memo(MixtapeItem)
