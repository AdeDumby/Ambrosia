import SegmentedControl from './item/SegmentedControl'
import FolderItem from './item/FolderItem'
import TagItem from './item/TagItem'

import { useFilters, type MatchMode, type TypeFilter } from '../store/FilterContext'

import { useEffect, useState } from 'react'
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

      <div className="sidebar-folders">
        {categories.map((category) => (
          <FolderItem key={category.id} name={category.name} color={category.color}>
            {tags
              .filter((tag) => tag.categoryId === category.id)
              .map((tag) => (
                <TagItem key={tag.id} name={tag.name} />
              ))}
          </FolderItem>
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
