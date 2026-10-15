import { NavLink } from 'react-router-dom'
import SelectField from './item/SelectField'
import SearchField from './item/SearchField'
import { useVisibleTracks } from '../hooks/useVisibleTracks'
import { SORT_OPTIONS } from '../lib/sortTracks'
import { useFilters } from '../store/FilterContext'
import { useLibrary } from '../store/LibraryContext'
import { useDownload } from '../store/DownloadContext'
import '../styles/Topbar.css'

type TopbarProps = {
  minimal?: boolean
}

const tabs = [
  { to: '/', label: 'Library', end: true },
  { to: '/review', label: 'Review' },
  { to: '/download', label: 'Download' }
]

export default function Topbar({ minimal = false }: TopbarProps) {
  const { tracks } = useLibrary()
  const { search, setSearch, sort, setSort } = useFilters()
  const { state: download } = useDownload()
  const visibleTracks = useVisibleTracks()
  const trackLabel = `${visibleTracks.length} / ${tracks.length} tracks`

  return (
    <header className={`topbar ${minimal ? 'minimal' : ''}`}>
      {!minimal && (
        <div className="topbar-main">
          <div className="topbar-brand">
            <span className="topbar-logo">◆</span>
            <div>
              <h1 className="topbar-title">Ambrosia</h1>
              <p className="topbar-stats">{trackLabel}</p>
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
      )}

      <nav className="topbar-tabs">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className="tab">
            {tab.label}
            {tab.to === '/download' && download.phase === 'downloading' && (
              <span className="tab-dot" aria-label="Download in progress" />
            )}
          </NavLink>
        ))}
        <NavLink to="/settings" className="tab tab-right">
          ⚙ Settings
        </NavLink>
      </nav>
    </header>
  )
}
