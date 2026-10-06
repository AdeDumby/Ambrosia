import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Review from './pages/Review'
import Home from './pages/Home'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/review" element={<Review />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
