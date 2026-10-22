import { useEffect, useState } from 'react'
import '../styles/WindowsControl.css'

export default function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    window.api
      .getWindowState()
      .then((state) => setMaximized(state.maximized))
      .catch(() => {})
    return window.appEvents.onWindowState((state) => setMaximized(state.maximized))
  }, [])

  const act = (action: 'minimize' | 'maximize' | 'close') =>
    void window.api.controlWindow(action).catch(() => {})

  return (
    <div className="window-controls">
      <button type="button" aria-label="Minimize" onClick={() => act('minimize')}>
        <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
          <path d="M0 5h10" stroke="currentColor" fill="none" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={maximized ? 'Restore' : 'Maximize'}
        onClick={() => act('maximize')}
      >
        <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
          {maximized ? (
            <path d="M2.5 2.5V0.5h7v7h-2M0.5 2.5h7v7h-7z" stroke="currentColor" fill="none" />
          ) : (
            <path d="M0.5 0.5h9v9h-9z" stroke="currentColor" fill="none" />
          )}
        </svg>
      </button>
      <button type="button" className="close" aria-label="Close" onClick={() => act('close')}>
        <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
          <path d="M0 0l10 10M10 0L0 10" stroke="currentColor" fill="none" />
        </svg>
      </button>
    </div>
  )
}
