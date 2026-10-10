import { DatabaseSync } from 'node:sqlite'
import { SCHEMA } from './schema.ts'

function addColumnIfMissing(
  db: DatabaseSync,
  table: string,
  column: string,
  definition: string
): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as {
    name: string
  }[]
  if (!columns.some((existing) => existing.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
}

export function openDatabase(file: string): DatabaseSync {
  const db = new DatabaseSync(file)
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(SCHEMA)
  addColumnIfMissing(db, 'track', 'deleted', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing(db, 'track', 'original_path', 'TEXT')
  addColumnIfMissing(db, 'track', 'loudness_lufs', 'REAL')
  addColumnIfMissing(db, 'track', 'loudness_peak', 'REAL')
  addColumnIfMissing(db, 'track', 'loudness_curve', 'TEXT')
  addColumnIfMissing(db, 'track', 'analysis_error', 'TEXT')
  addColumnIfMissing(db, 'track', 'analyzed_at', 'TEXT')
  return db
}
