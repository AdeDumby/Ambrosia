import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_LAYER_SETTINGS } from '../../src/shared/mixtape.ts'
import { SCHEMA } from '../db/schema.ts'
import { exportDatabase, importDatabase } from './backup.services.ts'
import { createMixtape, listMixtapes } from './mixtape.services.ts'
import { tagMixtape } from './tag.services.ts'

let folder: string

function openLibrary(trackName: string): { db: DatabaseSync; trackId: number } {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(SCHEMA)
  db.prepare(`INSERT INTO source_folder (id, path) VALUES (1, '/music')`).run()
  const trackId = Number(
    db
      .prepare(`INSERT INTO track (path, filename, kind, source_folder_id) VALUES (?, ?, 'sfx', 1)`)
      .run(`/music/${trackName}.mp3`, `${trackName}.mp3`).lastInsertRowid
  )
  return { db, trackId }
}

beforeEach(() => {
  folder = mkdtempSync(path.join(tmpdir(), 'ambrosia-backup-'))
})

afterEach(() => {
  rmSync(folder, { recursive: true, force: true })
})

describe('backups and mixtapes', () => {
  it('brings back mixtapes, their components and their tags', () => {
    const source = openLibrary('rain')
    const id = createMixtape(source.db, 'Rainy', 0.7, [
      { trackId: source.trackId, ...DEFAULT_LAYER_SETTINGS, volume: 0.4, loop: true }
    ])
    const tag = Number(
      source.db.prepare(`INSERT INTO tag (name) VALUES ('Calm')`).run().lastInsertRowid
    )
    tagMixtape(source.db, id, tag)
    const file = path.join(folder, 'backup.db')
    exportDatabase(source.db, file)

    const target = openLibrary('other')
    createMixtape(target.db, 'Will be replaced', 1, [
      { trackId: target.trackId, ...DEFAULT_LAYER_SETTINGS }
    ])
    importDatabase(target.db, file)

    const [mixtape] = listMixtapes(target.db)
    expect(listMixtapes(target.db)).toHaveLength(1)
    expect(mixtape.name).toBe('Rainy')
    expect(mixtape.master).toBe(0.7)
    expect(mixtape.layers[0]).toMatchObject({ volume: 0.4, loop: true })
    expect(mixtape.tags.map((item) => item.name)).toEqual(['Calm'])
  })

  it('restores a backup made before mixtapes existed, with no mixtape in it', () => {
    const source = openLibrary('rain')
    const file = path.join(folder, 'old.db')
    exportDatabase(source.db, file)
    const old = new DatabaseSync(file)
    old.exec('DROP TABLE mixtape_layer; DROP TABLE mixtape_tag; DROP TABLE mixtape;')
    old.close()

    const target = openLibrary('other')
    createMixtape(target.db, 'Current', 1, [{ trackId: target.trackId, ...DEFAULT_LAYER_SETTINGS }])
    importDatabase(target.db, file)

    expect(listMixtapes(target.db)).toEqual([])
  })
})
