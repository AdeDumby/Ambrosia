import type { DatabaseSync } from 'node:sqlite'
import type { NewTrack, Track, TrackKind, TrackTag } from '../../src/shared/types.ts'

type TrackRow = Omit<Track, 'reviewed' | 'tags'> & { reviewed: number }

const TRACK_COLUMNS = `id, path, filename, kind,
  duration_sec AS durationSec, peak_db AS peakDb,
  size_bytes AS sizeBytes, reviewed, added_at AS addedAt`

const TAG_ORDER = `c.sort_order IS NULL, c.sort_order, c.name, g.name COLLATE NOCASE`

function toTrack(row: TrackRow, tags: TrackTag[]): Track {
  return { ...row, reviewed: row.reviewed === 1, tags }
}

export function setTrackKind(db: DatabaseSync, id: number, kind: TrackKind): void {
  db.prepare('UPDATE track SET kind = ? WHERE id = ?').run(kind, id)
}

export function listTracks(db: DatabaseSync): Track[] {
  const rows = db
    .prepare(
      `SELECT ${TRACK_COLUMNS} FROM track WHERE deleted = 0 ORDER BY filename COLLATE NOCASE`
    )
    .all() as unknown as TrackRow[]

  const tagRows = db
    .prepare(
      `SELECT tt.track_id AS trackId, g.id, g.name, c.color
       FROM track_tag tt
       JOIN tag g ON g.id = tt.tag_id
       LEFT JOIN tag_category c ON c.id = g.category_id
       ORDER BY ${TAG_ORDER}`
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
    .get(id) as TrackRow | undefined
  if (!row) return null

  const tags = db
    .prepare(
      `SELECT g.id, g.name, c.color
       FROM track_tag tt
       JOIN tag g ON g.id = tt.tag_id
       LEFT JOIN tag_category c ON c.id = g.category_id
       WHERE tt.track_id = ?
       ORDER BY ${TAG_ORDER}`
    )
    .all(id) as unknown as TrackTag[]

  return toTrack(row, tags)
}

export function deleteTrack(db: DatabaseSync, id: number): void {
  db.prepare('UPDATE track SET deleted = 1 WHERE id = ?').run(id)
}

export function getTrackPath(db: DatabaseSync, id: number): string | null {
  const row = db.prepare('SELECT path FROM track WHERE id = ?').get(id) as unknown as
    { path: string } | undefined
  return row ? row.path : null
}
