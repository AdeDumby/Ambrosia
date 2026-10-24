import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { errorMessage } from '../../lib/errors'
import { MAX_TAG_NAME } from '../../shared/tags'
import type { Tag } from '../../shared/types'
import { useLibrary } from '../../store/LibraryContext'
import InlineError from '../item/InlineError'
import TagColumn from './TagColumn'
import './MergeTagDialog.css'

type Props = {
  /** The tag that was right-clicked. It stays, under the new name, in its own folder. */
  tag: Tag
  onMerge: (otherTagId: number, name: string) => Promise<void>
  onClose: () => void
}

const UNGROUPED_COLOR = '#888888'

export default function MergeTagDialog({ tag, onMerge, onClose }: Props) {
  const { tags, categories, tracks } = useLibrary()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [otherId, setOtherId] = useState<number | null>(null)
  const [name, setName] = useState(tag.name)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const columns = useMemo(() => {
    const others = tags.filter((candidate) => candidate.id !== tag.id)
    const folders = categories.map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      tags: others.filter((candidate) => candidate.categoryId === category.id)
    }))
    const ungrouped = others.filter((candidate) => candidate.categoryId === null)
    if (ungrouped.length > 0) {
      folders.push({ id: -1, name: 'Ungrouped', color: UNGROUPED_COLOR, tags: ungrouped })
    }
    return folders.filter((folder) => folder.tags.length > 0)
  }, [tags, categories, tag.id])

  const other =
    otherId === null ? null : (tags.find((candidate) => candidate.id === otherId) ?? null)

  const affectedTracks = useMemo(() => {
    if (!other) return 0
    return tracks.filter((track) =>
      track.tags.some((trackTag) => trackTag.id === tag.id || trackTag.id === other.id)
    ).length
  }, [tracks, tag.id, other])

  const canMerge = other !== null && name.trim() !== '' && !busy

  function choose(tagId: number) {
    setError(null)
    setOtherId((current) => (current === tagId ? null : tagId))
  }

  async function submit() {
    if (!canMerge || otherId === null) return
    setBusy(true)
    setError(null)
    try {
      await onMerge(otherId, name)
      onClose()
    } catch (failure) {
      setError(errorMessage(failure))
      setBusy(false)
    }
  }

  function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void submit()
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog merge-dialog"
      aria-labelledby="merge-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <h2 id="merge-dialog-title" className="confirm-dialog-title">
        {`Merge "${tag.name}" with another tag`}
      </h2>
      <p className="confirm-dialog-message merge-dialog-hint">
        {columns.length === 0
          ? 'There is no other tag to merge with.'
          : 'Pick the tag to merge in. Click it again to unpick it.'}
      </p>

      {columns.length > 0 && (
        <div className="merge-dialog-columns">
          {columns.map((column) => (
            <TagColumn
              key={column.id}
              name={column.name}
              color={column.color}
              tags={column.tags}
              selectedIds={new Set(otherId === null ? [] : [otherId])}
              onToggle={choose}
            />
          ))}
        </div>
      )}

      <label className="merge-dialog-field">
        <span>New name</span>
        <input
          type="text"
          value={name}
          maxLength={MAX_TAG_NAME}
          disabled={busy}
          onChange={(event) => {
            setName(event.target.value)
            setError(null)
          }}
          onKeyDown={handleNameKeyDown}
        />
      </label>

      {other && (
        <p className="confirm-dialog-message merge-dialog-summary">
          {`"${tag.name}" and "${other.name}" become one tag, shown on ${affectedTracks} ${
            affectedTracks === 1 ? 'track' : 'tracks'
          }. A backup is made first.`}
        </p>
      )}

      {error && <InlineError message={error} onDismiss={() => setError(null)} />}

      <div className="confirm-dialog-buttons">
        <button type="button" className="btn" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canMerge}
          onClick={() => void submit()}
        >
          Merge
        </button>
      </div>
    </dialog>
  )
}
