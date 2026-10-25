import type { Settings } from './settings.js'
import type { DownloadState, FinishResult } from './download.js'
import type { UpdateInfo } from './update.js'
import type { Mixtape, MixtapeLayer } from './mixtape.js'
import type {
  AnalysisInput,
  ApplyResult,
  LibraryPaths,
  PendingAnalysis,
  RestoreResult,
  ScanReport,
  Tag,
  TagCategory,
  Track,
  TrackKind,
  ScanProgress,
  BackupEntry,
  ImportPreview,
  EmptyDeletedResult
} from './types.js'

export type Api = {
  listCategories(): Promise<TagCategory[]>
  createCategory(name: string, color?: string): Promise<TagCategory>
  reorderCategories(ids: number[]): Promise<void>
  renameCategory(id: number, name: string): Promise<void>
  recolorCategory(id: number, color: string): Promise<void>
  deleteCategory(id: number, withTags: boolean): Promise<void>

  listTags(): Promise<Tag[]>
  createTag(name: string, categoryId: number | null): Promise<Tag>
  tagTrack(trackId: number, tagId: number): Promise<void>
  untagTrack(trackId: number, tagId: number): Promise<boolean>
  addTagToTrackByName(trackId: number, name: string, categoryId?: number | null): Promise<boolean>
  setTagCategory(tagId: number, categoryId: number | null): Promise<void>
  renameTag(id: number, name: string): Promise<string>
  /** Merges the second tag into the first, which takes the new name. Returns the cleaned name. */
  mergeTags(keepId: number, removeId: number, name: string): Promise<string>
  listMixtapes(): Promise<Mixtape[]>
  /** Saves layers as a new mixtape. Returns its id. */
  createMixtape(name: string, master: number, layers: MixtapeLayer[]): Promise<number>
  /** Replaces the components of a mixtape. Its name and tags are kept. */
  replaceMixtape(id: number, master: number, layers: MixtapeLayer[]): Promise<void>
  renameMixtape(id: number, name: string): Promise<string>
  deleteMixtape(id: number): Promise<void>
  tagMixtape(id: number, tagId: number): Promise<void>
  /** Returns true when the tag was deleted because nothing uses it any more. */
  untagMixtape(id: number, tagId: number): Promise<boolean>
  /** Returns true when a new tag was created. */
  addTagToMixtapeByName(id: number, name: string, categoryId?: number | null): Promise<boolean>
  getUpdateInfo(): Promise<UpdateInfo>
  /** Looks for a newer version. The result arrives as update state events. */
  checkForUpdates(): Promise<void>
  /** Closes the app and installs the downloaded update, then starts it again. */
  installUpdate(): Promise<void>

  listTracks(): Promise<Track[]>
  getTrack(id: number): Promise<Track | null>
  setTrackKind(id: number, kind: TrackKind): Promise<void>
  setTrackReviewed(id: number, reviewed: boolean): Promise<void>
  renameTrack(id: number, name: string): Promise<string>
  deleteTrack(id: number): Promise<void>
  emptyDeletedFolder(): Promise<EmptyDeletedResult>

  getSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<void>

  getLibraryPaths(): Promise<LibraryPaths>
  chooseLibraryFolder(): Promise<LibraryPaths | null>
  openLibraryFolder(): Promise<void>
  scanLibrary(): Promise<ScanReport>
  applyScan(): Promise<ApplyResult>

  listPendingAnalysis(): Promise<PendingAnalysis[]>
  saveAnalysis(id: number, input: AnalysisInput): Promise<void>
  clearAnalysisErrors(): Promise<void>

  countDeletedTracks(): Promise<number>
  restoreDeletedTracks(): Promise<RestoreResult>

  getScanProgress(): Promise<ScanProgress>
  cancelScan(): Promise<void>

  getDownloadState(): Promise<DownloadState>
  startDownload(franchise: string, url: string): Promise<void>
  cancelDownload(): Promise<void>
  resetDownload(): Promise<void>
  getDownloadFolderNames(): Promise<string[]>
  finishDownload(entries: { index: number; name: string }[]): Promise<FinishResult>
  applyDownloads(): Promise<ApplyResult>

  listBackups(): Promise<BackupEntry[]>
  backupNow(): Promise<string>
  openBackupFolder(): Promise<void>
  chooseBackupFile(): Promise<ImportPreview | null>
  restoreBackup(path: string | null): Promise<void>

  controlWindow(action: 'minimize' | 'maximize' | 'close'): Promise<void>
  getWindowState(): Promise<{ maximized: boolean }>
}
