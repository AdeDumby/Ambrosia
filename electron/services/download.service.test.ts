import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { YoutubeCookies } from '../../src/shared/settings.ts'

vi.mock('./notify.ts', () => ({ notifyDownloadFinished: () => {} }))

import {
  cancelDownload,
  continueDownloadNow,
  getDownloadState,
  resetDownload,
  setCooldownsForTests,
  startDownload
} from './download.service.ts'
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
if [ "$MODE" = "lenient" ]; then
  # Eight tracks. From FAIL_FROM on, YouTube refuses, for the first FAIL_LAUNCHES launches.
  ARCH=""; prev=""
  for a in "$@"; do if [ "$prev" = "--download-archive" ]; then ARCH="$a"; fi; prev="$a"; done
  echo "$@" >> "$LOG_FILE"
  launch=$(wc -l < "$LOG_FILE" | tr -d ' ')
  i=1
  while [ $i -le 8 ]; do
    echo "[download] Downloading item $i of 8"
    if [ -f "$ARCH" ] && grep -qx "id$i" "$ARCH"; then
      echo "[download] id$i: has already been recorded in the archive"
    elif [ "$FAIL_FROM" -gt 0 ] && [ $i -ge "$FAIL_FROM" ] && [ "$launch" -le "$FAIL_LAUNCHES" ]; then
      echo "${bot}"
    else
      echo "[ExtractAudio] Destination: $OUT_DIR/Track $i.mp3"
      printf x > "$OUT_DIR/Track $i.mp3"
      echo "id$i" >> "$ARCH"
    fi
    i=$((i+1))
    sleep 0.03
  done
  exit 0
fi
if [ "$MODE" = "start" ]; then
  # Eight tracks, from the chosen one on. Numbers are relative, or real when REAL=1.
  S=1; prev=""
  for a in "$@"; do if [ "$prev" = "--playlist-start" ]; then S="$a"; fi; prev="$a"; done
  i=$S
  while [ $i -le 8 ]; do
    if [ "$REAL" = "1" ]; then echo "[download] Downloading item $i of 8"
    else echo "[download] Downloading item $((i-S+1)) of $((8-S+1))"; fi
    if [ "$RL" = "1" ] && [ $i -eq 3 ] && [ "$S" = "1" ]; then
      echo "WARNING: [youtube] x: Unable to download webpage: HTTP Error 429: Too Many Requests"
      echo "ERROR: [youtube] x: Unable to download webpage: HTTP Error 429: Too Many Requests"
      sleep 1
    fi
    echo "[ExtractAudio] Destination: $OUT_DIR/Track $i.mp3"
    printf x > "$OUT_DIR/Track $i.mp3"
    i=$((i+1))
    sleep 0.03
  done
  exit 0
fi
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

afterEach(async () => {
  // A test that failed must not leave a download behind for the next one.
  if (getDownloadState().phase === 'downloading') {
    cancelDownload()
    for (let w = 0; getDownloadState().phase === 'downloading' && w < 3000; w += 20) {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }
})

async function download(cookies: YoutubeCookies) {
  resetDownload()
  await startDownload(folder, 'Test', 'https://www.youtube.com/watch?v=abc', {
    cookies,
    pace: 'fast'
  })
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
        pace: 'fast',
        cookies: { ...off, source: 'file', file: path.join(folder, 'missing.txt') }
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
    await startDownload(folder, 'Symbols', 'https://www.youtube.com/watch?v=abc', {
      cookies: off,
      pace: 'fast'
    })
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

async function until(done: () => boolean, ms = 10_000) {
  for (let waited = 0; !done() && waited < ms; waited += 20) {
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

function lenient(failFrom: number, failLaunches: number, name = 'Long') {
  const log = path.join(folder, 'launches.txt')
  rmSync(log, { force: true })
  process.env.MODE = 'lenient'
  process.env.LOG_FILE = log
  process.env.FAIL_FROM = String(failFrom)
  process.env.FAIL_LAUNCHES = String(failLaunches)
  process.env.OUT_DIR = path.join(folder, name)
  return () => readFileSync(log, 'utf8').trim().split('\n')
}

const url = 'https://www.youtube.com/playlist?list=PLabc'
const settings = { cookies: off, pace: 'balanced' as const }

describe.skipIf(!posix)('a long playlist that YouTube stops in the middle', () => {
  it('waits, goes on from where it stopped, and ends with every track', async () => {
    setCooldownsForTests([0.1])
    const launches = lenient(5, 1)
    try {
      resetDownload()
      await startDownload(folder, 'Long', url, settings)
      await until(() => getDownloadState().phase !== 'downloading')
      const state = getDownloadState()
      expect(state.phase).toBe('downloaded')
      expect(state.error).toBeNull()
      expect(state.items).toHaveLength(8)
      expect(state.items.every((item) => item.status === 'done')).toBe(true)
      expect(state.waiting).toBeNull()

      const [first, second] = launches()
      expect(first).toContain('--sleep-interval 2')
      expect(first).toContain('--download-archive')
      // The second launch is gentler, and uses the same list of what was done.
      expect(second).toContain('--max-sleep-interval 25')
      const archive = (line: string) =>
        line.split(' ').at(line.split(' ').indexOf('--download-archive') + 1)
      expect(archive(second)).toBe(archive(first))
    } finally {
      delete process.env.MODE
      setCooldownsForTests(null)
    }
  })

  it('shows that it is waiting, and can be told to go on now', async () => {
    setCooldownsForTests([600])
    lenient(5, 1)
    try {
      resetDownload()
      await startDownload(folder, 'Long', url, settings)
      await until(() => getDownloadState().waiting !== null)
      const waiting = getDownloadState().waiting
      expect(waiting?.reason).toMatch(/YouTube/)
      expect(waiting && waiting.until - Date.now()).toBeGreaterThan(500_000)
      expect(getDownloadState().phase).toBe('downloading')

      continueDownloadNow()
      await until(() => getDownloadState().phase !== 'downloading')
      expect(getDownloadState().phase).toBe('downloaded')
      expect(getDownloadState().items.filter((item) => item.status === 'done')).toHaveLength(8)
    } finally {
      delete process.env.MODE
      setCooldownsForTests(null)
    }
  })

  it('can be cancelled while it waits', async () => {
    setCooldownsForTests([600])
    lenient(5, 99)
    try {
      resetDownload()
      await startDownload(folder, 'Long', url, settings)
      await until(() => getDownloadState().waiting !== null)
      cancelDownload()
      await until(() => getDownloadState().phase !== 'downloading')
      expect(getDownloadState().phase).toBe('cancelled')
      expect(getDownloadState().waiting).toBeNull()
    } finally {
      delete process.env.MODE
      setCooldownsForTests(null)
    }
  })

  it('gives up when waiting does not help, and the same link can be continued later', async () => {
    setCooldownsForTests([0.05, 0.05])
    const launches = lenient(5, 99, 'Long2')
    try {
      resetDownload()
      await startDownload(folder, 'Long2', url, settings)
      await until(() => getDownloadState().phase !== 'downloading')
      let state = getDownloadState()
      // Four tracks were fine, and the rest could not be downloaded.
      expect(state.phase).toBe('downloaded')
      expect(state.items.filter((item) => item.status === 'done')).toHaveLength(4)
      expect(state.error).toMatch(/kept asking to sign in/)
      expect(launches().length).toBe(3)

      // Later, YouTube lets it through: the same link goes on from track 5.
      lenient(0, 0, 'Long2')
      resetDownload()
      await startDownload(folder, 'Long2', url, settings)
      await until(() => getDownloadState().phase !== 'downloading')
      state = getDownloadState()
      expect(state.notice).toMatch(/Continuing an earlier download/)
      expect(state.phase).toBe('downloaded')
      expect(state.items.filter((item) => item.status === 'skipped')).toHaveLength(4)
      expect(state.items.filter((item) => item.status === 'done')).toHaveLength(4)
    } finally {
      delete process.env.MODE
      setCooldownsForTests(null)
    }
  })

  it('does not wait when nothing was ever downloaded', async () => {
    setCooldownsForTests([600])
    lenient(1, 99, 'Long3')
    try {
      resetDownload()
      await startDownload(folder, 'Long3', url, settings)
      await until(() => getDownloadState().phase !== 'downloading', 5000)
      expect(getDownloadState().phase).toBe('failed')
      expect(getDownloadState().waiting).toBeNull()
    } finally {
      delete process.env.MODE
      setCooldownsForTests(null)
    }
  })
})

describe.skipIf(!posix)('starting at a chosen track number', () => {
  async function runFrom(startAt: number | undefined, real: boolean, name: string) {
    process.env.MODE = 'start'
    process.env.REAL = real ? '1' : '0'
    process.env.OUT_DIR = path.join(folder, name)
    resetDownload()
    await startDownload(folder, name, url, settings, startAt)
    await until(() => getDownloadState().phase !== 'downloading')
    return getDownloadState()
  }

  it('passes the start number and shows the real track numbers (relative counting)', async () => {
    const state = await runFrom(5, false, 'StartA')
    expect(readFileSync(argsFile, 'utf8')).toContain('--playlist-start\n5\n')
    expect(state.items.map((item) => item.index)).toEqual([5, 6, 7, 8])
    expect(state.total).toBe(8)
    expect(state.items.every((item) => item.status === 'done')).toBe(true)
  })

  it('keeps the numbers as they are when yt-dlp already prints real numbers', async () => {
    const state = await runFrom(5, true, 'StartB')
    expect(state.items.map((item) => item.index)).toEqual([5, 6, 7, 8])
    expect(state.total).toBe(8)
  })

  it('does not pass anything for the first track', async () => {
    const state = await runFrom(undefined, false, 'StartC')
    expect(readFileSync(argsFile, 'utf8')).not.toContain('--playlist-start')
    expect(state.items.map((item) => item.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('pauses on a 429 and tries the same track again, starting at its number', async () => {
    setCooldownsForTests([0.2])
    process.env.RL = '1'
    try {
      const state = await runFrom(undefined, false, 'StartE')
      expect(state.phase).toBe('downloaded')
      expect(state.items.map((item) => item.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
      expect(state.items.every((item) => item.status === 'done')).toBe(true)
      expect(readFileSync(argsFile, 'utf8')).toContain('--playlist-start\n3\n')
    } finally {
      delete process.env.RL
      setCooldownsForTests(null)
    }
  })

  it('refuses a start number that is not valid', async () => {
    resetDownload()
    await expect(startDownload(folder, 'StartD', url, settings, 0)).rejects.toThrow()
  })
})
