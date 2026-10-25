import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Review from './pages/Review'
import Home from './pages/Home'
import Settings from './pages/Settings'
import Download from './pages/Download'
import Mix from './pages/Mix'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/review" element={<Review />} />
        <Route path="/download" element={<Download />} />
        <Route path="/mix" element={<Mix />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
