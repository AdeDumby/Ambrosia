import { stat } from 'node:fs/promises'
import type { DatabaseSync } from 'node:sqlite'
import type { PurgeResult } from '../../src/shared/types.ts'
import { removeUnusedLooseTags } from './tag.services.ts'

type DeletedRow = { id: number; path: string; original_path: string | null }

async function present(file: string): Promise<boolean> {
  try {
    await stat(file)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return !(code === 'ENOENT' || code === 'ENOTDIR')
  }
}

export async function purgeGoneDeletedTracks(db: DatabaseSync): Promise<PurgeResult> {
  const rows = db
    .prepare('SELECT id, path, original_path FROM track WHERE deleted = 1')
    .all() as unknown as DeletedRow[]

  const gone: number[] = []
  for (const row of rows) {
    const inPlace = await present(row.path)
    const inOriginal = row.original_path ? await present(row.original_path) : false
    if (!inPlace && !inOriginal) gone.push(row.id)
  }

  let tagsRemoved = 0
  db.exec('BEGIN')
  try {
    const tagsOf = db.prepare('SELECT DISTINCT tag_id FROM track_tag WHERE track_id = ?')
    const remove = db.prepare('DELETE FROM track WHERE id = ?')
    const touched = new Set<number>()
    for (const id of gone) {
      for (const row of tagsOf.all(id) as unknown as { tag_id: number }[]) {
        touched.add(row.tag_id)
      }
      remove.run(id)
    }
    tagsRemoved = removeUnusedLooseTags(db, touched)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return { purged: gone.length, tagsRemoved }
}
