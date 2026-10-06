import { useEffect, useMemo, useState } from 'react'
import ConfirmDialog from '../components/item/ConfirmDialog'
import TrackItem from '../components/item/TrackItem'
import { useTrackActions } from '../hooks/useTrackActions'
import { useLibrary } from '../store/LibraryContext'
import { usePlayer } from '../store/PlayerContext'
import './Review.css'

function shuffleKey(id: number, seed: number): number {
  let hash = (id ^ seed) >>> 0
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b)
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b)
  return (hash ^ (hash >>> 16)) >>> 0
}

export default function Review() {
  const { tracks, tags: allTags } = useLibrary()
  const { currentTrack, isPlaying, toggleTrack, playTrack } = usePlayer()
  const { addTag, createTag, removeTag, setReviewed, deleteTrack } = useTrackActions()
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 32))
  const [confirmingDelete, setConfirmingDelete] = useState(false)

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

  async function finish() {
    if (current) await setReviewed(current.id, true)
  }

  async function confirmDelete() {
    setConfirmingDelete(false)
    if (current) await deleteTrack(current.id)
  }

  if (!current) {
    return (
      <div className="review">
        <p>Nothing left to review.</p>
      </div>
    )
  }

  return (
    <div className="review">
      <p className="review-left">{queue.length} left to review</p>

      <TrackItem
        key={current.id}
        filename={current.filename}
        durationSec={current.durationSec}
        peakDb={current.peakDb}
        tags={current.tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color ?? undefined
        }))}
        allTags={allTags}
        isPlaying={isPlaying && currentTrack?.id === current.id}
        onPlay={() => toggleTrack({ id: current.id, filename: current.filename })}
        onFinish={finish}
        onDelete={() => setConfirmingDelete(true)}
        onRemoveTag={(tagId) => removeTag(current.id, tagId)}
        onAddTag={(tagId) => addTag(current.id, tagId)}
        onCreateTag={(name) => createTag(current.id, name)}
      />

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this track?"
        message={`${current.filename} will be hidden from the library. The file stays on disk.`}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  )
}
