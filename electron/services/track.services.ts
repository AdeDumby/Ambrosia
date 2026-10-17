import path from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { sortTrackTags } from '../../src/shared/tags.ts'
import type { NewTrack, Track, TrackKind, TrackTag } from '../../src/shared/types.ts'

type TrackRow = Omit<Track, 'reviewed' | 'tags'> & { reviewed: number }

const TRACK_COLUMNS = `id, path, filename, kind,
  duration_sec AS durationSec, peak_db AS peakDb,
  loudness_lufs AS loudnessLufs, loudness_peak AS loudnessPeak,
  size_bytes AS sizeBytes, reviewed, added_at AS addedAt`

const TAG_FIELDS = 'g.id, g.name, c.color, c.sort_order AS folderOrder'

function toTrack(row: TrackRow, tags: TrackTag[]): Track {
  return {
    ...row,
    filename: path.basename(row.path),
    reviewed: row.reviewed === 1,
    tags: sortTrackTags(tags)
  }
}

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
      `SELECT ${TRACK_COLUMNS} FROM track WHERE deleted = 0 ORDER BY filename COLLATE NOCASE`
    )
    .all() as unknown as TrackRow[]

  const tagRows = db
    .prepare(
      `SELECT tt.track_id AS trackId, ${TAG_FIELDS}
       FROM track_tag tt
       JOIN tag g ON g.id = tt.tag_id
       LEFT JOIN tag_category c ON c.id = g.category_id`
    )
    .all() as unknown as (TrackTag & { trackId: number })[]

  const tagsByTrack = new Map<number, TrackTag[]>()
  for (const { trackId, ...tag } of tagRows) {
    const list = tagsByTrack.get(trackId) ?? []
    list.push(tag)
    tagsByTrack.set(trackId, list)
  }

  return rows.map((row) => toTrack(row, tagsByTrack.get(row.id) ?? []))
}

export function getTrack(db: DatabaseSync, id: number): Track | null {
  const row = db
    .prepare(`SELECT ${TRACK_COLUMNS} FROM track WHERE id = ? AND deleted = 0`)
    .get(id) as unknown as TrackRow | undefined
  if (!row) return null

  const tags = db
    .prepare(
      `SELECT ${TAG_FIELDS}
       FROM track_tag tt
       JOIN tag g ON g.id = tt.tag_id
       LEFT JOIN tag_category c ON c.id = g.category_id
       WHERE tt.track_id = ?`
    )
    .all(id) as unknown as TrackTag[]

  return toTrack(row, tags)
}

export function setTrackKind(db: DatabaseSync, id: number, kind: TrackKind): void {
  db.prepare('UPDATE track SET kind = ? WHERE id = ?').run(kind, id)
}

export function setTrackReviewed(db: DatabaseSync, id: number, reviewed: boolean): void {
  db.prepare('UPDATE track SET reviewed = ? WHERE id = ?').run(reviewed ? 1 : 0, id)
}

export function getTrackPath(db: DatabaseSync, id: number): string | null {
  const row = db.prepare('SELECT path FROM track WHERE id = ?').get(id) as unknown as
    { path: string } | undefined
  return row ? row.path : null
}
