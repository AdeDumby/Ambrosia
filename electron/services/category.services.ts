import type { DatabaseSync } from 'node:sqlite'

export type TagCategory = {
  id: number
  name: string
  color: string
  sortOrder: number
}

const MAX_NAME = 40

export function createCategory(db: DatabaseSync, name: string, color = '#888888'): TagCategory {
  const trimmed = name.trim()
  if (trimmed === '') throw new Error('Give the folder a name.')
  if (trimmed.length > MAX_NAME) throw new Error(`Use at most ${MAX_NAME} characters.`)

  const taken = db.prepare('SELECT 1 FROM tag_category WHERE name = ? COLLATE NOCASE').get(trimmed)
  if (taken) throw new Error('A folder with that name already exists.')

  const row = db
    .prepare(
      `INSERT INTO tag_category (name, color, sort_order)
       VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tag_category))
       RETURNING id, name, color, sort_order AS sortOrder`
    )
    .get(trimmed, color)
  return row as unknown as TagCategory
}

export function listCategories(db: DatabaseSync): TagCategory[] {
  const rows = db
    .prepare(
      `SELECT id, name, color, sort_order AS sortOrder
       FROM tag_category
       ORDER BY sort_order, name`
    )
    .all()
  return rows as unknown as TagCategory[]
}

export function reorderCategories(db: DatabaseSync, orderedIds: number[]): void {
  const rows = db.prepare('SELECT id FROM tag_category').all() as unknown as { id: number }[]
  const existing = new Set(rows.map((row) => row.id))

  const isExactSet =
    orderedIds.length === existing.size &&
    new Set(orderedIds).size === orderedIds.length &&
    orderedIds.every((id) => existing.has(id))
  if (!isExactSet) throw new Error('Invalid category order')

  const update = db.prepare('UPDATE tag_category SET sort_order = ? WHERE id = ?')
  db.exec('BEGIN')
  try {
    orderedIds.forEach((id, position) => update.run(position, id))
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
