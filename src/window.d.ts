import type { Tag, TagCategory, Track, TrackKind } from './shared/types'

declare global {
  interface Window {
    api: {
      listCategories(): Promise<TagCategory[]>
      createCategory(name: string, color?: string): Promise<TagCategory>
      reorderCategories(ids: number[]): Promise<void>
      listTags(): Promise<Tag[]>
      createTag(name: string, categoryId: number | null): Promise<Tag>
      tagTrack(trackId: number, tagId: number): Promise<void>
      untagTrack(trackId: number, tagId: number): Promise<boolean>
      addTagToTrackByName(trackId: number, name: string): Promise<boolean>
      listTracks(): Promise<Track[]>
      getTrack(id: number): Promise<Track | null>
      setTrackKind(id: number, kind: TrackKind): Promise<void>
      deleteTrack(id: number): Promise<void>
      setTagCategory(tagId: number, categoryId: number | null): Promise<void>
      setTrackReviewed(id: number, reviewed: boolean): Promise<void>
    }
  }
}
