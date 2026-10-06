import type { TrackKind } from '../shared/types'
import { useLibrary } from '../store/LibraryContext'
import { usePlayer } from '../store/PlayerContext'

export function useTrackActions() {
  const { setTracks, refreshTags } = useLibrary()
  const { currentTrack, stop } = usePlayer()

  async function reloadTrack(trackId: number) {
    const updated = await window.api.getTrack(trackId)
    if (!updated) return
    setTracks((previous) => previous.map((track) => (track.id === trackId ? updated : track)))
  }

  async function addTag(trackId: number, tagId: number) {
    await window.api.tagTrack(trackId, tagId)
    await reloadTrack(trackId)
  }

  async function createTag(trackId: number, name: string, categoryId: number | null = null) {
    const created = await window.api.addTagToTrackByName(trackId, name, categoryId)
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

  async function setReviewed(trackId: number, reviewed: boolean) {
    await window.api.setTrackReviewed(trackId, reviewed)
    setTracks((previous) =>
      previous.map((track) => (track.id === trackId ? { ...track, reviewed } : track))
    )
  }

  async function deleteTrack(trackId: number) {
    await window.api.deleteTrack(trackId)
    if (currentTrack?.id === trackId) stop()
    setTracks((previous) => previous.filter((track) => track.id !== trackId))
  }

  return { addTag, createTag, removeTag, setKind, setReviewed, deleteTrack }
}
