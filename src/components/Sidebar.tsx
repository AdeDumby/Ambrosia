import SegmentedControl from './item/SegmentedControl'
import FolderItem from './item/FolderItem'
import TagItem from './item/TagItem'

import { useFilters, type MatchMode, type TypeFilter } from '../store/FilterContext'

import { useEffect, useState, type DragEvent } from 'react'
import '../styles/Sidebar.css'

type Category = { id: number; name: string; color: string }
type Tag = { id: number; name: string; categoryId: number | null }

const matchOptions: { value: MatchMode; label: string }[] = [
  { value: 'any', label: 'Or' },
  { value: 'all', label: 'And' }
]

const typeOptions: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'music', label: 'Music' },
  { value: 'sfx', label: 'SFX' }
]

export default function Sidebar() {
  const {
    matchMode,
    setMatchMode,
    unreviewedOnly,
    setUnreviewedOnly,
    typeFilter,
    setTypeFilter,
    clearFilters
  } = useFilters()

  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    id: number
    position: 'before' | 'after'
  } | null>(null)

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

  useEffect(() => {
    Promise.all([window.api.listCategories(), window.api.listTags()]).then(
      ([loadedCategories, loadedTags]) => {
        setCategories(loadedCategories)
        setTags(loadedTags)
      }
    )
  }, [])

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Folders</h2>
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
          onChange={(e) => setUnreviewedOnly(e.target.checked)}
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
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null)
        }}
      >
        {categories.map((category) => (
          <FolderItem
            key={category.id}
            name={category.name}
            color={category.color}
            draggable
            isDragging={draggedId === category.id}
            dropIndicator={dropTarget?.id === category.id ? dropTarget.position : null}
            onDragStart={(event) => handleDragStart(event, category.id)}
            onDragOver={(event) => handleDragOver(event, category.id)}
            onDrop={handleDrop}
            onDragEnd={resetDrag}
          ></FolderItem>
        ))}

        {tags.some((tag) => tag.categoryId === null) && (
          <FolderItem name="Ungrouped" color="#888888">
            {tags
              .filter((tag) => tag.categoryId === null)
              .map((tag) => (
                <TagItem key={tag.id} name={tag.name} />
              ))}
          </FolderItem>
        )}
      </div>

      <button className="btn sidebar-clear" onClick={clearFilters}>
        Clear filters
      </button>
    </aside>
  )
}
