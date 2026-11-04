import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { checkMissingTracks, parsePlaylistJson } from './missing.service.ts'

const posix = process.platform !== 'win32'
const off = { source: 'off', browser: 'firefox', file: '' } as const

function hasFfmpeg(): boolean {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

describe('parsePlaylistJson', () => {
  it('reads the entries in order, with their numbers', () => {
    const list = parsePlaylistJson(
      JSON.stringify({
        entries: [
          { id: 'a', title: 'One', duration: 61 },
          null,
          { id: 'c', title: '[Deleted video]' }
        ]
      })
    )
    expect(list).toEqual([
      { index: 1, id: 'a', title: 'One', durationSec: 61 },
      { index: 2, id: '', title: '', durationSec: null },
      { index: 3, id: 'c', title: '[Deleted video]', durationSec: null }
    ])
  })

  it('takes a single video as a list of one', () => {
    expect(parsePlaylistJson(JSON.stringify({ id: 'v', title: 'T', duration: 5 }))).toHaveLength(1)
  })

  it('refuses text that is not JSON', () => {
    expect(() => parsePlaylistJson('nope')).toThrow()
  })
})

describe.skipIf(!posix || !hasFfmpeg())('checkMissingTracks', () => {
  let work = ''
  const oldPath = process.env.PATH

  beforeAll(() => {
    work = mkdtempSync(path.join(tmpdir(), 'ambrosia-missing-'))
    const bin = path.join(work, 'bin')
    mkdirSync(bin)
    const script = path.join(bin, 'yt-dlp')
    writeFileSync(
      script,
      `#!/bin/sh
cat <<'JSON'
{"entries":[
 {"id":"aaa","title":"First song","duration":2},
 {"id":"bbb","title":"Second song","duration":3},
 {"id":"ccc","title":"Third song","duration":4},
 {"id":"ddd","title":"[Private video]"}
]}
JSON
`
    )
    chmodSync(script, 0o755)
    process.env.PATH = `${bin}${path.delimiter}${oldPath}`
    const folder = path.join(work, 'library', 'Mine')
    mkdirSync(folder, { recursive: true })
    const make = (name: string, seconds: number, tags: string[] = []) =>
      execFileSync('ffmpeg', [
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        `sine=d=${seconds}`,
        ...tags,
        path.join(folder, name)
      ])
    make('whatever.mp3', 2, ['-metadata', 'ambrosia_id=aaa'])
    make('Second song.mp3', 3)
    make('Stray.mp3', 9)
  })

  afterAll(() => {
    process.env.PATH = oldPath
    rmSync(work, { recursive: true, force: true })
  })

  it('tells what is missing, what is unavailable and what is extra', async () => {
    const report = await checkMissingTracks(
      path.join(work, 'library'),
      'Mine',
      'https://www.youtube.com/playlist?list=PLx',
      off
    )
    expect(report.playlistTotal).toBe(4)
    expect(report.matched).toEqual({ id: 1, title: 1, length: 0 })
    expect(report.missing.map((track) => [track.index, track.unavailable])).toEqual([
      [3, false],
      [4, true]
    ])
    expect(report.extraFiles).toEqual(['Stray.mp3'])
    expect(report.folderMissing).toBe(false)
  })

  it('says the folder is missing when it does not exist', async () => {
    const report = await checkMissingTracks(
      path.join(work, 'library'),
      'Nope',
      'https://www.youtube.com/playlist?list=PLx',
      off
    )
    expect(report.folderMissing).toBe(true)
    expect(report.missing).toHaveLength(4)
  })
})
