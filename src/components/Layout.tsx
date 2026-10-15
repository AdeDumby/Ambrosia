import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Footer from './Footer'
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

  return (
    <SettingsProvider>
      <LibraryProvider>
        <PlayerProvider>
          <AnalysisProvider>
            <ScanRunProvider>
              <DownloadProvider>
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
