import { useEffect, useState } from 'react'
import BackupSettings from '../components/feature/BackupSettings'
import DeletedFolderPanel from '../components/feature/DeletedFolderPanel'
import PlaybackSettings from '../components/feature/PlaybackSettings'
import PresetSettings from '../components/feature/PresetSettings'
import ReviewSettings from '../components/feature/ReviewSettings'
import TrackListSettings from '../components/feature/TrackListSettings'
import UpdateSettings from '../components/feature/UpdateSettings'
import ColorField from '../components/item/ColorField'
import PathField from '../components/item/PathField'
import SegmentedControl from '../components/item/SegmentedControl'
import SettingsSection from '../components/item/SettingsSection'
import { useScanRun } from '../store/ScanRunContext'
import { useSettings } from '../store/SettingsContext'
import type { AppearanceMode, Density } from '../shared/settings'
import type { LibraryPaths } from '../shared/types'
import './Settings.css'

const densityOptions: { value: Density; label: string }[] = [
  { value: 'spacey', label: 'Spacey' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' }
]

const modeOptions: { value: AppearanceMode; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
]

export default function Settings() {
  const { settings, updateAppearance, resetAppearance } = useSettings()
  const { busy, startApply } = useScanRun()
  const { appearance } = settings

  const [paths, setPaths] = useState<LibraryPaths | null>(null)
  const [libraryError, setLibraryError] = useState<string | null>(null)

  useEffect(() => {
    window.api
      .getLibraryPaths()
      .then(setPaths)
      .catch(() => setLibraryError('Could not read the library location.'))
  }, [])

  async function chooseFolder() {
    setLibraryError(null)
    try {
      const chosen = await window.api.chooseLibraryFolder()
      if (chosen) setPaths(chosen)
    } catch {
      setLibraryError('That folder cannot be used. It may be read-only or unavailable.')
    }
  }

  async function openFolder() {
    setLibraryError(null)
    try {
      await window.api.openLibraryFolder()
    } catch {
      setLibraryError('Could not open the library folder. It may have been moved or deleted.')
    }
  }

  return (
    <div className="settings">
      <SettingsSection title="Library">
        <PathField label="Library folder" path={paths?.folder ?? null}>
          <button type="button" className="btn" onClick={chooseFolder}>
            Choose folder...
          </button>
          <button type="button" className="btn" onClick={openFolder}>
            Open folder
          </button>
        </PathField>

        <DeletedFolderPanel>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void startApply()}
          >
            Scan library
          </button>
        </DeletedFolderPanel>

        {libraryError && (
          <p className="settings-error" role="alert">
            {libraryError}
          </p>
        )}
      </SettingsSection>

      <PresetSettings />

      <SettingsSection title="Appearance">
        <div className="settings-row">
          <span>Theme</span>
          <SegmentedControl<AppearanceMode>
            label="Theme mode"
            value={appearance.mode}
            onChange={(mode) => updateAppearance({ mode })}
            options={modeOptions}
          />
        </div>

        <ColorField
          label="Accent color"
          value={appearance.accentColor}
          onChange={(accentColor) => updateAppearance({ accentColor })}
        />

        <div className="settings-row">
          <span>Layout density</span>
          <SegmentedControl<Density>
            label="Layout density"
            value={appearance.density}
            onChange={(density) => updateAppearance({ density })}
            options={densityOptions}
          />
        </div>

        <ColorField
          label="Page background"
          value={appearance.pageBackground}
          onChange={(pageBackground) => updateAppearance({ pageBackground })}
        />
        <ColorField
          label="Panels"
          value={appearance.panelBackground}
          onChange={(panelBackground) => updateAppearance({ panelBackground })}
        />
        <ColorField
          label="Raised and hover panels"
          value={appearance.raisedBackground}
          onChange={(raisedBackground) => updateAppearance({ raisedBackground })}
        />
        <ColorField
          label="Borders"
          value={appearance.borderColor}
          onChange={(borderColor) => updateAppearance({ borderColor })}
        />

        <button type="button" className="btn settings-reset" onClick={resetAppearance}>
          Reset to default
        </button>
      </SettingsSection>

      <PlaybackSettings />
      <ReviewSettings />
      <TrackListSettings />
      <BackupSettings />
      <UpdateSettings />
    </div>
  )
}
