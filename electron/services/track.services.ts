import type { DatabaseSync } from 'node:sqlite'
import type { NewTrack, Track } from '../../src/shared/types.ts'

type TrackRow = Omit<Track, 'reviewed'> & { reviewed: number }

export function upsertTrack(db: DatabaseSync, t: NewTrack): number {
  const row = db
    .prepare(
      `INSERT INTO track (path, filename, kind, duration_sec, peak_db, size_bytes, source_folder_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET
         filename = excluded.filename,
         kind = excluded.kind,
         duration_sec = excluded.duration_sec,
         peak_db = excluded.peak_db,
         size_bytes = excluded.size_bytes
       RETURNING id`
    )
    .get(t.path, t.filename, t.kind, t.durationSec, t.peakDb, t.sizeBytes, t.sourceFolderId)
  return (row as unknown as { id: number }).id
}

export function listTracks(db: DatabaseSync): Track[] {
  const rows = db
    .prepare(
      `SELECT id, path, filename, kind,
              duration_sec AS durationSec, peak_db AS peakDb,
              size_bytes AS sizeBytes, reviewed, added_at AS addedAt
       FROM track
       ORDER BY filename COLLATE NOCASE`
    )
    .all() as unknown as TrackRow[]

  return rows.map((row) => ({ ...row, reviewed: row.reviewed === 1 }))
}
