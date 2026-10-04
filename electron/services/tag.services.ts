import type { DatabaseSync } from 'node:sqlite'

export type Tag = {
  id: number
  name: string
  categoryId: number | null
}

export function createTag(db: DatabaseSync, name: string, categoryId: number | null): Tag {
  const row = db
    .prepare(
      `INSERT INTO tag (name, category_id) VALUES (?, ?)
       RETURNING id, name, category_id AS categoryId`
    )
    .get(name, categoryId)
  return row as unknown as Tag
}

export function listTags(db: DatabaseSync): Tag[] {
  const rows = db.prepare(`SELECT id, name, category_id AS categoryId FROM tag ORDER BY name`).all()
  return rows as unknown as Tag[]
}

export function tagTrack(db: DatabaseSync, trackId: number, tagId: number): void {
  db.prepare(`INSERT OR IGNORE INTO track_tag (track_id, tag_id) VALUES (?, ?)`).run(trackId, tagId)
}

export function untagTrack(db: DatabaseSync, trackId: number, tagId: number): void {
  db.prepare('DELETE FROM track_tag WHERE track_id = ? AND tag_id = ?').run(trackId, tagId)
}
