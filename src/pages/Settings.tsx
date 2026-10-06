import { useEffect, useState } from 'react'
import ColorField from '../components/item/ColorField'
import PathField from '../components/item/PathField'
import SegmentedControl from '../components/item/SegmentedControl'
import SettingsSection from '../components/item/SettingsSection'
import { useSettings } from '../store/SettingsContext'
import type { DeleteMode, Density } from '../shared/settings'
import type { LibraryPaths } from '../shared/types'
import './Settings.css'

const densityOptions: { value: Density; label: string }[] = [
  { value: 'spacey', label: 'Spacey' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' }
]

const deleteModeOptions: { value: DeleteMode; label: string }[] = [
  { value: 'deleted-folder', label: 'Move to _Deleted' },
  { value: 'permanent', label: 'Delete permanently' }
]

const deleteModeHelp: Record<DeleteMode, string> = {
  'deleted-folder':
    'Deleted tracks are moved into the _Deleted folder so you can clean them up by hand. A later scan forgets the ones that are no longer there.',
  permanent: 'Deleted tracks are erased from the disk right away and cannot be recovered.'
}

export default function Settings() {
  const { settings, updateAppearance, resetAppearance, updateLibrary } = useSettings()
  const { appearance, library } = settings

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
      <SettingsSection
        title="Library"
        description="Where new music goes. Tracks already in your library stay where they are."
      >
        <PathField label="Library folder" path={paths?.folder ?? null}>
          <button type="button" className="btn" onClick={chooseFolder}>
            Choose folder...
          </button>
          <button type="button" className="btn" onClick={openFolder}>
            Open folder
          </button>
        </PathField>

        <PathField label="Deleted files" path={paths?.deletedFolder ?? null} />

        {libraryError && (
          <p className="settings-error" role="alert">
            {libraryError}
          </p>
        )}

        <div className="settings-row">
          <span>When deleting a track</span>
          <SegmentedControl<DeleteMode>
            label="Delete behavior"
            value={library.deleteMode}
            onChange={(deleteMode) => updateLibrary({ deleteMode })}
            options={deleteModeOptions}
          />
        </div>
        <p className="settings-hint">{deleteModeHelp[library.deleteMode]}</p>
      </SettingsSection>

      <SettingsSection
        title="Appearance"
        description="Changes apply immediately and are saved automatically."
      >
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
    </div>
  )
}
