import type { DatabaseSync } from 'node:sqlite'
import { MAX_FOLDER_NAME, isProtectedFolder } from '../../src/shared/folders.ts'

export type TagCategory = {
  id: number
  name: string
  color: string
  sortOrder: number
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i

function checkName(db: DatabaseSync, name: string, ignoreId?: number): string {
  const trimmed = name.trim()
  if (trimmed === '') throw new Error('Give the folder a name.')
  if (trimmed.length > MAX_FOLDER_NAME)
    throw new Error(`Use at most ${MAX_FOLDER_NAME} characters.`)
  if (isProtectedFolder(trimmed)) throw new Error('That name is reserved.')

  const taken = db
    .prepare('SELECT id FROM tag_category WHERE name = ? COLLATE NOCASE')
    .get(trimmed) as unknown as { id: number } | undefined
  if (taken && taken.id !== ignoreId) throw new Error('A folder with that name already exists.')
  return trimmed
}

function getFolder(db: DatabaseSync, id: number): TagCategory {
  const folder = db
    .prepare('SELECT id, name, color, sort_order AS sortOrder FROM tag_category WHERE id = ?')
    .get(id) as unknown as TagCategory | undefined
  if (!folder) throw new Error('That folder does not exist.')
  return folder
}

function assertEditable(db: DatabaseSync, id: number): TagCategory {
  const folder = getFolder(db, id)
  if (isProtectedFolder(folder.name)) throw new Error('The Franchise folder cannot be changed.')
  return folder
}

function editHiddenFolders(db: DatabaseSync, edit: (names: string[]) => string[]): void {
  const row = db.prepare("SELECT value FROM setting WHERE key = 'settings'").get() as unknown as
    { value: string } | undefined
  if (!row) return

  let settings: Record<string, unknown>
  try {
    settings = JSON.parse(row.value)
  } catch {
    return
  }

  const apply = (value: unknown): unknown =>
    Array.isArray(value)
      ? edit(value.filter((item): item is string => typeof item === 'string'))
      : value

  const review = settings.review as Record<string, unknown> | undefined
  if (review) review.hiddenFolders = apply(review.hiddenFolders)

  if (Array.isArray(settings.presets)) {
    for (const preset of settings.presets as Record<string, unknown>[]) {
      if (preset) preset.hiddenFolders = apply(preset.hiddenFolders)
    }
  }

  db.prepare("UPDATE setting SET value = ? WHERE key = 'settings'").run(JSON.stringify(settings))
}

export function createCategory(db: DatabaseSync, name: string, color = '#888888'): TagCategory {
  const trimmed = checkName(db, name)
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

export function renameCategory(db: DatabaseSync, id: number, name: string): void {
  const folder = assertEditable(db, id)
  const trimmed = checkName(db, name, id)
  if (trimmed === folder.name) return

  db.exec('BEGIN')
  try {
    db.prepare('UPDATE tag_category SET name = ? WHERE id = ?').run(trimmed, id)
    editHiddenFolders(db, (names) =>
      names.map((item) => (item.toLowerCase() === folder.name.toLowerCase() ? trimmed : item))
    )
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function recolorCategory(db: DatabaseSync, id: number, color: string): void {
  assertEditable(db, id)
  if (!HEX_COLOR.test(color)) throw new Error('Invalid color.')
  db.prepare('UPDATE tag_category SET color = ? WHERE id = ?').run(color.toLowerCase(), id)
}

export function deleteCategory(db: DatabaseSync, id: number, withTags: boolean): void {
  const folder = assertEditable(db, id)

  db.exec('BEGIN')
  try {
    if (withTags) {
      db.prepare('DELETE FROM tag WHERE category_id = ?').run(id)
    } else {
      db.prepare('UPDATE tag SET category_id = NULL WHERE category_id = ?').run(id)
    }
    db.prepare('DELETE FROM tag_category WHERE id = ?').run(id)
    editHiddenFolders(db, (names) =>
      names.filter((item) => item.toLowerCase() !== folder.name.toLowerCase())
    )
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
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
