import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_LAYER_SETTINGS, type MixtapeLayer } from '../../src/shared/mixtape.ts'
import { SCHEMA } from '../db/schema.ts'
import {
  createMixtape,
  deleteMixtape,
  listMixtapes,
  renameMixtape,
  replaceMixtape
} from './mixtape.services.ts'
import {
  addTagToMixtapeByName,
  mergeTags,
  removeEmptyLooseTags,
  tagMixtape,
  untagMixtape
} from './tag.services.ts'

let db: DatabaseSync

function addTrack(name: string): number {
  return Number(
    db
      .prepare(`INSERT INTO track (path, filename, kind, source_folder_id) VALUES (?, ?, 'sfx', 1)`)
      .run(`/music/${name}.mp3`, `${name}.mp3`).lastInsertRowid
  )
}

function addTag(name: string, categoryId: number | null = null): number {
  return Number(
    db.prepare('INSERT INTO tag (name, category_id) VALUES (?, ?)').run(name, categoryId)
      .lastInsertRowid
  )
}

const layer = (trackId: number, change: Partial<MixtapeLayer> = {}): MixtapeLayer => ({
  trackId,
  ...DEFAULT_LAYER_SETTINGS,
  ...change
})

function tagNames(): string[] {
  return (
    db.prepare('SELECT name FROM tag ORDER BY name').all() as unknown as { name: string }[]
  ).map((row) => row.name)
}

let rain: number
let birds: number
let theme: number

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(SCHEMA)
  db.prepare(`INSERT INTO source_folder (id, path) VALUES (1, '/music')`).run()
  rain = addTrack('rain')
  birds = addTrack('birds')
  theme = addTrack('theme')
})

describe('mixtapes', () => {
  it('saves the components with their settings, in order', () => {
    const id = createMixtape(db, '  Rainy   forest ', 0.8, [
      layer(theme, { volume: 0.5, loop: true }),
      layer(rain, { volume: 0.3, pan: -0.5, reverb: 0.4, startAt: 2, endAt: 9 }),
      layer(birds)
    ])

    const [mixtape] = listMixtapes(db)
    expect(mixtape.id).toBe(id)
    expect(mixtape.name).toBe('Rainy forest')
    expect(mixtape.master).toBe(0.8)
    expect(mixtape.layers.map((item) => item.trackId)).toEqual([theme, rain, birds])
    expect(mixtape.layers[0]).toMatchObject({ volume: 0.5, loop: true })
    expect(mixtape.layers[1]).toMatchObject({ pan: -0.5, reverb: 0.4, startAt: 2, endAt: 9 })
    expect(mixtape.tags).toEqual([])
  })

  it('lists mixtapes by name', () => {
    createMixtape(db, 'zebra', 1, [layer(rain)])
    createMixtape(db, 'Apple', 1, [layer(rain)])
    expect(listMixtapes(db).map((item) => item.name)).toEqual(['Apple', 'zebra'])
  })

  it('refuses an empty name, a long name, or a name already used (ignoring case and accents)', () => {
    createMixtape(db, 'Café', 1, [layer(rain)])
    expect(() => createMixtape(db, '   ', 1, [layer(rain)])).toThrow(/name/)
    expect(() => createMixtape(db, 'x'.repeat(61), 1, [layer(rain)])).toThrow(/at most/)
    expect(() => createMixtape(db, 'cafe', 1, [layer(rain)])).toThrow(/already exists/)
    expect(listMixtapes(db)).toHaveLength(1)
  })

  it('refuses a mixtape with no component, and saves nothing', () => {
    expect(() => createMixtape(db, 'Empty', 1, [])).toThrow(/at least one/)
    expect(() => createMixtape(db, 'Gone', 1, [layer(9999)])).toThrow(/at least one/)
    expect(listMixtapes(db)).toEqual([])
  })

  it('skips a track that no longer exists but keeps the others', () => {
    createMixtape(db, 'Mix', 1, [layer(9999), layer(rain)])
    expect(listMixtapes(db)[0].layers.map((item) => item.trackId)).toEqual([rain])
  })

  it('keeps the master volume inside 0 to 1', () => {
    createMixtape(db, 'Loud', 5, [layer(rain)])
    expect(listMixtapes(db)[0].master).toBe(1)
  })

  it('replaces the components and keeps the name and tags', () => {
    const id = createMixtape(db, 'Mix', 1, [layer(rain), layer(birds)])
    addTagToMixtapeByName(db, id, 'forest')
    replaceMixtape(db, id, 0.4, [layer(theme, { volume: 0.9 })])

    const [mixtape] = listMixtapes(db)
    expect(mixtape.name).toBe('Mix')
    expect(mixtape.master).toBe(0.4)
    expect(mixtape.layers.map((item) => item.trackId)).toEqual([theme])
    expect(mixtape.layers[0].volume).toBe(0.9)
    expect(mixtape.tags.map((tag) => tag.name)).toEqual(['Forest'])
  })

  it('keeps the old components when a replacement fails', () => {
    const id = createMixtape(db, 'Mix', 1, [layer(rain)])
    expect(() => replaceMixtape(db, id, 1, [layer(9999)])).toThrow(/at least one/)
    expect(listMixtapes(db)[0].layers.map((item) => item.trackId)).toEqual([rain])
    expect(() => replaceMixtape(db, 12345, 1, [layer(rain)])).toThrow(/does not exist/)
  })

  it('renames, but not to the name of another mixtape', () => {
    const first = createMixtape(db, 'First', 1, [layer(rain)])
    createMixtape(db, 'Second', 1, [layer(rain)])
    expect(renameMixtape(db, first, '  Primero ')).toBe('Primero')
    expect(renameMixtape(db, first, 'PRIMERO')).toBe('PRIMERO')
    expect(() => renameMixtape(db, first, 'second')).toThrow(/already exists/)
    expect(() => renameMixtape(db, 999, 'Nope')).toThrow(/does not exist/)
  })

  it('deletes a mixtape without touching its tracks', () => {
    const id = createMixtape(db, 'Mix', 1, [layer(rain), layer(birds)])
    deleteMixtape(db, id)
    expect(listMixtapes(db)).toEqual([])
    const count = db.prepare('SELECT COUNT(*) AS n FROM track').get() as unknown as { n: number }
    expect(count.n).toBe(3)
    expect(() => deleteMixtape(db, id)).toThrow(/does not exist/)
  })

  it('drops a component when its track is deleted for good', () => {
    createMixtape(db, 'Mix', 1, [layer(rain), layer(birds)])
    db.prepare('DELETE FROM track WHERE id = ?').run(rain)
    expect(listMixtapes(db)[0].layers.map((item) => item.trackId)).toEqual([birds])
  })
})

describe('tags on mixtapes', () => {
  it('adds an existing tag, and a new one by name', () => {
    const id = createMixtape(db, 'Mix', 1, [layer(rain)])
    const calm = addTag('Calm', null)
    tagMixtape(db, id, calm)
    expect(addTagToMixtapeByName(db, id, 'night sky')).toBe(true)
    expect(addTagToMixtapeByName(db, id, 'CALM')).toBe(false)
    expect(
      listMixtapes(db)[0]
        .tags.map((tag) => tag.name)
        .sort()
    ).toEqual(['Calm', 'Night Sky'])
  })

  it('removes a loose tag that nothing else uses, and keeps one that a track uses', () => {
    const id = createMixtape(db, 'Mix', 1, [layer(rain)])
    const lonely = addTag('Lonely')
    const shared = addTag('Shared')
    tagMixtape(db, id, lonely)
    tagMixtape(db, id, shared)
    db.prepare('INSERT INTO track_tag (track_id, tag_id) VALUES (?, ?)').run(rain, shared)

    expect(untagMixtape(db, id, lonely)).toBe(true)
    expect(untagMixtape(db, id, shared)).toBe(false)
    expect(tagNames()).toEqual(['Shared'])
  })

  it('does not clean up a loose tag that only a mixtape uses', () => {
    const id = createMixtape(db, 'Mix', 1, [layer(rain)])
    tagMixtape(db, id, addTag('OnlyMixtape'))
    expect(removeEmptyLooseTags(db)).toBe(0)
    expect(tagNames()).toEqual(['OnlyMixtape'])
  })

  it('keeps a tag in a folder even when nothing uses it', () => {
    const id = createMixtape(db, 'Mix', 1, [layer(rain)])
    db.prepare(`INSERT INTO tag_category (id, name) VALUES (1, 'Mood')`).run()
    const calm = addTag('Calm', 1)
    tagMixtape(db, id, calm)
    expect(untagMixtape(db, id, calm)).toBe(false)
    expect(tagNames()).toEqual(['Calm'])
  })

  it('deleting a mixtape removes the loose tags only it used', () => {
    const id = createMixtape(db, 'Mix', 1, [layer(rain)])
    tagMixtape(db, id, addTag('Ghost'))
    deleteMixtape(db, id)
    expect(tagNames()).toEqual([])
  })

  it('merging two tags moves them on mixtapes, without a duplicate', () => {
    const first = createMixtape(db, 'First', 1, [layer(rain)])
    const second = createMixtape(db, 'Second', 1, [layer(rain)])
    const third = createMixtape(db, 'Third', 1, [layer(rain)])
    const forest = addTag('Forest')
    const woods = addTag('Woods')
    tagMixtape(db, first, woods)
    tagMixtape(db, second, forest)
    tagMixtape(db, second, woods)
    tagMixtape(db, third, forest)

    expect(mergeTags(db, forest, woods, 'Wild Woods')).toBe('Wild Woods')

    const byName = new Map(
      listMixtapes(db).map((item) => [item.name, item.tags.map((tag) => tag.name)])
    )
    expect(byName.get('First')).toEqual(['Wild Woods'])
    expect(byName.get('Second')).toEqual(['Wild Woods'])
    expect(byName.get('Third')).toEqual(['Wild Woods'])
  })
})
