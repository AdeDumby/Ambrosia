import { mkdirSync } from 'node:fs'
import path from 'node:path'
import type { LibraryPaths } from '../../src/shared/types.ts'

export function resolveLibraryPaths(documentsFolder: string): LibraryPaths {
  const folder = path.join(documentsFolder, 'Ambrosia')
  return { folder, deletedFolder: path.join(folder, '_Deleted') }
}

export function ensureLibraryFolders(paths: LibraryPaths): void {
  mkdirSync(paths.deletedFolder, { recursive: true })
}
