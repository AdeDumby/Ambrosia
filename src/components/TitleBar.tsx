import { NavLink } from 'react-router-dom'
import { useDownload } from '../store/DownloadContext'
import { useShortcutsEnabled } from '../store/ShortcutsContext'
import WindowControls from './WindowsControl'
import '../styles/TitleBar.css'

const tabs = [
  { to: '/', label: 'Library', end: true },
  { to: '/review', label: 'Review', end: false },
  { to: '/download', label: 'Download', end: false }
]

export default function TitleBar() {
  const { state: download, chainBusy } = useDownload()
  const { enabled, toggle } = useShortcutsEnabled()
  const downloading = download.phase === 'downloading' || chainBusy

  return (
    <div className="titlebar">
      <div className="titlebar-brand">
        <span className="titlebar-logo">◆</span>
        <span>Ambrosia</span>
      </div>

      <nav className="titlebar-nav">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className="titlebar-tab">
            {tab.label}
            {tab.to === '/download' && downloading && (
              <span className="titlebar-dot" aria-label="Download in progress" />
            )}
          </NavLink>
        ))}
      </nav>

      <div className="titlebar-right">
        <NavLink to="/settings" className="titlebar-tab">
          ⚙ Settings
        </NavLink>
        <button
          type="button"
          className={`titlebar-keys ${enabled ? 'on' : ''}`}
          aria-pressed={enabled}
          title="Keyboard shortcuts. Press Ctrl and Alt together to turn them on or off."
          onClick={toggle}
        >
          Keys {enabled ? 'on' : 'off'}
        </button>
        <WindowControls />
      </div>
    </div>
  )
}
