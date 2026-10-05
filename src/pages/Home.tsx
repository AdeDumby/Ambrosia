import { useState } from 'react'
import type { TrackKind } from '../shared/types'
import ConfirmDialog from '../components/item/ConfirmDialog'
import TagBubble from '../components/item/TagBubble'
import TrackItem from '../components/item/TrackItem'
import { useVisibleTracks } from '../hooks/useVisibleTracks'
import { useFilters } from '../store/FilterContext'
import { useLibrary } from '../store/LibraryContext'
import { usePlayer } from '../store/PlayerContext'
import './Home.css'

export default function Home() {
  const [pendingDelete, setPendingDelete] = useState<{ id: number; filename: string } | null>(null)
  const { tags: allTags, categories, setTracks, refreshTags } = useLibrary()
  const { tagFilters, clearTagFilter } = useFilters()
  const { currentTrack, isPlaying, toggleTrack, stop } = usePlayer()
  const visibleTracks = useVisibleTracks()

  const folderPosition = (categoryId: number | null) =>
    categoryId === null ? categories.length : categories.findIndex((c) => c.id === categoryId)

  const activeFilters = allTags
    .filter((tag) => tagFilters[tag.id] !== undefined)
    .sort((a, b) => folderPosition(a.categoryId) - folderPosition(b.categoryId))

  async function reloadTrack(trackId: number) {
    const updated = await window.api.getTrack(trackId)
    if (!updated) return
    setTracks((previous) => previous.map((track) => (track.id === trackId ? updated : track)))
  }

  async function addTag(trackId: number, tagId: number) {
    await window.api.tagTrack(trackId, tagId)
    await reloadTrack(trackId)
  }

  async function createTag(trackId: number, name: string) {
    const created = await window.api.addTagToTrackByName(trackId, name)
    await reloadTrack(trackId)
    if (created) await refreshTags()
  }

  async function removeTag(trackId: number, tagId: number) {
    const tagDeleted = await window.api.untagTrack(trackId, tagId)
    setTracks((previous) =>
      previous.map((track) =>
        track.id === trackId
          ? { ...track, tags: track.tags.filter((tag) => tag.id !== tagId) }
          : track
      )
    )
    if (tagDeleted) await refreshTags()
  }

  async function setKind(trackId: number, kind: TrackKind) {
    await window.api.setTrackKind(trackId, kind)
    setTracks((previous) =>
      previous.map((track) => (track.id === trackId ? { ...track, kind } : track))
    )
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const { id } = pendingDelete
    setPendingDelete(null)
    await window.api.deleteTrack(id)
    if (currentTrack?.id === id) stop()
    setTracks((previous) => previous.filter((track) => track.id !== id))
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
