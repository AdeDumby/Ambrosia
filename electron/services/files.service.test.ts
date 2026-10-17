import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { renameAll } from './files.services.ts'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'ambrosia-rename-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

const at = (name: string) => path.join(dir, name)

async function make(files: Record<string, string>): Promise<void> {
  for (const [name, content] of Object.entries(files)) await writeFile(at(name), content)
}

async function snapshot(): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  for (const name of await readdir(dir)) result[name] = await readFile(at(name), 'utf-8')
  return result
}

describe('renameAll', () => {
  it('renames independent files', async () => {
    await make({ 'a.mp3': 'A', 'b.mp3': 'B' })
    await renameAll([
      { from: at('a.mp3'), to: at('x.mp3') },
      { from: at('b.mp3'), to: at('y.mp3') }
    ])
    expect(await snapshot()).toEqual({ 'x.mp3': 'A', 'y.mp3': 'B' })
  })

  it('swaps two files without losing either', async () => {
    await make({ 'a.mp3': 'A', 'b.mp3': 'B' })
    await renameAll([
      { from: at('a.mp3'), to: at('b.mp3') },
      { from: at('b.mp3'), to: at('a.mp3') }
    ])
    expect(await snapshot()).toEqual({ 'a.mp3': 'B', 'b.mp3': 'A' })
  })

  it('handles a chain where one target is another file source', async () => {
    await make({ 'a.mp3': 'A', 'b.mp3': 'B' })
    await renameAll([
      { from: at('a.mp3'), to: at('b.mp3') },
      { from: at('b.mp3'), to: at('c.mp3') }
    ])
    expect(await snapshot()).toEqual({ 'b.mp3': 'A', 'c.mp3': 'B' })
  })

  it('changes only the case of a name', async () => {
    await make({ 'song.mp3': 'S' })
    await renameAll([{ from: at('song.mp3'), to: at('Song.mp3') }])
    expect(await readdir(dir)).toEqual(['Song.mp3'])
  })

  it('refuses to overwrite an unrelated file and changes nothing', async () => {
    await make({ 'a.mp3': 'A', 'b.mp3': 'B', 'x.mp3': 'X' })
    await expect(
      renameAll([
        { from: at('a.mp3'), to: at('x.mp3') },
        { from: at('b.mp3'), to: at('y.mp3') }
      ])
    ).rejects.toThrow(/already exists/)
    expect(await snapshot()).toEqual({ 'a.mp3': 'A', 'b.mp3': 'B', 'x.mp3': 'X' })
  })

  it('changes nothing when a source file is missing', async () => {
    await make({ 'a.mp3': 'A' })
    await expect(
      renameAll([
        { from: at('a.mp3'), to: at('x.mp3') },
        { from: at('ghost.mp3'), to: at('y.mp3') }
      ])
    ).rejects.toThrow(/missing/)
    expect(await snapshot()).toEqual({ 'a.mp3': 'A' })
  })
})
