import { useState } from 'react'
import ConfirmDialog from '../components/item/ConfirmDialog'
import TagBubble from '../components/item/TagBubble'
import TrackItem from '../components/item/TrackItem'
import { useTrackActions } from '../hooks/useTrackActions'
import { useVisibleTracks } from '../hooks/useVisibleTracks'
import { useFilters } from '../store/FilterContext'
import { useLibrary } from '../store/LibraryContext'
import { usePlayer } from '../store/PlayerContext'
import './Home.css'

export default function Home() {
  const [pendingDelete, setPendingDelete] = useState<{ id: number; filename: string } | null>(null)
  const { tags: allTags, categories } = useLibrary()
  const { tagFilters, clearTagFilter } = useFilters()
  const { currentTrack, isPlaying, toggleTrack } = usePlayer()
  const { addTag, createTag, removeTag, setKind, deleteTrack } = useTrackActions()
  const visibleTracks = useVisibleTracks()

  const folderPosition = (categoryId: number | null) =>
    categoryId === null ? categories.length : categories.findIndex((c) => c.id === categoryId)

  const activeFilters = allTags
    .filter((tag) => tagFilters[tag.id] !== undefined)
    .sort((a, b) => folderPosition(a.categoryId) - folderPosition(b.categoryId))

  async function confirmDelete() {
    if (!pendingDelete) return
    const { id } = pendingDelete
    setPendingDelete(null)
    await deleteTrack(id)
  }

  return (
    <div className="track-list">
      {activeFilters.length > 0 && (
        <div className="filter-bar">
          {activeFilters.map((tag) => (
            <TagBubble
              key={tag.id}
              name={tag.name}
              color={categories.find((category) => category.id === tag.categoryId)?.color}
              mode={tagFilters[tag.id]}
              onClick={() => clearTagFilter(tag.id)}
            />
          ))}
        </div>
      )}

      {visibleTracks.length === 0 && <p>No tracks yet.</p>}
      {visibleTracks.map((track) => (
        <TrackItem
          key={track.id}
          filename={track.filename}
          durationSec={track.durationSec}
          peakDb={track.peakDb}
          kind={track.kind}
          tags={track.tags.map((tag) => ({
            id: tag.id,
            name: tag.name,
            color: tag.color ?? undefined
          }))}
          allTags={allTags}
          isPlaying={isPlaying && currentTrack?.id === track.id}
          onPlay={() => toggleTrack({ id: track.id, filename: track.filename })}
          onSetKind={(kind) => setKind(track.id, kind)}
          onDelete={() => setPendingDelete({ id: track.id, filename: track.filename })}
          onRemoveTag={(tagId) => removeTag(track.id, tagId)}
          onAddTag={(tagId) => addTag(track.id, tagId)}
          onCreateTag={(name) => createTag(track.id, name)}
        />
      ))}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this track?"
        message={
          pendingDelete
            ? `${pendingDelete.filename} will be hidden from the library. The file stays on disk.`
            : ''
        }
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
