import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import Sidebar from './Sidebar'
import Footer from './Footer'
import Topbar from './Topbar'
import TitleBar from './TitleBar'
import ScanDialog from './feature/ScanDialog'
import { AnalysisProvider } from '../store/AnalysisContext'
import { FilterProvider } from '../store/FilterContext'
import { LibraryProvider } from '../store/LibraryContext'
import { PlayerProvider } from '../store/PlayerContext'
import { ScanRunProvider } from '../store/ScanRunContext'
import { SettingsProvider } from '../store/SettingsContext'
import { DownloadProvider } from '../store/DownloadContext'

const FOCUSED_PAGES = ['/review', '/settings', '/download']

export default function Layout() {
  const { pathname } = useLocation()
  const focused = FOCUSED_PAGES.includes(pathname)
  const navigate = useNavigate()

  useEffect(
    () =>
      window.appEvents.onNavigate((route) => {
        if (route === '/download' && window.location.hash.startsWith('#/review')) return
        navigate(route)
      }),
    [navigate]
  )

  return (
    <SettingsProvider>
      <LibraryProvider>
        <PlayerProvider>
          <AnalysisProvider>
            <ScanRunProvider>
              <DownloadProvider>
                <FilterProvider>
                  <div className="window">
                    <TitleBar />
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
                  </div>
                  <ScanDialog />
                </FilterProvider>
              </DownloadProvider>
            </ScanRunProvider>
          </AnalysisProvider>
        </PlayerProvider>
      </LibraryProvider>
    </SettingsProvider>
  )
}
