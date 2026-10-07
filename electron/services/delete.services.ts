import { mkdir, rename, unlink } from 'node:fs/promises'
import type { DatabaseSync } from 'node:sqlite'
import type { DeleteMode } from '../../src/shared/settings.ts'
import type { LibraryPaths } from '../../src/shared/types.ts'
import { moveFileUnique } from './files.services.ts'
import { removeUnusedLooseTags } from './tag.services.ts'

function isMissingFile(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

async function moveToDeletedFolder(
  db: DatabaseSync,
  paths: LibraryPaths,
  id: number,
  source: string
): Promise<void> {
  await mkdir(paths.deletedFolder, { recursive: true })

  let target: string | null = null
  try {
    target = await moveFileUnique(source, paths.deletedFolder)
  } catch (error) {
    if (!isMissingFile(error)) throw error
  }

  try {
    db.prepare('UPDATE track SET deleted = 1, original_path = ?, path = ? WHERE id = ?').run(
      source,
      target ?? source,
      id
    )
  } catch (error) {
    if (target) await rename(target, source).catch(() => {})
    throw error
  }
}

async function erasePermanently(db: DatabaseSync, id: number, source: string): Promise<boolean> {
  try {
    await unlink(source)
  } catch (error) {
    if (!isMissingFile(error)) throw error
  }

  db.exec('BEGIN')
  try {
    const tagIds = (
      db.prepare('SELECT DISTINCT tag_id FROM track_tag WHERE track_id = ?').all(id) as unknown as {
        tag_id: number
      }[]
    ).map((row) => row.tag_id)

    db.prepare('DELETE FROM track WHERE id = ?').run(id)
    const removed = removeUnusedLooseTags(db, tagIds)
    db.exec('COMMIT')
    return removed > 0
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export async function deleteTrackWithFile(
  db: DatabaseSync,
  paths: LibraryPaths,
  mode: DeleteMode,
  id: number
): Promise<boolean> {
  const row = db.prepare('SELECT path, deleted FROM track WHERE id = ?').get(id) as unknown as
    { path: string; deleted: number } | undefined
  if (!row || row.deleted === 1) return false

  if (mode === 'permanent') return erasePermanently(db, id, row.path)

  await moveToDeletedFolder(db, paths, id, row.path)
  return false
}
