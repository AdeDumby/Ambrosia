export type TrackKind = 'music' | 'sfx'

export type Track = {
  id: number
  path: string
  filename: string
  kind: TrackKind
  durationSec: number
  peakDb: number | null
  loudnessLufs: number | null
  loudnessPeak: number | null
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
  folderOrder: number
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
  filesFound: number
  added: number
  dropped: number
  skipped: number
  tagsCreated: number
  tagsRemoved: number
  problems: ScanProblem[]
}

export type PendingAnalysis = {
  id: number
  filename: string
  durationSec: number
}

export type AnalysisInput =
  { ok: true; integrated: number; peak: number; curve: number[] } | { ok: false; message: string }

export type RestoreResult = {
  restored: number
  unhidden: number
  failed: { filename: string; message: string }[]
}

export type PurgeResult = {
  purged: number
  tagsRemoved: number
}

export type ScanPhase = 'idle' | 'walking' | 'reading' | 'checking' | 'applying'

export type ScanProgress = {
  running: boolean
  phase: ScanPhase
  found: number
  done: number
  total: number | null
  current: string
}

export type ImportPreview = {
  fileName: string
  tracks: number
  tags: number
  folders: number
}

export type BackupEntry = {
  name: string
  path: string
  bytes: number
  modified: number
  manual: boolean
}
