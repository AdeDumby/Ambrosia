import SegmentedControl from './item/SegmentedControl'
import FolderItem from './item/FolderItem'
import { useEffect, useState } from 'react'
import '../styles/Sidebar.css'

type MatchMode = 'or' | 'and'
type TypeFilter = 'all' | 'music' | 'sfx'
type Category = { id: number; name: string; color: string }

const matchOptions: { value: MatchMode; label: string }[] = [
  { value: 'or', label: 'Or' },
  { value: 'and', label: 'And' }
]

const typeOptions: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'music', label: 'Music' },
  { value: 'sfx', label: 'SFX' }
]

export default function Sidebar() {
  const [matchMode, setMatchMode] = useState<MatchMode>('or')
  const [unreviewedOnly, setUnreviewedOnly] = useState(false)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [categories, setCategories] = useState<Category[]>([])

useEffect(() => {
  window.api.listCategories().then(setCategories)
  }, [])

  function clearFilters() {
    setMatchMode('or')
    setUnreviewedOnly(false)
    setTypeFilter('all')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">Folders</h2>
        <SegmentedControl<MatchMode>
          label="Folder match mode"
          value={matchMode}
          onChange={setMatchMode}
          options={matchOptions}/>
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
          <FolderItem key={category.id} name={category.name} color={category.color} />
        ))}
      </div>

      <button className="btn sidebar-clear" onClick={clearFilters}>
        Clear filters
      </button>
    </aside>
  )
}