import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SCHEMA } from '../db/schema.ts'
import { mergeTags } from './tag.services.ts'

let db: DatabaseSync

function addTag(name: string, categoryId: number | null = null): number {
  return Number(
    db.prepare('INSERT INTO tag (name, category_id) VALUES (?, ?)').run(name, categoryId)
      .lastInsertRowid
  )
}

function addTrack(name: string, tagIds: number[]): number {
  const id = Number(
    db
      .prepare(
        `INSERT INTO track (path, filename, kind, source_folder_id) VALUES (?, ?, 'music', 1)`
      )
      .run(`/music/${name}.mp3`, `${name}.mp3`).lastInsertRowid
  )
  for (const tagId of tagIds) {
    db.prepare('INSERT INTO track_tag (track_id, tag_id) VALUES (?, ?)').run(id, tagId)
  }
  return id
}

function tagsOf(trackId: number): string[] {
  const rows = db
    .prepare(
      `SELECT tag.name FROM track_tag JOIN tag ON tag.id = track_tag.tag_id
       WHERE track_id = ? ORDER BY tag.name`
    )
    .all(trackId) as unknown as { name: string }[]
  return rows.map((row) => row.name)
}

function allTagNames(): string[] {
  const rows = db.prepare('SELECT name FROM tag ORDER BY name').all() as unknown as {
    name: string
  }[]
  return rows.map((row) => row.name)
}

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(SCHEMA)
  db.exec(`INSERT INTO source_folder (id, path) VALUES (1, '/music')`)
  db.exec(`INSERT INTO tag_category (id, name) VALUES (1, 'Mood'), (2, 'Scene')`)
})

describe('mergeTags', () => {
  it('moves every track to the kept tag, deletes the other, and renames', () => {
    const forest = addTag('Forest', 1)
    const woods = addTag('Woods', 2)
    const a = addTrack('a', [forest])
    const b = addTrack('b', [woods])

    expect(mergeTags(db, forest, woods, 'wild woods')).toBe('Wild Woods')

    expect(allTagNames()).toEqual(['Wild Woods'])
    expect(tagsOf(a)).toEqual(['Wild Woods'])
    expect(tagsOf(b)).toEqual(['Wild Woods'])
  })

  it('keeps the folder of the first tag', () => {
    const forest = addTag('Forest', 1)
    const woods = addTag('Woods', 2)
    mergeTags(db, forest, woods, 'Forest')
    const row = db
      .prepare('SELECT category_id AS categoryId FROM tag WHERE id = ?')
      .get(forest) as {
      categoryId: number
    }
    expect(row.categoryId).toBe(1)
  })

  it('does not duplicate the tag on tracks that had both', () => {
    const forest = addTag('Forest')
    const woods = addTag('Woods')
    const both = addTrack('both', [forest, woods])
    const other = addTrack('other', [woods, addTag('Calm')])

    mergeTags(db, forest, woods, 'Forest')

    expect(tagsOf(both)).toEqual(['Forest'])
    expect(tagsOf(other)).toEqual(['Calm', 'Forest'])
  })

  it('accepts the name of either tag being merged', () => {
    const forest = addTag('Forest')
    const woods = addTag('Woods')
    addTrack('a', [woods])
    expect(mergeTags(db, forest, woods, 'woods')).toBe('Woods')
    expect(allTagNames()).toEqual(['Woods'])
  })

  it('refuses a name used by a third tag and changes nothing', () => {
    const forest = addTag('Forest')
    const woods = addTag('Woods')
    addTag('Calm')
    const a = addTrack('a', [woods])
    const beforeChange = vi.fn()

    expect(() => mergeTags(db, forest, woods, 'calm', beforeChange)).toThrow(/already exists/)

    expect(beforeChange).not.toHaveBeenCalled()
    expect(allTagNames()).toEqual(['Calm', 'Forest', 'Woods'])
    expect(tagsOf(a)).toEqual(['Woods'])
  })

  it('refuses an empty name, the same tag twice, or a missing tag', () => {
    const forest = addTag('Forest')
    const woods = addTag('Woods')
    expect(() => mergeTags(db, forest, woods, '   ')).toThrow(/name/)
    expect(() => mergeTags(db, forest, forest, 'Forest')).toThrow(/two different/)
    expect(() => mergeTags(db, forest, 999, 'Forest')).toThrow(/does not exist/)
    expect(allTagNames()).toEqual(['Forest', 'Woods'])
  })

  it('runs the safety hook before changing anything', () => {
    const forest = addTag('Forest')
    const woods = addTag('Woods')
    const a = addTrack('a', [woods])
    let seenDuringHook: string[] = []
    mergeTags(db, forest, woods, 'Forest', () => {
      seenDuringHook = tagsOf(a)
    })
    expect(seenDuringHook).toEqual(['Woods'])
    expect(tagsOf(a)).toEqual(['Forest'])
  })

  it('does not touch the data if the safety hook fails', () => {
    const forest = addTag('Forest')
    const woods = addTag('Woods')
    const a = addTrack('a', [woods])
    expect(() =>
      mergeTags(db, forest, woods, 'Forest', () => {
        throw new Error('backup failed')
      })
    ).toThrow('backup failed')
    expect(allTagNames()).toEqual(['Forest', 'Woods'])
    expect(tagsOf(a)).toEqual(['Woods'])
  })
})
