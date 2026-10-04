import { useState, type DragEvent } from 'react'
import FolderItem from './item/FolderItem'
import SegmentedControl from './item/SegmentedControl'
import TagItem from './item/TagItem'
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

export default function Sidebar() {
  const { categories, setCategories, tags } = useLibrary()
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

  return (
    <aside className="sidebar">
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
        {categories.map((category) => (
          <FolderItem
            key={category.id}
            name={category.name}
            color={category.color}
            draggable
            isDragging={draggedId === category.id}
            dropIndicator={dropTarget && dropTarget.id === category.id ? dropTarget.position : null}
            onDragStart={(event) => handleDragStart(event, category.id)}
            onDragOver={(event) => handleDragOver(event, category.id)}
            onDrop={handleDrop}
            onDragEnd={resetDrag}
          >
            {tags
              .filter((tag) => tag.categoryId === category.id)
              .map((tag) => (
                <TagItem
                  key={tag.id}
                  name={tag.name}
                  state={tagFilters[tag.id]}
                  onClick={() => cycleTagFilter(tag.id)}
                />
              ))}
          </FolderItem>
        ))}

        {tags.some((tag) => tag.categoryId === null) && (
          <FolderItem name="Ungrouped" color="#888888">
            {tags
              .filter((tag) => tag.categoryId === null)
              .map((tag) => (
                <TagItem
                  key={tag.id}
                  name={tag.name}
                  state={tagFilters[tag.id]}
                  onClick={() => cycleTagFilter(tag.id)}
                />
              ))}
          </FolderItem>
        )}
      </div>
    </aside>
  )
}
