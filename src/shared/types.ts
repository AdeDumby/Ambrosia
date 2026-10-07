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

export type LibraryPaths = {
  folder: string
  deletedFolder: string
}

export type ScanProblem = {
  path: string
  message: string
}

export type ScanCandidate = {
  path: string
  filename: string
  durationSec: number
  sizeBytes: number
  franchise: string | null
}

export type ScanMissing = {
  id: number
  path: string
  filename: string
  deleted: boolean
  folderGone: boolean
}

export type VanishedFolder = {
  path: string
  tracks: number
}

export type ScanReport = {
  libraryFolder: string
  libraryFolderExists: boolean
  filesFound: number
  alreadyKnown: number
  toAdd: ScanCandidate[]
  missing: ScanMissing[]
  problems: ScanProblem[]
  franchiseFolderFound: boolean
  franchisesToCreate: string[]
  vanishedFolders: VanishedFolder[]
}

export type ApplyResult = {
  added: number
  dropped: number
  skipped: number
  tagsCreated: number
  tagsRemoved: number
  problems: ScanProblem[]
}
