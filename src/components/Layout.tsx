import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import Footer from './Footer'
import { FilterProvider } from '../store/FilterContext'

export default function Layout() {
  return (
    <FilterProvider>
      <div className="app-shell">
        <Sidebar />
        <div className="main-area">
          <Topbar />
          <main className="content">
            <Outlet />
          </main>
          <Footer />
        </div>
      </div>
    </FilterProvider>
  )
}
