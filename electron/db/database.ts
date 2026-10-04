import { DatabaseSync } from 'node:sqlite'
import { SCHEMA } from './schema.ts'

export function openDatabase(file: string): DatabaseSync {
  const db = new DatabaseSync(file)
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(SCHEMA)
  return db
}
