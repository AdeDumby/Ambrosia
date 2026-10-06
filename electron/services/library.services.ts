import { mkdirSync } from 'node:fs'
import path from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type { LibraryPaths } from '../../src/shared/types.ts'

const FOLDER_KEY = 'library-folder'

function pathsFor(folder: string): LibraryPaths {
  return { folder, deletedFolder: path.join(folder, '_Deleted') }
}

export function getLibraryPaths(db: DatabaseSync, documentsFolder: string): LibraryPaths {
  const row = db.prepare('SELECT value FROM setting WHERE key = ?').get(FOLDER_KEY) as unknown as
    { value: string } | undefined
  const stored = row?.value
  const folder = stored && path.isAbsolute(stored) ? stored : path.join(documentsFolder, 'Ambrosia')
  return pathsFor(folder)
}

export function ensureLibraryFolders(paths: LibraryPaths): void {
  mkdirSync(paths.deletedFolder, { recursive: true })
}

export function setLibraryFolder(db: DatabaseSync, folder: string): LibraryPaths {
  const paths = pathsFor(path.resolve(folder))
  ensureLibraryFolders(paths)
  db.prepare(
    `INSERT INTO setting (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(FOLDER_KEY, paths.folder)
  return paths
}
