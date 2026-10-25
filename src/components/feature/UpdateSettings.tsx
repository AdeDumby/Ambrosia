import { useState } from 'react'
import { useUpdates } from '../../hooks/useUpdates'
import type { UpdateState } from '../../shared/update'
import { useSettings } from '../../store/SettingsContext'
import CheckboxField from '../item/CheckboxField'
import SettingsSection from '../item/SettingsSection'
import UpdateRestartDialog from './UpdateRestartDialog'
import './UpdateSettings.css'

function statusText(state: UpdateState): string {
  switch (state.phase) {
    case 'idle':
      return ''
    case 'unavailable':
      return 'Updates only work in the installed app, not when running from source.'
    case 'checking':
      return 'Looking for updates…'
    case 'up-to-date':
      return 'You have the latest version.'
    case 'downloading':
      return `Downloading version ${state.version}… ${state.percent}%`
    case 'ready':
      return `Version ${state.version} is ready. It installs when you close Ambrosia, or now with the button.`
    case 'error':
      return state.message
  }
}

export default function UpdateSettings() {
  const { settings, updateUpdates } = useSettings()
  const { version, state, check, install } = useUpdates()
  const [confirming, setConfirming] = useState(false)

  const ready = state.phase === 'ready'
  const busy = state.phase === 'checking' || state.phase === 'downloading'
  const text = statusText(state)

  return (
    <SettingsSection title="Updates">
      <div className="settings-row">
        <div className="update-info">
          <span>{version === '' ? 'Version' : `Version ${version}`}</span>
          {text !== '' && (
            <p
              className={state.phase === 'error' ? 'settings-error' : 'settings-hint'}
              role="status"
            >
              {text}
            </p>
          )}
        </div>

        {ready ? (
          <button type="button" className="btn btn-primary" onClick={() => setConfirming(true)}>
            Restart to update
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            disabled={busy || state.phase === 'unavailable'}
            onClick={() => void check()}
          >
            Check for updates
          </button>
        )}
      </div>

      <CheckboxField
        label="Check for updates automatically"
        checked={settings.updates.autoCheck}
        onChange={(checked) => updateUpdates({ autoCheck: checked })}
      />

      <UpdateRestartDialog
        open={confirming && ready}
        version={state.phase === 'ready' ? state.version : ''}
        onConfirm={() => {
          setConfirming(false)
          void install()
        }}
        onCancel={() => setConfirming(false)}
      />
    </SettingsSection>
  )
}
