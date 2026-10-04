import type { DatabaseSync } from 'node:sqlite'
import type { NewTrack, Track, TrackTag } from '../../src/shared/types.ts'

type TrackRow = Omit<Track, 'reviewed' | 'tags'> & { reviewed: number }

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

  const tagRows = db
    .prepare(
      `SELECT tt.track_id AS trackId, g.id, g.name, c.color
       FROM track_tag tt
       JOIN tag g ON g.id = tt.tag_id
       LEFT JOIN tag_category c ON c.id = g.category_id
       ORDER BY c.sort_order IS NULL, c.sort_order, c.name, g.name COLLATE NOCASE`
    )
    .all() as unknown as (TrackTag & { trackId: number })[]

  const tagsByTrack = new Map<number, TrackTag[]>()
  for (const { trackId, ...tag } of tagRows) {
    const list = tagsByTrack.get(trackId) ?? []
    list.push(tag)
    tagsByTrack.set(trackId, list)
  }

  return rows.map((row) => ({
    ...row,
    reviewed: row.reviewed === 1,
    tags: tagsByTrack.get(row.id) ?? []
  }))
}
