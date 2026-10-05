import { NavLink } from 'react-router-dom'
import { useLibrary } from '../store/LibraryContext'
import { useVisibleTracks } from '../hooks/useVisibleTracks'
import '../styles/Topbar.css'

const tabs = [
  { to: '/', label: 'Library', end: true },
  { to: '/review', label: 'Review' },
  { to: '/download', laebl: 'Download' }
]

export default function Topbar() {
  const { tracks } = useLibrary()
  const visibleTracks = useVisibleTracks()
  const trackLabel = `${visibleTracks.length} / ${tracks.length} tracks`
  return (
    <header className="topbar">
      <div className="topbar-main">
        <div className="topbar-brand">
          <span className="topbar-logo">◆</span>
          <div>
            <h1 className="topbar-title">Ambrosia</h1>
            <p className="topbar-stats">{trackLabel}</p>
          </div>
        </div>

        <div className="topbar-actions">
          <input type="text" placeholder="Items" />
          <button className="btn btn-primary">Scan folder</button>
          <button className="btn">Export</button>
        </div>
      </div>

      <nav className="topbar-tabs">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className="tab">
            {tab.label}
          </NavLink>
        ))}
        <NavLink to="/settings" className="tab tab-right">
          Settings
        </NavLink>
      </nav>
    </header>
  )
}
