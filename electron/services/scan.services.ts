import type { Dirent } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type {
  LibraryPaths,
  ScanCandidate,
  ScanMissing,
  ScanProblem,
  ScanReport
} from '../../src/shared/types.ts'
import { AUDIO_EXTENSIONS } from './audio.services.ts'
import { probeDuration } from './probe.services.ts'

const PROBE_PARALLELISM = 4
const STAT_PARALLELISM = 16

function pathKey(file: string): string {
  const resolved = path.resolve(file)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next++
      results[index] = await work(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function fileStatus(file: string): Promise<'present' | 'missing' | Error> {
  try {
    await stat(file)
    return 'present'
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return 'missing'
    return error instanceof Error ? error : new Error(String(error))
  }
}

async function walk(
  folder: string,
  skipKey: string,
  files: string[],
  problems: ScanProblem[]
): Promise<void> {
  let entries: Dirent[]
  try {
    entries = await readdir(folder, { withFileTypes: true })
  } catch (error) {
    problems.push({ path: folder, message: describe(error) })
    return
  }

  for (const entry of entries) {
    const full = path.join(folder, entry.name)
    if (entry.isDirectory()) {
      if (pathKey(full) !== skipKey) await walk(full, skipKey, files, problems)
    } else if (entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(full)
    }
  }
}

export async function scanLibrary(db: DatabaseSync, paths: LibraryPaths): Promise<ScanReport> {
  const problems: ScanProblem[] = []

  const known = db.prepare('SELECT id, path, filename, deleted FROM track').all() as unknown as {
    id: number
    path: string
    filename: string
    deleted: number
  }[]
  const knownKeys = new Set(known.map((row) => pathKey(row.path)))

  const files: string[] = []
  const libraryFolderExists = await stat(paths.folder).then(
    (info) => info.isDirectory(),
    () => false
  )
  if (libraryFolderExists) {
    await walk(paths.folder, pathKey(paths.deletedFolder), files, problems)
  }

  const unknownFiles = files.filter((file) => !knownKeys.has(pathKey(file)))

  const probed = await mapLimit(unknownFiles, PROBE_PARALLELISM, async (file) => {
    try {
      const [durationSec, info] = await Promise.all([probeDuration(file), stat(file)])
      const candidate: ScanCandidate = {
        path: file,
        filename: path.basename(file),
        durationSec,
        sizeBytes: info.size
      }
      return candidate
    } catch (error) {
      problems.push({ path: file, message: describe(error) })
      return null
    }
  })
  const toAdd = probed.filter((candidate): candidate is ScanCandidate => candidate !== null)

  const statuses = await mapLimit(known, STAT_PARALLELISM, async (row) => ({
    row,
    status: await fileStatus(row.path)
  }))
  const missing: ScanMissing[] = []
  for (const { row, status } of statuses) {
    if (status === 'missing') {
      missing.push({
        id: row.id,
        path: row.path,
        filename: row.filename,
        deleted: row.deleted === 1
      })
    } else if (status !== 'present') {
      problems.push({ path: row.path, message: describe(status) })
    }
  }

  toAdd.sort((a, b) => a.path.localeCompare(b.path))
  missing.sort((a, b) => a.filename.localeCompare(b.filename))
  problems.sort((a, b) => a.path.localeCompare(b.path))

  return {
    libraryFolder: paths.folder,
    libraryFolderExists,
    filesFound: files.length,
    alreadyKnown: files.length - unknownFiles.length,
    toAdd,
    missing,
    problems
  }
}
