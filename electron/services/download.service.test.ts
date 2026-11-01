import { chmodSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { YoutubeCookies } from '../../src/shared/settings.ts'

vi.mock('./notify.ts', () => ({ notifyDownloadFinished: () => {} }))

import { getDownloadState, resetDownload, startDownload } from './download.service.ts'

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
