import { useCallback } from 'react'
import type { TrackKind } from '../shared/types'
import { useLibrary } from '../store/LibraryContext'
import { usePlayer } from '../store/PlayerContext'

export function useTrackActions() {
  const { setTracks, refreshTags } = useLibrary()
  const { stopTrack } = usePlayer()

  const reloadTrack = useCallback(
    async (trackId: number) => {
      const updated = await window.api.getTrack(trackId)
      if (!updated) return
      setTracks((previous) => previous.map((track) => (track.id === trackId ? updated : track)))
    },
    [setTracks]
  )

  const addTag = useCallback(
    async (trackId: number, tagId: number) => {
      await window.api.tagTrack(trackId, tagId)
      await reloadTrack(trackId)
    },
    [reloadTrack]
  )

  const createTag = useCallback(
    async (trackId: number, name: string, categoryId: number | null = null) => {
      const created = await window.api.addTagToTrackByName(trackId, name, categoryId)
      await reloadTrack(trackId)
      if (created) await refreshTags()
    },
    [reloadTrack, refreshTags]
  )

  const removeTag = useCallback(
    async (trackId: number, tagId: number) => {
      const tagDeleted = await window.api.untagTrack(trackId, tagId)
      setTracks((previous) =>
        previous.map((track) =>
          track.id === trackId
            ? { ...track, tags: track.tags.filter((tag) => tag.id !== tagId) }
            : track
        )
      )
      if (tagDeleted) await refreshTags()
    },
    [setTracks, refreshTags]
  )

  const setKind = useCallback(
    async (trackId: number, kind: TrackKind) => {
      await window.api.setTrackKind(trackId, kind)
      setTracks((previous) =>
        previous.map((track) => (track.id === trackId ? { ...track, kind } : track))
      )
    },
    [setTracks]
  )

  const setReviewed = useCallback(
    async (trackId: number, reviewed: boolean) => {
      await window.api.setTrackReviewed(trackId, reviewed)
      setTracks((previous) =>
        previous.map((track) => (track.id === trackId ? { ...track, reviewed } : track))
      )
    },
    [setTracks]
  )

  const deleteTrack = useCallback(
    async (trackId: number) => {
      stopTrack(trackId)
      const tagsRemoved = await window.api.deleteTrack(trackId)
      setTracks((previous) => previous.filter((track) => track.id !== trackId))
      if (tagsRemoved) await refreshTags()
    },
    [setTracks, stopTrack, refreshTags]
  )

  return { addTag, createTag, removeTag, setKind, setReviewed, deleteTrack }
}
