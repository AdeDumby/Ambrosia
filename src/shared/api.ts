import type { Settings } from './settings'
import type { LibraryPaths, ScanReport, Tag, TagCategory, Track, TrackKind } from './types'

export type Api = {
  listCategories(): Promise<TagCategory[]>
  createCategory(name: string, color?: string): Promise<TagCategory>
  reorderCategories(ids: number[]): Promise<void>

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
  deleteTrack(id: number): Promise<void>

  getSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<void>

  getLibraryPaths(): Promise<LibraryPaths>
  chooseLibraryFolder(): Promise<LibraryPaths | null>
  openLibraryFolder(): Promise<void>
  scanLibrary(): Promise<ScanReport>
}
