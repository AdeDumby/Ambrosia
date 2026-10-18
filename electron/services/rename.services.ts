import { rename, stat } from 'node:fs/promises'
import path from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { MAX_FILE_STEM } from '../../src/shared/files.ts'

const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f]/
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
const MAX_PATH = 259

type TrackRow = { path: string; filename: string; deleted: number }

function checkStem(raw: string): string {
  const stem = raw.trim()
  if (stem === '') throw new Error('Give the track a name.')
  if (stem.length > MAX_FILE_STEM) throw new Error(`Use at most ${MAX_FILE_STEM} characters.`)
  if (FORBIDDEN.test(stem)) {
    throw new Error(
      'A file name cannot contain slashes, colons, quotes, asterisks, question marks, angle brackets or pipes.'
    )
  }
  if (RESERVED.test(stem.split('.')[0])) throw new Error('That name is reserved by Windows.')
  return stem
}

function explain(error: unknown): Error {
  const code = (error as NodeJS.ErrnoException).code
  if (code === 'ENOENT' || code === 'ENOTDIR') {
    return new Error('The file cannot be found, so nothing was renamed.')
  }
  if (code === 'EPERM' || code === 'EBUSY' || code === 'EACCES') {
    return new Error('The file is in use or protected, so it was not renamed.')
  }
  return error instanceof Error ? error : new Error(String(error))
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return false
    throw explain(error)
  }
}

export async function renameTrack(db: DatabaseSync, id: number, name: string): Promise<string> {
  const row = db
    .prepare('SELECT path, filename, deleted FROM track WHERE id = ?')
    .get(id) as unknown as TrackRow | undefined
  if (!row || row.deleted === 1) throw new Error('That track does not exist.')

  const stem = checkStem(name)
  const newName = stem + path.extname(row.path)
  const newPath = path.join(path.dirname(row.path), newName)
  if (newPath.length > MAX_PATH) throw new Error('The path would be too long.')

  const sameFile = newPath.toLowerCase() === row.path.toLowerCase()
  if (!sameFile) {
    const other = db
      .prepare('SELECT id FROM track WHERE lower(path) = lower(?) AND id != ?')
      .get(newPath, id)
    if (other) throw new Error('Another track already uses that name.')
    if (await exists(newPath)) {
      throw new Error('A file with that name already exists in this folder.')
    }
  }

  if (newPath !== row.path) {
    try {
      await rename(row.path, newPath)
    } catch (error) {
      throw explain(error)
    }
  }

  try {
    db.prepare('UPDATE track SET filename = ?, path = ? WHERE id = ?').run(newName, newPath, id)
  } catch (error) {
    if (newPath !== row.path) await rename(newPath, row.path).catch(() => {})
    throw error
  }
  return newName
}
