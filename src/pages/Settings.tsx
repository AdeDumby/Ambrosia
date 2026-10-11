import { useEffect, useState } from 'react'
import { useLibrary } from '../store/LibraryContext'
import { useAnalysis } from '../store/AnalysisContext'
import { useSettings } from '../store/SettingsContext'
import PathField from '../components/item/PathField'
import ColorField from '../components/item/ColorField'
import ConfirmDialog from '../components/item/ConfirmDialog'
import SettingsSection from '../components/item/SettingsSection'
import SegmentedControl from '../components/item/SegmentedControl'
import AnalysisPanel from '../components/feature/AnalysisPanel'
import ReviewSettings from '../components/feature/ReviewSettings'
import ScanReportView from '../components/feature/ScanReportView'
import PresetSettings from '../components/feature/PresetSettings'
import PlaybackSettings from '../components/feature/PlaybackSettings'
import TrackListSettings from '../components/feature/TrackListSettings'
import RestoreDeletedPanel from '../components/feature/RestoreDeletedPanel'
import type { ApplyResult, LibraryPaths, ScanReport } from '../shared/types'
import type { AppearanceMode, DeleteMode, Density } from '../shared/settings'
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

const deleteModeOptions: { value: DeleteMode; label: string }[] = [
  { value: 'deleted-folder', label: 'Move to _Deleted' },
  { value: 'permanent', label: 'Delete permanently' }
]

const deleteModeHelp: Record<DeleteMode, string> = {
  'deleted-folder':
    'Deleted tracks are moved into the _Deleted folder so you can clean them up by hand. A later scan forgets the ones that are no longer there.',
  permanent: 'Deleted tracks are erased from the disk right away and cannot be recovered.'
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function droppableCount(report: ScanReport): number {
  return report.missing.filter((track) => !track.folderGone).length
}

function confirmMessage(report: ScanReport): string {
  const actions: string[] = []
  if (report.toAdd.length > 0) actions.push(`add ${plural(report.toAdd.length, 'new track')}`)
  const dropped = droppableCount(report)
  if (dropped > 0) actions.push(`remove ${plural(dropped, 'missing track')} from the library`)

  let message = `This will ${actions.join(' and ')}. Files on disk are not touched. Tags without a folder that end up on no track are removed too.`
  const skipped = report.missing.length - dropped
  if (skipped > 0) {
    message += ` ${plural(skipped, 'track')} in missing folders will be left alone.`
  }
  return message
}

function describeResult(result: ApplyResult): string {
  const parts = [`${result.added} added`, `${result.dropped} dropped`]
  if (result.skipped > 0) parts.push(`${result.skipped} left alone in missing folders`)
  if (result.tagsCreated > 0) parts.push(`${plural(result.tagsCreated, 'new tag')}`)
  if (result.tagsRemoved > 0) parts.push(`${plural(result.tagsRemoved, 'unused tag')} removed`)
  return `Done: ${parts.join(', ')}.`
}

export default function Settings() {
  const { settings, updateAppearance, resetAppearance, updateLibrary } = useSettings()
  const { refreshTracks, refreshTags } = useLibrary()
  const { appearance, library } = settings

  const [paths, setPaths] = useState<LibraryPaths | null>(null)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [report, setReport] = useState<ScanReport | null>(null)
  const [scanning, setScanning] = useState(false)
  const [applying, setApplying] = useState(false)
  const [confirmingApply, setConfirmingApply] = useState(false)
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null)
  const { start: startAnalysis } = useAnalysis()

  useEffect(() => {
    window.api
      .getLibraryPaths()
      .then(setPaths)
      .catch(() => setLibraryError('Could not read the library location.'))
  }, [])

  const canApply = report !== null && (report.toAdd.length > 0 || droppableCount(report) > 0)

  async function chooseFolder() {
    setLibraryError(null)
    try {
      const chosen = await window.api.chooseLibraryFolder()
      if (chosen) {
        setPaths(chosen)
        setReport(null)
        setApplyResult(null)
      }
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

  async function scan() {
    setLibraryError(null)
    setApplyResult(null)
    setScanning(true)
    try {
      setReport(await window.api.scanLibrary())
    } catch {
      setReport(null)
      setLibraryError('The scan failed. Check that the library folder is available.')
    } finally {
      setScanning(false)
    }
  }

  async function applyScan() {
    setConfirmingApply(false)
    setLibraryError(null)
    setApplying(true)

    let result: ApplyResult
    try {
      result = await window.api.applyScan()
    } catch {
      setLibraryError('Applying the scan failed, and nothing was changed.')
      setApplying(false)
      return
    }

    setApplyResult(result)
    try {
      await Promise.all([refreshTracks(), refreshTags()])
      setReport(await window.api.scanLibrary())
    } catch {
      setLibraryError(
        'The changes were applied, but the view could not be refreshed. Reload the window.'
      )
    }
    setApplying(false)
    void startAnalysis()
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
        <RestoreDeletedPanel />
        <div className="settings-row">
          <span>Look for new and missing files</span>
          <div className="settings-actions">
            <button type="button" className="btn" disabled={scanning || applying} onClick={scan}>
              {scanning ? 'Scanning...' : 'Scan library'}
            </button>
            {canApply && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={scanning || applying}
                onClick={() => setConfirmingApply(true)}
              >
                {applying ? 'Applying...' : 'Apply changes'}
              </button>
            )}
          </div>
        </div>
        <p className="settings-hint">
          A file that was moved or renamed counts as one removed track and one new track, so it
          starts again without its tags.
        </p>
        <AnalysisPanel />

        {libraryError && (
          <p className="settings-error" role="alert">
            {libraryError}
          </p>
        )}

        {applyResult && (
          <p className="settings-success" role="status">
            {describeResult(applyResult)}
          </p>
        )}

        {report && <ScanReportView report={report} />}
      </SettingsSection>
      <PresetSettings />
      <SettingsSection
        title="Appearance"
        description="Changes apply immediately and are saved automatically."
      >
        <div className="settings-row">
          <span>Theme</span>
          <SegmentedControl<AppearanceMode>
            label="Theme mode"
            value={appearance.mode}
            onChange={(mode) => updateAppearance({ mode })}
            options={modeOptions}
          />
        </div>
        <p className="settings-hint">
          The colors below are your base palette. In the other mode, the app converts them
          automatically.
        </p>
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
      <ConfirmDialog
        open={confirmingApply}
        title="Apply the scan?"
        message={report ? confirmMessage(report) : ''}
        confirmLabel="Apply"
        cancelLabel="Cancel"
        onConfirm={applyScan}
        onCancel={() => setConfirmingApply(false)}
      />
    </div>
  )
}
