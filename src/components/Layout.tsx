import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Footer from './Footer'
import Sidebar from './Sidebar'
import TitleBar from './TitleBar'
import Topbar from './Topbar'
import ScanDialog from './feature/ScanDialog'
import Shortcuts from './feature/Shortcuts'
import { AnalysisProvider } from '../store/AnalysisContext'
import { DownloadProvider } from '../store/DownloadContext'
import { FilterProvider } from '../store/FilterContext'
import { LibraryProvider } from '../store/LibraryContext'
import { MixProvider } from '../store/MixContext'
import { PlayerProvider } from '../store/PlayerContext'
import { ScanRunProvider } from '../store/ScanRunContext'
import { SettingsProvider } from '../store/SettingsContext'
import { ShortcutsProvider } from '../store/ShortcutsContext'

const FOCUSED_PAGES = ['/review', '/settings', '/download', '/mix']

export default function Layout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const focused = FOCUSED_PAGES.includes(pathname)

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
      <ShortcutsProvider>
        <LibraryProvider>
          <PlayerProvider>
            <MixProvider>
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
                      <Shortcuts />
                    </FilterProvider>
                  </DownloadProvider>
                </ScanRunProvider>
              </AnalysisProvider>
            </MixProvider>
          </PlayerProvider>
        </LibraryProvider>
      </ShortcutsProvider>
    </SettingsProvider>
  )
}
