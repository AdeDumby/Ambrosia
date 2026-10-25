import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { BackupEntry, ImportPreview } from '../../src/shared/types.ts'
import { removeEmptyLooseTags } from './tag.services.ts'

const DELETE_ORDER = [
  'mixtape_layer',
  'mixtape_tag',
  'mixtape',
  'track_tag',
  'track',
  'tag',
  'tag_category',
  'source_folder',
  'setting'
]
const INSERT_ORDER = [...DELETE_ORDER].reverse()
const REQUIRED_TABLES = ['track', 'tag', 'tag_category', 'track_tag', 'source_folder']
const LOCAL_SETTINGS = ['library-folder', 'zoom-factor']
const KEEP_AUTOMATIC = 10
const DAILY_MS = 24 * 60 * 60 * 1000

class ImportError extends Error {}

type Named = { name: string }

const quote = (text: string) => `'${text.replace(/'/g, "''")}'`
const ident = (name: string) => `"${name.replace(/"/g, '""')}"`
const localKeys = LOCAL_SETTINGS.map(quote).join(', ')
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-')

export function samePath(a: string, b: string): boolean {
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase()
}

export function exportDatabase(db: DatabaseSync, file: string): void {
  mkdirSync(path.dirname(file), { recursive: true })
  rmSync(file, { force: true })
  db.exec(`VACUUM INTO ${quote(file)}`)
}

function tablesOf(db: DatabaseSync, schema: string): string[] {
  const rows = db
    .prepare(`SELECT name FROM ${schema}.sqlite_master WHERE type = 'table'`)
    .all() as unknown as Named[]
  return rows.map((row) => row.name)
}

function columnsOf(db: DatabaseSync, schema: string, table: string): string[] {
  const rows = db
    .prepare(`PRAGMA ${schema}.table_info(${ident(table)})`)
    .all() as unknown as Named[]
  return rows.map((row) => row.name)
}

export function inspectDatabase(file: string): ImportPreview {
  let source: DatabaseSync | null = null
  try {
    source = new DatabaseSync(file, { readOnly: true })
    const check = source.prepare('PRAGMA quick_check').get() as Record<string, unknown>
    if (Object.values(check)[0] !== 'ok') throw new ImportError('That database file is damaged.')

    const names = new Set(tablesOf(source, 'main'))
    const columns = columnsOf(source, 'main', 'track')
    if (
      !REQUIRED_TABLES.every((table) => names.has(table)) ||
      !columns.includes('path') ||
      !columns.includes('filename')
    ) {
      throw new ImportError('That file is not an Ambrosia library database.')
    }

    const reader = source
    const count = (table: string) =>
      (reader.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as unknown as { n: number }).n
    return {
      fileName: path.basename(file),
      tracks: count('track'),
      tags: count('tag'),
      folders: count('tag_category')
    }
  } catch (error) {
    if (error instanceof ImportError) throw error
    throw new ImportError('That file is not an Ambrosia library database.')
  } finally {
    source?.close()
  }
}

export function importDatabase(db: DatabaseSync, file: string): void {
  db.exec(`ATTACH DATABASE ${quote(file)} AS imported`)
  try {
    const incoming = new Set(tablesOf(db, 'imported'))

    db.exec('BEGIN')
    try {
      for (const table of DELETE_ORDER) {
        const keep = table === 'setting' ? ` WHERE key NOT IN (${localKeys})` : ''
        db.exec(`DELETE FROM main.${ident(table)}${keep}`)
      }

      for (const table of INSERT_ORDER) {
        if (!incoming.has(table)) continue
        const theirs = new Set(columnsOf(db, 'imported', table))
        const shared = columnsOf(db, 'main', table)
          .filter((column) => theirs.has(column))
          .map(ident)
          .join(', ')
        const filter = table === 'setting' ? ` WHERE key NOT IN (${localKeys})` : ''
        db.exec(
          `INSERT INTO main.${ident(table)} (${shared}) SELECT ${shared} FROM imported.${ident(table)}${filter}`
        )
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  } finally {
    db.exec('DETACH DATABASE imported')
  }
  removeEmptyLooseTags(db)
}

function listFiles(folder: string, prefix: string): BackupEntry[] {
  let names: string[]
  try {
    names = readdirSync(folder)
  } catch {
    return []
  }
  return names
    .filter((name) => name.startsWith(prefix) && name.endsWith('.db'))
    .map((name) => {
      const full = path.join(folder, name)
      const info = statSync(full)
      return {
        name,
        path: full,
        bytes: info.size,
        modified: info.mtimeMs,
        manual: prefix !== 'auto-'
      }
    })
}

export function listBackups(backupFolder: string, manualFolder: string): BackupEntry[] {
  return [...listFiles(backupFolder, 'auto-'), ...listFiles(manualFolder, 'ambrosia-backup-')]
    .concat(listFiles(backupFolder, 'manual-'))
    .sort((a, b) => b.modified - a.modified)
}

function prune(backupFolder: string): void {
  const automatic = listFiles(backupFolder, 'auto-').sort((a, b) => b.modified - a.modified)
  for (const old of automatic.slice(KEEP_AUTOMATIC)) rmSync(old.path, { force: true })
}

export function backupBefore(db: DatabaseSync, backupFolder: string, reason: string): string {
  const file = path.join(backupFolder, `auto-${reason}-${stamp()}.db`)
  exportDatabase(db, file)
  prune(backupFolder)
  return file
}

export function backupIfDue(db: DatabaseSync, backupFolder: string): string | null {
  const newest = listFiles(backupFolder, 'auto-').sort((a, b) => b.modified - a.modified)[0]
  if (newest && Date.now() - newest.modified < DAILY_MS) return null
  return backupBefore(db, backupFolder, 'daily')
}

export function backupNow(db: DatabaseSync, backupFolder: string, manualFolder: string): string {
  backupFolder
  const file = path.join(manualFolder, `ambrosia-backup-${stamp()}.db`)
  exportDatabase(db, file)
  return file
}
