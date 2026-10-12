import { useEffect, useMemo, useState, useRef } from 'react'
import ConfirmDialog from '../components/item/ConfirmDialog'
import InlineError from '../components/item/InlineError'
import TrackItem from '../components/item/TrackItem'
import TagColumn from '../components/feature/TagColumn'
import { useTrackActions } from '../hooks/useTrackActions'
import { deleteDialogText } from '../lib/deleteDialog'
import { useLibrary } from '../store/LibraryContext'
import { usePlayer } from '../store/PlayerContext'
import { useSettings } from '../store/SettingsContext'
import './Review.css'

function shuffleKey(id: number, seed: number): number {
  let hash = (id ^ seed) >>> 0
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b)
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b)
  return (hash ^ (hash >>> 16)) >>> 0
}

export default function Review() {
  const { tracks, tags: allTags, categories } = useLibrary()
  const { currentTrack, isPlaying, toggleTrack, playTrack } = usePlayer()
  const { settings } = useSettings()
  const { addTag, createTag, removeTag, setReviewed, deleteTrack, renameTrack } = useTrackActions()
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 32))
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const queue = useMemo(
    () =>
      tracks
        .filter((track) => !track.reviewed)
        .sort((a, b) => shuffleKey(a.id, seed) - shuffleKey(b.id, seed) || a.id - b.id),
    [tracks, seed]
  )
  const current = queue[0] ?? null

  const currentId = current?.id
  const currentName = current?.filename
  useEffect(() => {
    if (currentId === undefined || currentName === undefined) return
    playTrack({ id: currentId, filename: currentName })
  }, [currentId, currentName, playTrack])

  const lastFinish = useRef(0)
  async function finish() {
    const now = Date.now()
    if (!current || now - lastFinish.current < 500) return
    lastFinish.current = now
    await setReviewed(current.id, true)
  }

  async function confirmDelete() {
    setConfirmingDelete(false)
    if (!current) return
    setDeleteError(null)
    try {
      await deleteTrack(current.id)
    } catch (error) {
      console.error(error)
      setDeleteError(
        `Could not delete ${current.filename}. The file may be in use or its folder may be read-only.`
      )
    }
  }

  if (!current) {
    return (
      <div className="review">
        <p>Nothing left to review.</p>
      </div>
    )
  }

  const selectedIds = new Set(current.tags.map((tag) => tag.id))

  function toggleTag(tagId: number) {
    if (!current) return
    if (selectedIds.has(tagId)) void removeTag(current.id, tagId)
    else void addTag(current.id, tagId)
  }

  const hiddenFolders = new Set(settings.review.hiddenFolders.map((name) => name.toLowerCase()))
  const columns = categories
    .filter((category) => !hiddenFolders.has(category.name.toLowerCase()))
    .map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      tags: allTags.filter((tag) => tag.categoryId === category.id)
    }))
  const ungrouped = allTags.filter((tag) => tag.categoryId === null)
  const dialog = deleteDialogText(settings.library.deleteMode, current.filename)

  return (
    <div className="review">
      <p className="review-left">{queue.length} left to review</p>

      {deleteError && <InlineError message={deleteError} onDismiss={() => setDeleteError(null)} />}

      <TrackItem
        key={current.id}
        id={current.id}
        filename={current.filename}
        durationSec={current.durationSec}
        peakDb={current.peakDb}
        tags={current.tags}
        allTags={allTags}
        isPlaying={isPlaying && currentTrack?.id === current.id}
        onPlay={(id, filename) => toggleTrack({ id, filename })}
        onFinish={finish}
        onDelete={() => setConfirmingDelete(true)}
        onRemoveTag={removeTag}
        onAddTag={addTag}
        onCreateTag={createTag}
        onRename={renameTrack}
      />

      <div className="review-columns">
        {columns.map((column) => (
          <TagColumn
            key={column.id}
            name={column.name}
            color={column.color}
            tags={column.tags}
            selectedIds={selectedIds}
            onToggle={toggleTag}
            onCreate={(name) => createTag(current.id, name, column.id)}
          />
        ))}
        {ungrouped.length > 0 && (
          <TagColumn
            name="Ungrouped"
            color="#888888"
            tags={ungrouped}
            selectedIds={selectedIds}
            onToggle={toggleTag}
          />
        )}
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title={dialog.title}
        message={dialog.message}
        confirmLabel={dialog.confirmLabel}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  )
}
