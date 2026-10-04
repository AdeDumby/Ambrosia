import type { DatabaseSync } from 'node:sqlite'

export type TagCategory = {
  id: number
  name: string
  color: string
  sortOrder: number
}

export function createCategory(db: DatabaseSync, name: string, color = '#888888'): TagCategory {
  const row = db
    .prepare(
      `INSERT INTO tag_category (name, color) VALUES (?, ?)
       RETURNING id, name, color, sort_order AS sortOrder`
    )
    .get(name, color)
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
