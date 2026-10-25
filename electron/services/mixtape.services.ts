import type { DatabaseSync } from 'node:sqlite'
import {
  MAX_MIXTAPE_NAME,
  cleanMixtapeName,
  sanitizeLayerSettings,
  type Mixtape,
  type MixtapeLayer
} from '../../src/shared/mixtape.ts'
import { foldText, sortTrackTags } from '../../src/shared/tags.ts'
import type { TrackTag } from '../../src/shared/types.ts'

type MixtapeRow = { id: number; name: string; master: number; createdAt: string }
type LayerRow = { mixtapeId: number; trackId: number; settings: string }

function cleanName(raw: string): string {
  const name = cleanMixtapeName(raw)
  if (name === '') throw new Error('Give the mixtape a name.')
  if (name.length > MAX_MIXTAPE_NAME) throw new Error(`Use at most ${MAX_MIXTAPE_NAME} characters.`)
  return name
}

function clampMaster(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1
}

function findMixtapeId(db: DatabaseSync, name: string): number | undefined {
  const key = foldText(name)
  const rows = db.prepare('SELECT id, name FROM mixtape').all() as unknown as {
    id: number
    name: string
  }[]
  return rows.find((row) => foldText(row.name) === key)?.id
}

function readSettings(raw: string) {
  try {
    return sanitizeLayerSettings(JSON.parse(raw))
  } catch {
    return sanitizeLayerSettings(null)
  }
}

export function listMixtapes(db: DatabaseSync): Mixtape[] {
  const rows = db
    .prepare(
      `SELECT id, name, master, created_at AS createdAt FROM mixtape ORDER BY name COLLATE NOCASE`
    )
    .all() as unknown as MixtapeRow[]

  const layerRows = db
    .prepare(
      `SELECT mixtape_id AS mixtapeId, track_id AS trackId, settings
       FROM mixtape_layer ORDER BY mixtape_id, position`
    )
    .all() as unknown as LayerRow[]
  const layersOf = new Map<number, MixtapeLayer[]>()
  for (const row of layerRows) {
    const list = layersOf.get(row.mixtapeId) ?? []
    list.push({ trackId: row.trackId, ...readSettings(row.settings) })
    layersOf.set(row.mixtapeId, list)
  }

  const tagRows = db
    .prepare(
      `SELECT mt.mixtape_id AS mixtapeId, g.id, g.name, c.color, c.sort_order AS folderOrder
       FROM mixtape_tag mt
       JOIN tag g ON g.id = mt.tag_id
       LEFT JOIN tag_category c ON c.id = g.category_id`
    )
    .all() as unknown as (TrackTag & { mixtapeId: number })[]
  const tagsOf = new Map<number, TrackTag[]>()
  for (const { mixtapeId, ...tag } of tagRows) {
    const list = tagsOf.get(mixtapeId) ?? []
    list.push(tag)
    tagsOf.set(mixtapeId, list)
  }

  return rows.map((row) => ({
    ...row,
    layers: layersOf.get(row.id) ?? [],
    tags: sortTrackTags(tagsOf.get(row.id) ?? [])
  }))
}

function writeLayers(db: DatabaseSync, mixtapeId: number, layers: MixtapeLayer[]): number {
  const exists = db.prepare('SELECT 1 AS found FROM track WHERE id = ?')
  const insert = db.prepare(
    'INSERT INTO mixtape_layer (mixtape_id, track_id, position, settings) VALUES (?, ?, ?, ?)'
  )
  let position = 0
  for (const { trackId, ...settings } of layers) {
    // A track that is no longer in the library cannot be a component.
    if (!exists.get(trackId)) continue
    insert.run(mixtapeId, trackId, position, JSON.stringify(sanitizeLayerSettings(settings)))
    position += 1
  }
  return position
}

/** Saves the given layers as a new mixtape. Returns its id. */
export function createMixtape(
  db: DatabaseSync,
  name: string,
  master: number,
  layers: MixtapeLayer[]
): number {
  const cleaned = cleanName(name)
  if (findMixtapeId(db, cleaned) !== undefined) {
    throw new Error('A mixtape with that name already exists.')
  }
  if (layers.length === 0) throw new Error('Add at least one layer first.')

  db.exec('BEGIN')
  try {
    const id = Number(
      db
        .prepare('INSERT INTO mixtape (name, master) VALUES (?, ?)')
        .run(cleaned, clampMaster(master)).lastInsertRowid
    )
    if (writeLayers(db, id, layers) === 0) throw new Error('Add at least one layer first.')
    db.exec('COMMIT')
    return id
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

/** Replaces the components of a mixtape. Its name and tags stay as they are. */
export function replaceMixtape(
  db: DatabaseSync,
  id: number,
  master: number,
  layers: MixtapeLayer[]
): void {
  if (!db.prepare('SELECT 1 FROM mixtape WHERE id = ?').get(id)) {
    throw new Error('That mixtape does not exist.')
  }
  if (layers.length === 0) throw new Error('Add at least one layer first.')

  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM mixtape_layer WHERE mixtape_id = ?').run(id)
    if (writeLayers(db, id, layers) === 0) throw new Error('Add at least one layer first.')
    db.prepare('UPDATE mixtape SET master = ? WHERE id = ?').run(clampMaster(master), id)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function renameMixtape(db: DatabaseSync, id: number, name: string): string {
  const cleaned = cleanName(name)
  const existing = findMixtapeId(db, cleaned)
  if (existing !== undefined && existing !== id) {
    throw new Error('A mixtape with that name already exists.')
  }
  const result = db.prepare('UPDATE mixtape SET name = ? WHERE id = ?').run(cleaned, id)
  if (Number(result.changes) === 0) throw new Error('That mixtape does not exist.')
  return cleaned
}

/** Deletes a mixtape. The tracks in it are not touched. Returns the tags that went with it. */
export function deleteMixtape(db: DatabaseSync, id: number): void {
  db.exec('BEGIN')
  try {
    const tagIds = (
      db
        .prepare('SELECT tag_id AS id FROM mixtape_tag WHERE mixtape_id = ?')
        .all(id) as unknown as {
        id: number
      }[]
    ).map((row) => row.id)
    const result = db.prepare('DELETE FROM mixtape WHERE id = ?').run(id)
    if (Number(result.changes) === 0) throw new Error('That mixtape does not exist.')

    // A tag outside any folder that only this mixtape used disappears with it.
    const unused = db.prepare(
      `DELETE FROM tag
       WHERE id = ? AND category_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM track_tag WHERE tag_id = ?)
         AND NOT EXISTS (SELECT 1 FROM mixtape_tag WHERE tag_id = ?)`
    )
    for (const tagId of tagIds) unused.run(tagId, tagId, tagId)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
