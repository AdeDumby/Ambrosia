import type { Dirent } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type {
  LibraryPaths,
  ScanCandidate,
  ScanMissing,
  ScanProblem,
  ScanReport,
  VanishedFolder
} from '../../src/shared/types.ts'
import { AUDIO_EXTENSIONS } from './audio.services.ts'
import { probeDuration } from './probe.services.ts'
import { advanceScan, showScanning, throwIfCancelled, updateScan } from './scan-progress.ts'

const PROBE_PARALLELISM = 4
const STAT_PARALLELISM = 16
const FRANCHISE_FOLDER = 'franchise'

type DirectoryStatus = 'present' | 'gone' | 'unknown'

function pathKey(file: string): string {
  const resolved = path.resolve(file)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function franchiseFor(libraryFolder: string, file: string): string | null {
  const parts = path.relative(libraryFolder, file).split(path.sep)
  return parts.length > 1 ? parts[0] : null
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  let aborted = false

  async function worker(): Promise<void> {
    while (next < items.length && !aborted) {
      try {
        throwIfCancelled()
        const index = next++
        results[index] = await work(items[index])
      } catch (error) {
        aborted = true
        throw error
      }
    }
  }

  const settled = await Promise.allSettled(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  )
  const failed = settled.find(
    (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected'
  )
  if (failed) throw failed.reason
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

function createDirectoryChecker(): (folder: string) => Promise<DirectoryStatus> {
  const cache = new Map<string, Promise<DirectoryStatus>>()
  return (folder) => {
    const key = pathKey(folder)
    let result = cache.get(key)
    if (!result) {
      result = stat(folder).then(
        (info): DirectoryStatus => (info.isDirectory() ? 'present' : 'gone'),
        (error): DirectoryStatus => {
          const code = (error as NodeJS.ErrnoException).code
          return code === 'ENOENT' || code === 'ENOTDIR' ? 'gone' : 'unknown'
        }
      )
      cache.set(key, result)
    }
    return result
  }
}

async function topVanishedFolder(
  folder: string,
  check: (folder: string) => Promise<DirectoryStatus>
): Promise<string> {
  let top = folder
  for (;;) {
    const parent = path.dirname(top)
    if (parent === top || (await check(parent)) !== 'gone') return top
    top = parent
  }
}

async function walk(
  folder: string,
  skipKey: string,
  files: string[],
  problems: ScanProblem[]
): Promise<void> {
  throwIfCancelled()
  let entries: Dirent[]
  try {
    entries = await readdir(folder, { withFileTypes: true })
  } catch (error) {
    problems.push({ path: folder, message: describe(error) })
    return
  }

  for (const entry of entries) {
    throwIfCancelled()
    const full = path.join(folder, entry.name)
    if (entry.isDirectory()) {
      if (pathKey(full) !== skipKey) await walk(full, skipKey, files, problems)
    } else if (entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(full)
      updateScan({ found: files.length, current: entry.name })
    }
  }
}

type KnownRow = {
  id: number
  path: string
  original_path: string | null
  filename: string
  deleted: number
}

export async function scanLibrary(db: DatabaseSync, paths: LibraryPaths): Promise<ScanReport> {
  const problems: ScanProblem[] = []

  const known = db
    .prepare('SELECT id, path, original_path, filename, deleted FROM track')
    .all() as unknown as KnownRow[]

  const knownKeys = new Set<string>()
  for (const row of known) {
    knownKeys.add(pathKey(row.path))
    if (row.deleted === 1 && row.original_path) knownKeys.add(pathKey(row.original_path))
  }

  const files: string[] = []
  const libraryFolderExists = await stat(paths.folder).then(
    (info) => info.isDirectory(),
    () => false
  )
  if (libraryFolderExists) {
    await walk(paths.folder, pathKey(paths.deletedFolder), files, problems)
  }

  const unknownFiles = files.filter((file) => !knownKeys.has(pathKey(file)))

  updateScan({
    phase: 'reading',
    found: files.length,
    done: 0,
    total: unknownFiles.length + known.length,
    current: ''
  })

  const probed = await mapLimit(unknownFiles, PROBE_PARALLELISM, async (file) => {
    showScanning(path.basename(file))
    try {
      const [durationSec, info] = await Promise.all([probeDuration(file), stat(file)])
      const candidate: ScanCandidate = {
        path: file,
        filename: path.basename(file),
        durationSec,
        sizeBytes: info.size,
        franchise: franchiseFor(paths.folder, file)
      }
      return candidate
    } catch (error) {
      problems.push({ path: file, message: describe(error) })
      return null
    } finally {
      advanceScan()
    }
  })
  const toAdd = probed.filter((candidate): candidate is ScanCandidate => candidate !== null)

  updateScan({ phase: 'checking', current: '' })

  const statuses = await mapLimit(known, STAT_PARALLELISM, async (row) => {
    showScanning(row.filename)
    let status = await fileStatus(row.path)
    if (status === 'missing' && row.deleted === 1 && row.original_path) {
      status = await fileStatus(row.original_path)
    }
    advanceScan()
    return { row, status }
  })

  throwIfCancelled()

  const missing: ScanMissing[] = []
  for (const { row, status } of statuses) {
    if (status === 'missing') {
      missing.push({
        id: row.id,
        path: row.path,
        filename: row.filename,
        deleted: row.deleted === 1,
        folderGone: false
      })
    } else if (status !== 'present') {
      problems.push({ path: row.path, message: describe(status) })
    }
  }

  const checkDirectory = createDirectoryChecker()
  const vanishedCounts = new Map<string, number>()
  for (const track of missing) {
    const folder = path.dirname(track.path)
    if ((await checkDirectory(folder)) !== 'gone') continue
    track.folderGone = true
    const top = await topVanishedFolder(folder, checkDirectory)
    vanishedCounts.set(top, (vanishedCounts.get(top) ?? 0) + 1)
  }
  const vanishedFolders: VanishedFolder[] = [...vanishedCounts]
    .map(([folderPath, tracks]) => ({ path: folderPath, tracks }))
    .sort((a, b) => a.path.localeCompare(b.path))

  toAdd.sort((a, b) => a.path.localeCompare(b.path))
  missing.sort((a, b) => a.filename.localeCompare(b.filename))
  problems.sort((a, b) => a.path.localeCompare(b.path))

  const folders = db.prepare('SELECT id, name FROM tag_category').all() as unknown as {
    id: number
    name: string
  }[]
  const franchiseFolderFound = folders.some(
    (folder) => folder.name.toLowerCase() === FRANCHISE_FOLDER
  )

  const existingTags = new Set(
    (db.prepare('SELECT name FROM tag').all() as unknown as { name: string }[]).map((tag) =>
      tag.name.toLowerCase()
    )
  )
  const franchisesToCreate = [
    ...new Set(
      toAdd
        .map((candidate) => candidate.franchise)
        .filter((name): name is string => name !== null && !existingTags.has(name.toLowerCase()))
    )
  ].sort((a, b) => a.localeCompare(b))

  return {
    libraryFolder: paths.folder,
    libraryFolderExists,
    filesFound: files.length,
    alreadyKnown: files.length - unknownFiles.length,
    toAdd,
    missing,
    problems,
    franchiseFolderFound,
    franchisesToCreate,
    vanishedFolders
  }
}
