import { NavLink } from 'react-router-dom'
import SearchField from './item/SearchField'
import { useVisibleTracks } from '../hooks/useVisibleTracks'
import { useFilters } from '../store/FilterContext'
import { useLibrary } from '../store/LibraryContext'
import '../styles/Topbar.css'

type TopbarProps = {
  minimal?: boolean
}

const tabs = [
  { to: '/', label: 'Library', end: true },
  { to: '/review', label: 'Review' }
]

export default function Topbar({ minimal = false }: TopbarProps) {
  const { tracks } = useLibrary()
  const { search, setSearch } = useFilters()
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
        </div>
      )}

      <nav className="topbar-tabs">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className="tab">
            {tab.label}
          </NavLink>
        ))}
        <NavLink to="/settings" className="tab tab-right">
          ⚙ Settings
        </NavLink>
      </nav>
    </header>
  )
}
