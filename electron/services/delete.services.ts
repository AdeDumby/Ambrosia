import { mkdir, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type { EmptyDeletedResult, LibraryPaths } from '../../src/shared/types.ts'
import { moveFileUnique } from './files.services.ts'
import { forgetTracks } from './purge.services.ts'

const DELETED_FOLDER_NAME = '_deleted'

function isMissingFile(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

function describe(error: unknown): string {
  const code = (error as NodeJS.ErrnoException).code
  if (code === 'EPERM' || code === 'EBUSY' || code === 'EACCES') {
    return 'The file is in use or protected.'
  }
  return error instanceof Error ? error.message : String(error)
}

export async function deleteTrackWithFile(
  db: DatabaseSync,
  paths: LibraryPaths,
  id: number
): Promise<void> {
  const row = db.prepare('SELECT path, deleted FROM track WHERE id = ?').get(id) as unknown as
    { path: string; deleted: number } | undefined
  if (!row || row.deleted === 1) return

  await mkdir(paths.deletedFolder, { recursive: true })

  let target: string | null = null
  try {
    target = await moveFileUnique(row.path, paths.deletedFolder)
  } catch (error) {
    if (!isMissingFile(error)) throw error
  }

  try {
    db.prepare('UPDATE track SET deleted = 1, original_path = ?, path = ? WHERE id = ?').run(
      row.path,
      target ?? row.path,
      id
    )
  } catch (error) {
    if (target) await rename(target, row.path).catch(() => {})
    throw error
  }
}

export async function emptyDeletedFolder(db: DatabaseSync): Promise<EmptyDeletedResult> {
  const rows = db
    .prepare('SELECT id, path, filename FROM track WHERE deleted = 1')
    .all() as unknown as { id: number; path: string; filename: string }[]

  const failed: EmptyDeletedResult['failed'] = []
  const forgotten: number[] = []

  for (const row of rows) {
    if (path.basename(path.dirname(row.path)).toLowerCase() !== DELETED_FOLDER_NAME) continue
    try {
      await unlink(row.path)
    } catch (error) {
      if (!isMissingFile(error)) {
        failed.push({ filename: row.filename, message: describe(error) })
        continue
      }
    }
    forgotten.push(row.id)
  }

  const tagsRemoved = forgetTracks(db, forgotten)
  return { erased: forgotten.length, failed, tagsRemoved }
}
