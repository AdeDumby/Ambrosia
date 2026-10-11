import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Footer from './Footer'
import { FilterProvider } from '../store/FilterContext'
import { LibraryProvider } from '../store/LibraryContext'
import { PlayerProvider } from '../store/PlayerContext'
import { SettingsProvider } from '../store/SettingsContext'
import { AnalysisProvider } from '../store/AnalysisContext'

const FOCUSED_PAGES = ['/review', '/settings']

export default function Layout() {
  const { pathname } = useLocation()
  const focused = FOCUSED_PAGES.includes(pathname)

  return (
    <SettingsProvider>
      <PlayerProvider>
        <LibraryProvider>
          <AnalysisProvider>
            <FilterProvider>
              <div className="app-shell">
                {!focused && <Sidebar />}
                <div className="main-area">
                  <Topbar minimal={focused} />
                  <main className="content">
                    <Outlet />
                  </main>
                  <Footer />
                </div>
              </div>
            </FilterProvider>
          </AnalysisProvider>
        </LibraryProvider>
      </PlayerProvider>
    </SettingsProvider>
  )
}
