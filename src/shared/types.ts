export type TrackKind = 'music' | 'sfx'

export type Track = {
  id: number
  path: string
  filename: string
  kind: TrackKind
  durationSec: number
  peakDb: number | null
  sizeBytes: number
  reviewed: boolean
  addedAt: string
  tags: TrackTag[]
}

export type NewTrack = {
  path: string
  filename: string
  kind: TrackKind
  durationSec: number
  peakDb: number | null
  sizeBytes: number
  sourceFolderId: number
}

export type TrackTag = {
  id: number
  name: string
  color: string | null
}

export type TagCategory = {
  id: number
  name: string
  color: string
  sortOrder: number
}

export type Tag = {
  id: number
  name: string
  categoryId: number | null
}
