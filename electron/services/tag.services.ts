import type { DatabaseSync } from 'node:sqlite'
import { MAX_TAG_NAME, foldText, formatTagName } from '../../src/shared/tags.ts'

export type Tag = {
  id: number
  name: string
  categoryId: number | null
}

function cleanTagName(raw: string, ignoreId?: number): string {
  ignoreId
  const name = formatTagName(raw)
  if (name === '') throw new Error('Give the tag a name.')
  if (name.length > MAX_TAG_NAME) throw new Error(`Use at most ${MAX_TAG_NAME} characters.`)
  return name
}

function findTagId(db: DatabaseSync, name: string): number | undefined {
  const key = foldText(name)
  const rows = db.prepare('SELECT id, name FROM tag').all() as unknown as {
    id: number
    name: string
  }[]
  return rows.find((row) => foldText(row.name) === key)?.id
}

export function createTag(db: DatabaseSync, name: string, categoryId: number | null): Tag {
  const cleaned = cleanTagName(name)
  if (findTagId(db, cleaned) !== undefined) throw new Error('A tag with that name already exists.')
  return db
    .prepare(
      `INSERT INTO tag (name, category_id) VALUES (?, ?)
       RETURNING id, name, category_id AS categoryId`
    )
    .get(cleaned, categoryId) as unknown as Tag
}

export function renameTag(db: DatabaseSync, id: number, name: string): string {
  const cleaned = cleanTagName(name)
  const existing = findTagId(db, cleaned)
  if (existing !== undefined && existing !== id) {
    throw new Error('A tag with that name already exists.')
  }
  const result = db.prepare('UPDATE tag SET name = ? WHERE id = ?').run(cleaned, id)
  if (Number(result.changes) === 0) throw new Error('That tag does not exist.')
  return cleaned
}

/**
 * Merges `removeId` into `keepId`: every track that had the removed tag gets the kept one
 * (no duplicates), the removed tag is deleted, and the kept tag takes the new name.
 * The kept tag keeps its folder. The new name may be one of the two old names.
 */
export function mergeTags(
  db: DatabaseSync,
  keepId: number,
  removeId: number,
  name: string,
  beforeChange?: () => void
): string {
  if (keepId === removeId) throw new Error('Choose two different tags.')
  const cleaned = cleanTagName(name)

  const found = db.prepare('SELECT id FROM tag WHERE id IN (?, ?)').all(keepId, removeId)
  if (found.length !== 2) throw new Error('That tag does not exist.')

  const taken = findTagId(db, cleaned)
  if (taken !== undefined && taken !== keepId && taken !== removeId) {
    throw new Error('A tag with that name already exists.')
  }

  // Runs only once the merge is known to be valid, so a refused merge makes no backup.
  beforeChange?.()

  db.exec('BEGIN')
  try {
    db.prepare(
      `INSERT OR IGNORE INTO track_tag (track_id, tag_id)
       SELECT track_id, ? FROM track_tag WHERE tag_id = ?`
    ).run(keepId, removeId)
    db.prepare('DELETE FROM track_tag WHERE tag_id = ?').run(removeId)
    db.prepare('DELETE FROM tag WHERE id = ?').run(removeId)
    db.prepare('UPDATE tag SET name = ? WHERE id = ?').run(cleaned, keepId)
    db.exec('COMMIT')
    return cleaned
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
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

export function addTagToTrackByName(
  db: DatabaseSync,
  trackId: number,
  name: string,
  categoryId: number | null = null
): boolean {
  db.exec('BEGIN')
  try {
    const cleaned = cleanTagName(name)
    const existingId = findTagId(db, cleaned)

    const tagId =
      existingId ??
      (
        db
          .prepare('INSERT INTO tag (name, category_id) VALUES (?, ?) RETURNING id')
          .get(cleaned, categoryId) as unknown as { id: number }
      ).id

    db.prepare('INSERT OR IGNORE INTO track_tag (track_id, tag_id) VALUES (?, ?)').run(
      trackId,
      tagId
    )
    db.exec('COMMIT')
    return existingId === undefined
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function removeEmptyLooseTags(db: DatabaseSync): number {
  const result = db
    .prepare(
      `DELETE FROM tag
       WHERE category_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM track_tag WHERE tag_id = tag.id)`
    )
    .run()
  return Number(result.changes)
}

export function setTagCategory(db: DatabaseSync, tagId: number, categoryId: number | null): void {
  db.prepare('UPDATE tag SET category_id = ? WHERE id = ?').run(categoryId, tagId)
  if (categoryId === null) removeEmptyLooseTags(db)
}

export function removeUnusedLooseTags(db: DatabaseSync, tagIds: Iterable<number>): number {
  const remove = db.prepare(
    `DELETE FROM tag
     WHERE id = ? AND category_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM track_tag WHERE tag_id = ?)`
  )
  let removed = 0
  for (const id of tagIds) removed += Number(remove.run(id, id).changes)
  return removed
}
