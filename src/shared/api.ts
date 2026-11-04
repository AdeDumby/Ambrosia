import type { MissingReport } from './missing.ts'
import type { Settings, YoutubeCookies } from './settings.js'
import type { DownloadState, FinishResult, SignInCheck } from './download.js'
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
  mergeTags(keepId: number, removeId: number, name: string): Promise<string>
  listMixtapes(): Promise<Mixtape[]>
  createMixtape(name: string, master: number, layers: MixtapeLayer[]): Promise<number>
  replaceMixtape(id: number, master: number, layers: MixtapeLayer[]): Promise<void>
  renameMixtape(id: number, name: string): Promise<string>
  deleteMixtape(id: number): Promise<void>
  tagMixtape(id: number, tagId: number): Promise<void>
  untagMixtape(id: number, tagId: number): Promise<boolean>
  addTagToMixtapeByName(id: number, name: string, categoryId?: number | null): Promise<boolean>
  getUpdateInfo(): Promise<UpdateInfo>
  checkForUpdates(): Promise<void>
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
  startDownload(franchise: string, url: string, startAt?: number): Promise<void>
  checkMissingTracks(franchise: string, url: string): Promise<MissingReport>
  downloadMissingTracks(
    franchise: string,
    url: string,
    items: number[],
    playlistTotal: number
  ): Promise<void>
  chooseCookiesFile(): Promise<string | null>
  checkYoutubeSignIn(cookies: YoutubeCookies): Promise<SignInCheck>
  continueDownload(): Promise<void>
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
