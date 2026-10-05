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

export function untagTrack(db: DatabaseSync, trackId: number, tagId: number): boolean {
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM track_tag WHERE track_id = ? AND tag_id = ?').run(trackId, tagId)
    const result = db
      .prepare(
        `DELETE FROM tag
         WHERE id = ? AND category_id IS NULL
           AND NOT EXISTS (SELECT 1 FROM track_tag WHERE tag_id = ?)`
      )
      .run(tagId, tagId)
    db.exec('COMMIT')
    return Number(result.changes) > 0
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function addTagToTrackByName(db: DatabaseSync, trackId: number, name: string): boolean {
  db.exec('BEGIN')
  try {
    const existing = db.prepare('SELECT id FROM tag WHERE name = ?').get(name) as unknown as
      { id: number } | undefined

    const tagId = existing
      ? existing.id
      : (
          db
            .prepare('INSERT INTO tag (name, category_id) VALUES (?, NULL) RETURNING id')
            .get(name) as unknown as { id: number }
        ).id

    db.prepare('INSERT OR IGNORE INTO track_tag (track_id, tag_id) VALUES (?, ?)').run(
      trackId,
      tagId
    )
    db.exec('COMMIT')
    return existing === undefined
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function setTagCategory(db: DatabaseSync, tagId: number, categoryId: number | null): void {
  db.prepare('UPDATE tag SET category_id = ? WHERE id = ?').run(categoryId, tagId)
}
