import SearchField from './item/SearchField'
import SelectField from './item/SelectField'
import { useVisibleTracks } from '../hooks/useVisibleTracks'
import { SORT_OPTIONS } from '../lib/sortTracks'
import { useFilters } from '../store/FilterContext'
import { useLibrary } from '../store/LibraryContext'
import '../styles/Topbar.css'

type TopbarProps = {
  minimal?: boolean
}

export default function Topbar({ minimal = false }: TopbarProps) {
  const { tracks } = useLibrary()
  const { search, setSearch, sort, setSort } = useFilters()
  const visibleTracks = useVisibleTracks()

  if (minimal) return null

  return (
    <header className="topbar">
      <div className="topbar-main">
        <div className="topbar-brand">
          <span className="topbar-logo">◆</span>
          <div>
            <h1 className="topbar-title">Ambrosia</h1>
            <p className="topbar-stats">{`${visibleTracks.length} / ${tracks.length} tracks`}</p>
          </div>
        </div>

        <SearchField
          label="Search tracks by name"
          placeholder="Search tracks by name"
          value={search}
          onChange={setSearch}
        />

        <SelectField label="Sort" value={sort} options={SORT_OPTIONS} onChange={setSort} />
      </div>
    </header>
  )
}
