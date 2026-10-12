import type { Settings } from './settings'
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
  PurgeResult,
  ScanProgress
} from './types'

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

  listTracks(): Promise<Track[]>
  getTrack(id: number): Promise<Track | null>
  setTrackKind(id: number, kind: TrackKind): Promise<void>
  setTrackReviewed(id: number, reviewed: boolean): Promise<void>
  renameTrack(id: number, name: string): Promise<string>
  deleteTrack(id: number): Promise<boolean>

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
  purgeGoneDeletedTracks(): Promise<PurgeResult>

  getScanProgress(): Promise<ScanProgress>
  cancelScan(): Promise<void>
}
