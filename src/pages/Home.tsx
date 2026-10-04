import { useEffect, useState } from 'react'
import type { Track } from '../shared/types'
import TrackItem from '../components/item/TrackItem'
import { useFilters } from '../store/FilterContext'
import { useLibrary } from '../store/LibraryContext'
import './Home.css'

export default function Home() {
  const [tracks, setTracks] = useState<Track[]>([])
  const { tags: allTags, refreshTags } = useLibrary()
  const { typeFilter, unreviewedOnly, matchMode, tagFilters } = useFilters()

  useEffect(() => {
    window.api.listTracks().then(setTracks)
  }, [])

  const knownTagIds = new Set(allTags.map((tag) => tag.id))
  const includedIds: number[] = []
  const excludedIds: number[] = []
  for (const [id, state] of Object.entries(tagFilters)) {
    const tagId = Number(id)
    if (!knownTagIds.has(tagId)) continue
    if (state === 'include') includedIds.push(tagId)
    else excludedIds.push(tagId)
  }

  const visibleTracks = tracks.filter((track) => {
    if (typeFilter !== 'all' && track.kind !== typeFilter) return false
    if (unreviewedOnly && track.reviewed) return false

    const trackTagIds = new Set(track.tags.map((tag) => tag.id))
    if (excludedIds.some((id) => trackTagIds.has(id))) return false
    if (includedIds.length === 0) return true

    return matchMode === 'all'
      ? includedIds.every((id) => trackTagIds.has(id))
      : includedIds.some((id) => trackTagIds.has(id))
  })

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
          onCreateTag={(name) => createTag(track.id, name)}
        />
      ))}
    </div>
  )
}
