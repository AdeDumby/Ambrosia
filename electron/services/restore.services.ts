import { mkdir, rename, stat } from 'node:fs/promises'
import path from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type { RestoreResult } from '../../src/shared/types.ts'
import { moveFileUnique } from './files.services.ts'

type DeletedRow = { id: number; path: string; original_path: string | null; filename: string }

async function fileExists(file: string): Promise<boolean> {
  try {
    await stat(file)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return !(code === 'ENOENT' || code === 'ENOTDIR')
  }
}

export function countDeletedTracks(db: DatabaseSync): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM track WHERE deleted = 1').get() as unknown as {
    n: number
  }
  return row.n
}

export async function restoreDeletedTracks(db: DatabaseSync): Promise<RestoreResult> {
  const rows = db
    .prepare('SELECT id, path, original_path, filename FROM track WHERE deleted = 1 ORDER BY id')
    .all() as unknown as DeletedRow[]

  const result: RestoreResult = { restored: 0, unhidden: 0, failed: [] }
  const restore = db.prepare(
    'UPDATE track SET deleted = 0, path = ?, original_path = NULL WHERE id = ?'
  )
  const unhide = db.prepare('UPDATE track SET deleted = 0 WHERE id = ?')

  for (const row of rows) {
    try {
      if (!row.original_path) {
        if (await fileExists(row.path)) {
          unhide.run(row.id)
          result.unhidden += 1
        } else {
          result.failed.push({ filename: row.filename, message: 'The file no longer exists' })
        }
        continue
      }

      if (await fileExists(row.path)) {
        const folder = path.dirname(row.original_path)
        await mkdir(folder, { recursive: true })
        const target = await moveFileUnique(row.path, folder, path.basename(row.original_path))
        try {
          restore.run(target, row.id)
        } catch (error) {
          await rename(target, row.path).catch(() => {})
          throw error
        }
        result.restored += 1
      } else if (await fileExists(row.original_path)) {
        restore.run(row.original_path, row.id)
        result.restored += 1
      } else {
        result.failed.push({
          filename: row.filename,
          message: 'The file is in neither _Deleted nor its original folder'
        })
      }
    } catch (error) {
      result.failed.push({
        filename: row.filename,
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return result
}
