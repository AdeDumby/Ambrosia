import SearchField from './item/SearchField'
import SelectField from './item/SelectField'
import { useVisibleMixtapes } from '../hooks/useVisibleMixtapes'
import { useVisibleTracks } from '../hooks/useVisibleTracks'
import { effectiveMixtapeSort, MIXTAPE_SORT_OPTIONS } from '../lib/sortMixtapes'
import { SORT_OPTIONS } from '../lib/sortTracks'
import { useFilters } from '../store/FilterContext'
import { useLibrary } from '../store/LibraryContext'
import '../styles/Topbar.css'

type TopbarProps = {
  minimal?: boolean
}

export default function Topbar({ minimal = false }: TopbarProps) {
  const { tracks, mixtapes } = useLibrary()
  const { search, setSearch, sort, setSort, typeFilter } = useFilters()
  const visibleTracks = useVisibleTracks()
  const visibleMixtapes = useVisibleMixtapes()
  const showingMixtapes = typeFilter === 'mixtape'

  if (minimal) return null

  return (
    <header className="topbar">
      <div className="topbar-main">
        <div className="topbar-brand">
          <span className="topbar-logo">◆</span>
          <div>
            <h1 className="topbar-title">Ambrosia</h1>
            <p className="topbar-stats">
              {showingMixtapes
                ? `${visibleMixtapes.length} / ${mixtapes.length} mixtapes`
                : `${visibleTracks.length} / ${tracks.length} tracks`}
            </p>
          </div>
        </div>

        <SearchField
          label="Search tracks by name"
          placeholder="Search tracks by name"
          value={search}
          onChange={setSearch}
        />

        <SelectField
          label="Sort"
          value={showingMixtapes ? effectiveMixtapeSort(sort) : sort}
          options={showingMixtapes ? MIXTAPE_SORT_OPTIONS : SORT_OPTIONS}
          onChange={setSort}
        />
      </div>
    </header>
  )
}
