import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ConfirmDialog from '../components/item/ConfirmDialog'
import InlineError from '../components/item/InlineError'
import TagBubble from '../components/item/TagBubble'
import TrackItem from '../components/item/TrackItem'
import { useTrackActions } from '../hooks/useTrackActions'
import { useVisibleTracks } from '../hooks/useVisibleTracks'
import { deleteDialogText } from '../lib/deleteDialog'
import { sortTracks } from '../lib/sortTracks'
import { useFilters } from '../store/FilterContext'
import { useLibrary } from '../store/LibraryContext'
import { usePlayer } from '../store/PlayerContext'
import { useSettings } from '../store/SettingsContext'
import './Home.css'

export default function Home() {
  const [pendingDelete, setPendingDelete] = useState<{ id: number; filename: string } | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const { tracks, tags: allTags, categories } = useLibrary()
  const { tagFilters, clearTagFilter, sort, search, typeFilter, unreviewedOnly, matchMode } =
    useFilters()
  const { currentTrack, isPlaying, toggleTrack } = usePlayer()
  const { settings } = useSettings()
  const { addTag, createTag, removeTag, setKind, deleteTrack, renameTrack } = useTrackActions()
  const pageSize = settings.list.batchSize

  const filteredTracks = useVisibleTracks()
  const visibleTracks = useMemo(() => sortTracks(filteredTracks, sort), [filteredTracks, sort])

  const listKey = `${sort}|${search}|${typeFilter}|${unreviewedOnly}|${matchMode}|${JSON.stringify(tagFilters)}`
  const [paging, setPaging] = useState({ key: listKey, limit: pageSize })
  const limit = paging.key === listKey ? paging.limit : pageSize
  const hasMore = limit < visibleTracks.length
  const shownTracks = useMemo(() => visibleTracks.slice(0, limit), [visibleTracks, limit])

  const listRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.closest('.content')?.scrollTo({ top: 0 })
  }, [listKey])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!hasMore || !sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setPaging({ key: listKey, limit: limit + pageSize })
      },
      { rootMargin: '800px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, limit, listKey, pageSize])

  const visibleRef = useRef(visibleTracks)
  const tagsRef = useRef(allTags)
  useEffect(() => {
    visibleRef.current = visibleTracks
    tagsRef.current = allTags
  }, [visibleTracks, allTags])

  const play = useCallback(
    (id: number, filename: string) =>
      toggleTrack(
        { id, filename },
        visibleRef.current.map((track) => ({ id: track.id, filename: track.filename }))
      ),
    [toggleTrack]
  )
  const getTagOptions = useCallback(() => tagsRef.current, [])
  const requestDelete = useCallback(
    (id: number, filename: string) => setPendingDelete({ id, filename }),
    []
  )

  const folderPosition = (categoryId: number | null) =>
    categoryId === null ? categories.length : categories.findIndex((c) => c.id === categoryId)

  const activeFilters = allTags
    .filter((tag) => tagFilters[tag.id] !== undefined)
    .sort((a, b) => folderPosition(a.categoryId) - folderPosition(b.categoryId))

  async function confirmDelete() {
    if (!pendingDelete) return
    const { id, filename } = pendingDelete
    setPendingDelete(null)
    setDeleteError(null)
    try {
      await deleteTrack(id)
    } catch (error) {
      console.error(error)
      setDeleteError(
        `Could not delete ${filename}. The file may be in use or its folder may be read-only.`
      )
    }
  }

  const dialog = pendingDelete ? deleteDialogText(pendingDelete.filename) : null

  return (
    <div className="track-list" ref={listRef}>
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

      {deleteError && <InlineError message={deleteError} onDismiss={() => setDeleteError(null)} />}

      {visibleTracks.length === 0 && (
        <p>{tracks.length === 0 ? 'No tracks yet.' : 'No tracks match the current filters.'}</p>
      )}
      {shownTracks.map((track) => (
        <TrackItem
          key={track.id}
          id={track.id}
          filename={track.filename}
          durationSec={track.durationSec}
          peakDb={track.peakDb}
          kind={track.kind}
          tags={track.tags}
          getTagOptions={getTagOptions}
          isPlaying={isPlaying && currentTrack?.id === track.id}
          onPlay={play}
          onSetKind={setKind}
          onRename={renameTrack}
          onDelete={requestDelete}
          onRemoveTag={removeTag}
          onAddTag={addTag}
          onCreateTag={createTag}
        />
      ))}

      {hasMore && <div ref={sentinelRef} className="track-list-end" />}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        confirmLabel={dialog?.confirmLabel}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
