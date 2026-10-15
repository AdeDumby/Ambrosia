import { useMemo, useState, type DragEvent, type MouseEvent } from 'react'
import { isProtectedFolder, MAX_FOLDER_NAME } from '../shared/folders'
import type { Tag, TagCategory } from '../shared/types'
import AddField from './item/AddField'
import ColorDialog from './item/ColorDialog'
import ConfirmDialog from './item/ConfirmDialog'
import ContextMenu, { type MenuItem } from './item/ContextMenu'
import FolderItem from './item/FolderItem'
import InlineError from './item/InlineError'
import SegmentedControl from './item/SegmentedControl'
import TagItem from './item/TagItem'
import { useVisibleTracks } from '../hooks/useVisibleTracks'
import { useFilters, type MatchMode, type TypeFilter } from '../store/FilterContext'
import { useLibrary } from '../store/LibraryContext'
import '../styles/Sidebar.css'

const matchOptions: { value: MatchMode; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'all', label: 'All' }
]

const typeOptions: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'music', label: 'Music' },
  { value: 'sfx', label: 'SFX' }
]

type Menu =
  | { kind: 'tag'; x: number; y: number; tag: Tag }
  | { kind: 'folder'; x: number; y: number; folder: TagCategory }

type Deleting = { folder: TagCategory; withTags: boolean }

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function deleteMessage(deleting: Deleting, summary: { tags: number; tracks: number }): string {
  const name = `"${deleting.folder.name}"`
  if (summary.tags === 0) return `Delete the empty folder ${name}?`

  if (deleting.withTags) {
    const effect =
      summary.tracks === 0
        ? 'No track uses them.'
        : `They will be removed from ${plural(summary.tracks, 'track')}.`
    return `Delete ${name} and its ${plural(summary.tags, 'tag')}? ${effect} This cannot be undone.`
  }
  return `Delete ${name}? Its ${plural(summary.tags, 'tag')} will be kept and moved to Ungrouped, so no track changes.`
}

export default function Sidebar() {
  const {
    categories,
    setCategories,
    tags,
    tracks,
    moveTag,
    createFolder,
    renameFolder,
    recolorFolder,
    deleteFolder,
    refreshTracks,
    renameTag
  } = useLibrary()
  const {
    matchMode,
    setMatchMode,
    unreviewedOnly,
    setUnreviewedOnly,
    typeFilter,
    setTypeFilter,
    tagFilters,
    cycleTagFilter,
    clearFilters
  } = useFilters()
  const visibleTracks = useVisibleTracks()

  const [menu, setMenu] = useState<Menu | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingTagId, setEditingTagId] = useState<number | null>(null)
  const [recoloring, setRecoloring] = useState<TagCategory | null>(null)
  const [deleting, setDeleting] = useState<Deleting | null>(null)
  const [folderError, setFolderError] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    id: number
    position: 'before' | 'after'
  } | null>(null)

  const counts = useMemo(() => {
    const result = new Map<number, number>()
    for (const track of visibleTracks) {
      for (const tag of track.tags) result.set(tag.id, (result.get(tag.id) ?? 0) + 1)
    }
    return result
  }, [visibleTracks])

  const deleteSummary = useMemo(() => {
    if (!deleting) return null
    const folderTagIds = new Set(
      tags.filter((tag) => tag.categoryId === deleting.folder.id).map((tag) => tag.id)
    )
    const affected = tracks.filter((track) =>
      track.tags.some((tag) => folderTagIds.has(tag.id))
    ).length
    return { tags: folderTagIds.size, tracks: affected }
  }, [deleting, tags, tracks])

  function openTagMenu(event: MouseEvent<HTMLButtonElement>, tag: Tag) {
    event.preventDefault()
    setMenu({ kind: 'tag', x: event.clientX, y: event.clientY, tag })
  }

  function openFolderMenu(event: MouseEvent<HTMLDivElement>, folder: TagCategory) {
    event.preventDefault()
    setMenu({ kind: 'folder', x: event.clientX, y: event.clientY, folder })
  }

  async function moveTagTo(tagId: number, categoryId: number | null) {
    setMenu(null)
    await moveTag(tagId, categoryId)
  }

  async function applyColor(color: string) {
    const folder = recoloring
    setRecoloring(null)
    if (!folder) return
    try {
      await recolorFolder(folder.id, color)
      await refreshTracks()
    } catch {
      setCategories(await window.api.listCategories())
    }
  }

  async function confirmDelete() {
    const target = deleting
    setDeleting(null)
    if (!target) return
    setFolderError(null)
    try {
      await deleteFolder(target.folder.id, target.withTags)
    } catch {
      setFolderError('Could not delete the folder.')
      setCategories(await window.api.listCategories())
    }
  }

  function folderMenuItems(folder: TagCategory): MenuItem[] {
    if (isProtectedFolder(folder.name)) {
      return [
        { label: 'The Franchise folder cannot be changed', disabled: true, onSelect: () => {} }
      ]
    }
    return [
      {
        label: 'Recolor',
        color: folder.color,
        onSelect: () => {
          setMenu(null)
          setRecoloring(folder)
        }
      },
      {
        label: 'Rename',
        onSelect: () => {
          setMenu(null)
          setEditingId(folder.id)
        }
      },
      {
        label: 'Delete folder and its tags',
        onSelect: () => {
          setMenu(null)
          setDeleting({ folder, withTags: true })
        }
      },
      {
        label: 'Delete folder, keep tags ungrouped',
        onSelect: () => {
          setMenu(null)
          setDeleting({ folder, withTags: false })
        }
      }
    ]
  }

  function tagMenuItems(tag: Tag): MenuItem[] {
    return [
      {
        label: 'Rename',
        onSelect: () => {
          setMenu(null)
          setEditingTagId(tag.id)
        }
      },
      ...categories.map((category) => ({
        label: category.name,
        color: category.color,
        checked: category.id === tag.categoryId,
        disabled: category.id === tag.categoryId,
        onSelect: () => moveTagTo(tag.id, category.id)
      })),
      {
        label: 'Ungrouped',
        color: '#888888',
        checked: tag.categoryId === null,
        disabled: tag.categoryId === null,
        onSelect: () => moveTagTo(tag.id, null)
      }
    ]
  }

  function renderTag(tag: Tag) {
    return (
      <TagItem
        key={tag.id}
        name={tag.name}
        count={counts.get(tag.id) ?? 0}
        state={tagFilters[tag.id]}
        editing={editingTagId === tag.id}
        onClick={() => cycleTagFilter(tag.id)}
        onDoubleClick={() => setEditingTagId(tag.id)}
        onContextMenu={(event) => openTagMenu(event, tag)}
        onSubmitName={async (next) => {
          await renameTag(tag.id, next)
          setEditingTagId(null)
        }}
        onCancelEdit={() => setEditingTagId(null)}
      />
    )
  }

  function resetDrag() {
    setDraggedId(null)
    setDropTarget(null)
  }

  function handleDragStart(event: DragEvent<HTMLDivElement>, id: number) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(id))
    setDraggedId(id)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>, id: number) {
    if (draggedId === null) return
    event.preventDefault()
    if (draggedId === id) {
      setDropTarget(null)
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    setDropTarget((previous) =>
      previous && previous.id === id && previous.position === position ? previous : { id, position }
    )
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (draggedId === null || dropTarget === null) {
      resetDrag()
      return
    }

    const ids = categories.map((category) => category.id).filter((id) => id !== draggedId)
    const targetIndex = ids.indexOf(dropTarget.id)
    ids.splice(dropTarget.position === 'before' ? targetIndex : targetIndex + 1, 0, draggedId)

    setCategories(ids.flatMap((id) => categories.find((category) => category.id === id) ?? []))
    resetDrag()

    try {
      await window.api.reorderCategories(ids)
    } catch {
      setCategories(await window.api.listCategories())
    }
  }

  const ungroupedTags = tags.filter((tag) => tag.categoryId === null)

  return (
    <aside className="sidebar">
      <AddField label="Create folder" placeholder="+ Create folder" onSubmit={createFolder} />

      {folderError && <InlineError message={folderError} onDismiss={() => setFolderError(null)} />}

      <div className="sidebar-header">
        <button type="button" className="btn sidebar-clear" onClick={clearFilters}>
          Clear filters
        </button>
        <SegmentedControl<MatchMode>
          label="Folder match mode"
          value={matchMode}
          onChange={setMatchMode}
          options={matchOptions}
        />
      </div>

      <label className="sidebar-checkbox">
        <input
          type="checkbox"
          checked={unreviewedOnly}
          onChange={(event) => setUnreviewedOnly(event.target.checked)}
        />
        Unreviewed only
      </label>

      <SegmentedControl<TypeFilter>
        label="Track type"
        fullWidth
        value={typeFilter}
        onChange={setTypeFilter}
        options={typeOptions}
      />

      <div
        className="sidebar-folders"
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDropTarget(null)
          }
        }}
      >
        {categories.map((category) => {
          const protectedFolder = isProtectedFolder(category.name)
          return (
            <FolderItem
              key={category.id}
              name={category.name}
              color={category.color}
              draggable
              isDragging={draggedId === category.id}
              dropIndicator={
                dropTarget && dropTarget.id === category.id ? dropTarget.position : null
              }
              editing={editingId === category.id}
              maxNameLength={MAX_FOLDER_NAME}
              onStartEdit={protectedFolder ? undefined : () => setEditingId(category.id)}
              onSubmitName={async (name) => {
                await renameFolder(category.id, name)
                setEditingId(null)
              }}
              onCancelEdit={() => setEditingId(null)}
              onContextMenu={(event) => openFolderMenu(event, category)}
              onDragStart={(event) => handleDragStart(event, category.id)}
              onDragOver={(event) => handleDragOver(event, category.id)}
              onDrop={handleDrop}
              onDragEnd={resetDrag}
            >
              {tags.filter((tag) => tag.categoryId === category.id).map(renderTag)}
            </FolderItem>
          )
        })}

        {ungroupedTags.length > 0 && (
          <FolderItem name="Ungrouped" color="#888888">
            {ungroupedTags.map(renderTag)}
          </FolderItem>
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          title={menu.kind === 'tag' ? `Move "${menu.tag.name}" to` : menu.folder.name}
          items={menu.kind === 'tag' ? tagMenuItems(menu.tag) : folderMenuItems(menu.folder)}
          onClose={() => setMenu(null)}
        />
      )}

      <ColorDialog
        open={recoloring !== null}
        title={recoloring ? `Color of ${recoloring.name}` : ''}
        initial={recoloring?.color ?? '#888888'}
        onApply={applyColor}
        onCancel={() => setRecoloring(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={deleting?.withTags ? 'Delete this folder and its tags?' : 'Delete this folder?'}
        message={deleting && deleteSummary ? deleteMessage(deleting, deleteSummary) : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </aside>
  )
}
