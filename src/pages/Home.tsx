import { useEffect, useState } from 'react'
import type { Track } from '../shared/types'
import TrackItem from '../components/item/TrackItem'
import type { TagOption } from '../components/item/TagInput'
import { useFilters } from '../store/FilterContext'
import './Home.css'

export default function Home() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [allTags, setAllTags] = useState<TagOption[]>([])
  const { typeFilter, unreviewedOnly } = useFilters()

  useEffect(() => {
    window.api.listTracks().then(setTracks)
    window.api.listTags().then(setAllTags)
  }, [])

  const visibleTracks = tracks.filter(
    (track) =>
      (typeFilter === 'all' || track.kind === typeFilter) && (!unreviewedOnly || !track.reviewed)
  )

  async function removeTag(trackId: number, tagId: number) {
    await window.api.untagTrack(trackId, tagId)
    setTracks((previous) =>
      previous.map((track) =>
        track.id === trackId
          ? { ...track, tags: track.tags.filter((tag) => tag.id !== tagId) }
          : track
      )
    )
  }

  async function addTag(trackId: number, tagId: number) {
    await window.api.tagTrack(trackId, tagId)
    const updated = await window.api.getTrack(trackId)
    if (!updated) return
    setTracks((previous) => previous.map((track) => (track.id === trackId ? updated : track)))
  }

  return (
    <div className="track-list">
      {visibleTracks.length === 0 && <p>No tracks yet.</p>}
      {visibleTracks.map((track) => (
        <TrackItem
          key={track.id}
          filename={track.filename}
          durationSec={track.durationSec}
          peakDb={track.peakDb}
          tags={track.tags.map((tag) => ({
            id: tag.id,
            name: tag.name,
            color: tag.color ?? undefined
          }))}
          allTags={allTags}
          onRemoveTag={(tagId) => removeTag(track.id, tagId)}
          onAddTag={(tagId) => addTag(track.id, tagId)}
        />
      ))}
    </div>
  )
}
