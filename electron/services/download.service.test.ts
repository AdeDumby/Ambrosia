import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { YoutubeCookies } from '../../src/shared/settings.ts'

vi.mock('./notify.ts', () => ({ notifyDownloadFinished: () => {} }))

import { getDownloadState, resetDownload, startDownload } from './download.service.ts'
import { fsKey } from '../../src/shared/download.ts'

// The tests put a pretend yt-dlp in front of the real one. It needs a shell, so not on Windows.
const posix = process.platform !== 'win32'
const bot =
  "ERROR: [youtube] vid: Sign in to confirm you're not a bot. Use --cookies-from-browser or --cookies for the authentication."

let folder = ''
let argsFile = ''
const oldPath = process.env.PATH
const oldArgs = process.env.ARGS_FILE

beforeAll(() => {
  if (!posix) return
  folder = mkdtempSync(path.join(tmpdir(), 'ambrosia-ytdlp-'))
  argsFile = path.join(folder, 'args.txt')
  const script = path.join(folder, 'yt-dlp')
  writeFileSync(
    script,
    `#!/bin/sh
printf '%s\\n' "$@" > "$ARGS_FILE"
if [ "$MODE" = "symbols" ]; then
  # Pretend the console could not show some characters: they come out as "?".
  n=1
  while IFS='|' read -r printed real; do
    echo "[download] Downloading item $n of $COUNT"
    echo "[ExtractAudio] Destination: $OUT_DIR/$printed"
    if [ -n "$real" ]; then printf 'x' > "$OUT_DIR/$real"; fi
    n=$((n+1))
    sleep 0.05
  done < "$LIST_FILE"
  exit 0
fi
i=1
while [ $i -le 20 ]; do
  echo "[download] Downloading item $i of 20"
  echo "${bot}"
  i=$((i+1))
  sleep 0.05
done
`
  )
  chmodSync(script, 0o755)
  process.env.PATH = `${folder}${path.delimiter}${oldPath}`
  process.env.ARGS_FILE = argsFile
})

afterAll(() => {
  process.env.PATH = oldPath
  if (oldArgs === undefined) delete process.env.ARGS_FILE
  else process.env.ARGS_FILE = oldArgs
})

async function download(cookies: YoutubeCookies) {
  resetDownload()
  await startDownload(folder, 'Test', 'https://www.youtube.com/watch?v=abc', cookies)
  for (
    let waited = 0;
    getDownloadState().phase === 'downloading' && waited < 10_000;
    waited += 25
  ) {
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return getDownloadState()
}

const off: YoutubeCookies = { source: 'off', browser: 'firefox', file: '' }

describe.skipIf(!posix)('download with the YouTube bot check', () => {
  it('stops after a few sign-in failures and says what to do', async () => {
    const state = await download(off)
    expect(state.phase).toBe('failed')
    expect(state.signInProblem).toBe(true)
    expect(state.error).toMatch(/Turn on YouTube sign-in/)
    // It stopped long before the 20 items.
    expect(state.items.length).toBeLessThan(10)
    expect(state.items[0].error).toBe('YouTube asks to sign in')
  })

  it('asks for the android client when there is no sign-in', async () => {
    await download(off)
    const args = readFileSync(argsFile, 'utf8').split('\n')
    expect(args).toContain('youtube:player_client=android')
    expect(args).not.toContain('--cookies-from-browser')
  })

  it('passes the cookies of the browser, and drops the android client', async () => {
    const state = await download({ ...off, source: 'browser', browser: 'edge' })
    const args = readFileSync(argsFile, 'utf8').split('\n')
    expect(args).toEqual(expect.arrayContaining(['--cookies-from-browser', 'edge']))
    expect(args).not.toContain('youtube:player_client=android')
    expect(state.error).toMatch(/even with your cookies/)
  })

  it('refuses to start with a cookies file that does not exist', async () => {
    resetDownload()
    await expect(
      startDownload(folder, 'Test', 'https://www.youtube.com/watch?v=abc', {
        ...off,
        source: 'file',
        file: path.join(folder, 'missing.txt')
      })
    ).rejects.toThrow(/cookies file was not found/)
  })

  it('passes a cookies file that exists', async () => {
    const cookies = path.join(folder, 'my cookies.txt')
    writeFileSync(cookies, '# Netscape HTTP Cookie File\n')
    expect(existsSync(cookies)).toBe(true)
    await download({ ...off, source: 'file', file: cookies })
    const args = readFileSync(argsFile, 'utf8').split('\n')
    expect(args).toEqual(expect.arrayContaining(['--cookies', cookies]))
  })
})

async function downloadNamed(rows: string[], count = rows.length) {
  // Each row is "name printed by yt-dlp|real name on disk" (no real name: no file is made).
  const list = path.join(folder, 'list.txt')
  writeFileSync(list, rows.join('\n') + '\n')
  process.env.MODE = 'symbols'
  process.env.LIST_FILE = list
  process.env.COUNT = String(count)
  process.env.OUT_DIR = path.join(folder, 'Symbols')
  try {
    resetDownload()
    await startDownload(folder, 'Symbols', 'https://www.youtube.com/watch?v=abc', off)
    for (let w = 0; getDownloadState().phase === 'downloading' && w < 10_000; w += 25) {
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    return getDownloadState()
  } finally {
    delete process.env.MODE
  }
}

describe.skipIf(!posix)('files whose names yt-dlp could not print', () => {
  it('asks yt-dlp to write its names as UTF-8', async () => {
    await downloadNamed(['A.mp3|A.mp3'])
    expect(readFileSync(argsFile, 'utf8').split('\n')).toEqual(
      expect.arrayContaining(['--encoding', 'utf-8'])
    )
  })

  it('finds a file by its letters when only a symbol was lost', async () => {
    const state = await downloadNamed(['Boss Theme ?.mp3|Boss Theme \u266a.mp3'])
    expect(state.phase).toBe('downloaded')
    expect(path.basename(state.items[0].path ?? '')).toBe('Boss Theme \u266a.mp3')
    expect(state.items[0].status).toBe('done')
  })

  it('finds titles in another alphabet, in the order they were made', async () => {
    const state = await downloadNamed([
      '???.mp3|\u30b2\u30fc\u30e0\u30c6\u30fc\u30de.mp3',
      '???.mp3|\u30dc\u30b9\u6226.mp3',
      'Plain.mp3|Plain.mp3'
    ])
    expect(state.phase).toBe('downloaded')
    expect(state.items.map((item) => path.basename(item.path ?? ''))).toEqual([
      '\u30b2\u30fc\u30e0\u30c6\u30fc\u30de.mp3',
      '\u30dc\u30b9\u6226.mp3',
      'Plain.mp3'
    ])
    expect(state.items.every((item) => item.status === 'done')).toBe(true)
  })

  it('keeps tracks whose printed names are the same apart', async () => {
    const state = await downloadNamed([
      'Theme ?.mp3|Theme \u266a.mp3',
      'Theme ?.mp3|Theme \u266b.mp3'
    ])
    expect(state.items.map((item) => path.basename(item.path ?? ''))).toEqual([
      'Theme \u266a.mp3',
      'Theme \u266b.mp3'
    ])
    expect(state.items.every((item) => item.status === 'done')).toBe(true)
  })

  it('skips only the track whose file is really gone, and keeps the others', async () => {
    const state = await downloadNamed(['Ghost.mp3|', 'Real.mp3|Real.mp3'])
    expect(state.phase).toBe('downloaded')
    const [ghost, real] = state.items
    expect(ghost.status).toBe('failed')
    expect(ghost.error).toMatch(/could not be found/)
    expect(ghost.path).toBeNull()
    expect(real.status).toBe('done')
    expect(state.error).toBe('1 could not be downloaded.')
  })

  it('does not give a file that was already there to a new track', async () => {
    writeFileSync(path.join(folder, 'Symbols', 'Old.mp3'), 'x')
    utimesSync(path.join(folder, 'Symbols', 'Old.mp3'), new Date(2020, 1, 1), new Date(2020, 1, 1))
    const state = await downloadNamed(['???.mp3|\u65b0.mp3'])
    expect(path.basename(state.items[0].path ?? '')).toBe('\u65b0.mp3')
    expect(fsKey('Old.mp3')).not.toBe(fsKey(path.basename(state.items[0].path ?? '')))
  })
})
