import type { DatabaseSync } from 'node:sqlite'
import type { ApplyResult, LibraryPaths } from '../../src/shared/types.ts'
import { throwIfCancelled, updateScan } from './scan-progress.ts'
import { removeUnusedLooseTags } from './tag.services.ts'
import { scanLibrary } from './scan.services.ts'

const FRANCHISE_FOLDER = 'Franchise'

type IdRow = { id: number }

export async function applyScan(
  db: DatabaseSync,
  paths: LibraryPaths,
  options: { dropMissing?: boolean } = {}
): Promise<ApplyResult> {
  const report = await scanLibrary(db, paths)
  const dropMissing = options.dropMissing ?? true
  const toDrop = dropMissing ? report.missing.filter((track) => !track.folderGone) : []
  throwIfCancelled()
  updateScan({ phase: 'applying', done: 0, total: null, current: '' })

  let added = 0
  let tagsCreated = 0
  let tagsRemoved = 0

  db.exec('BEGIN')
  try {
    if (report.toAdd.length > 0) {
      const franchiseFolder = db
        .prepare('SELECT id FROM tag_category WHERE name = ?')
        .get(FRANCHISE_FOLDER) as unknown as IdRow | undefined

      const sourceFolder = db
        .prepare(
          `INSERT INTO source_folder (path) VALUES (?)
           ON CONFLICT(path) DO UPDATE SET path = excluded.path
           RETURNING id`
        )
        .get(report.libraryFolder) as unknown as IdRow

      const insertTrack = db.prepare(
        `INSERT INTO track (path, filename, kind, duration_sec, size_bytes, source_folder_id)
         VALUES (?, ?, 'music', ?, ?, ?)
         ON CONFLICT(path) DO NOTHING
         RETURNING id`
      )
      const findTag = db.prepare('SELECT id FROM tag WHERE name = ?')
      const insertTag = db.prepare('INSERT INTO tag (name, category_id) VALUES (?, ?) RETURNING id')
      const link = db.prepare('INSERT OR IGNORE INTO track_tag (track_id, tag_id) VALUES (?, ?)')

      const tagIds = new Map<string, number>()
      const franchiseTag = (name: string): number => {
        const key = name.toLowerCase()
        const cached = tagIds.get(key)
        if (cached !== undefined) return cached

        const existing = findTag.get(name) as unknown as IdRow | undefined
        let id: number
        if (existing) {
          id = existing.id
        } else {
          id = (insertTag.get(name, franchiseFolder?.id ?? null) as unknown as IdRow).id
          tagsCreated += 1
        }
        tagIds.set(key, id)
        return id
      }

      for (const file of report.toAdd) {
        const inserted = insertTrack.get(
          file.path,
          file.filename,
          file.durationSec,
          file.sizeBytes,
          sourceFolder.id
        ) as unknown as IdRow | undefined
        if (!inserted) continue
        added += 1
        if (file.franchise) link.run(inserted.id, franchiseTag(file.franchise))
      }

      db.prepare("UPDATE source_folder SET last_scanned_at = datetime('now') WHERE id = ?").run(
        sourceFolder.id
      )
    }

    const tagsOfTrack = db.prepare('SELECT DISTINCT tag_id FROM track_tag WHERE track_id = ?')
    const deleteTrack = db.prepare('DELETE FROM track WHERE id = ?')
    const touchedTags = new Set<number>()
    for (const track of toDrop) {
      const rows = tagsOfTrack.all(track.id) as unknown as { tag_id: number }[]
      for (const row of rows) touchedTags.add(row.tag_id)
      deleteTrack.run(track.id)
    }

    tagsRemoved = removeUnusedLooseTags(db, touchedTags)

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return {
    added,
    dropped: toDrop.length,
    skipped: dropMissing ? report.missing.length - toDrop.length : 0,
    tagsCreated,
    tagsRemoved,
    problems: report.problems,
    filesFound: report.filesFound
  }
}
