import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './styles/variables.css'
import './styles/global.css'
import './styles/theme.css'
import './lib/analyseTrack.ts'
import App from './App.tsx'

import './styles/variables.css'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <StrictMode>
      <App />
    </StrictMode>
  </HashRouter>
)
