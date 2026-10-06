import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Review from './pages/Review'
import Home from './pages/Home'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/review" element={<Review />} />
      </Route>
    </Routes>
  )
}
