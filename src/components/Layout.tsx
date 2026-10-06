import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Footer from './Footer'
import { FilterProvider } from '../store/FilterContext'
import { LibraryProvider } from '../store/LibraryContext'
import { PlayerProvider } from '../store/PlayerContext'

export default function Layout() {
  const { pathname } = useLocation()
  const isReview = pathname === '/review'

  return (
    <PlayerProvider>
      <LibraryProvider>
        <FilterProvider>
          <div className="app-shell">
            {!isReview && <Sidebar />}
            <div className="main-area">
              <Topbar minimal={isReview} />
              <main className="content">
                <Outlet />
              </main>
              <Footer />
            </div>
          </div>
        </FilterProvider>
      </LibraryProvider>
    </PlayerProvider>
  )
}
