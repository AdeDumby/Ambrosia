import { spawn, type ChildProcess } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import {
  checkFranchise,
  checkUrl,
  idleDownloadState,
  type DownloadItem,
  type DownloadState
} from '../../src/shared/download.ts'
import { parseYtDlpLine, type YtDlpEvent } from './ytdlp-parser.ts'

const MAX_LOG = 200

let state: DownloadState = idleDownloadState()
let child: ChildProcess | null = null
let cancelled = false
let lastError: string | null = null

export function getDownloadState(): DownloadState {
  return state
}

function stemOf(file: string): string {
  const base = path.basename(file)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(0, dot) : base
}

function currentItem(): DownloadItem | undefined {
  return state.items[state.items.length - 1]
}

function newItem(index: number): DownloadItem {
  const item: DownloadItem = {
    index,
    title: '',
    status: 'downloading',
    percent: 0,
    path: null,
    error: null
  }
  state.items.push(item)
  return item
}

function finalizeCurrent(): void {
  const item = currentItem()
  if (!item) return
  if (item.status === 'converting') {
    item.status = 'done'
  } else if (item.status === 'downloading') {
    item.status = 'failed'
    item.error = item.error ?? (cancelled ? 'Cancelled' : 'Did not finish')
  }
}

function apply(event: YtDlpEvent): void {
  switch (event.kind) {
    case 'item':
      finalizeCurrent()
      state.total = event.total
      newItem(event.index)
      break
    case 'destination': {
      const item = currentItem() ?? newItem(1)
      if (item.title === '') item.title = stemOf(event.path)
      break
    }
    case 'progress': {
      const item = currentItem()
      if (item && item.status === 'downloading') item.percent = event.percent
      break
    }
    case 'audio': {
      const item = currentItem() ?? newItem(1)
      item.path = event.path
      item.title = stemOf(event.path)
      item.status = 'converting'
      item.percent = 100
      break
    }
    case 'error': {
      lastError = event.message
      const item = currentItem() ?? newItem(1)
      if (item.status === 'downloading') item.status = 'failed'
      if (item.status !== 'done') item.error = event.message
      break
    }
  }
}

function handleLine(line: string): void {
  state.log.push(line)
  if (state.log.length > MAX_LOG) state.log.shift()
  const event = parseYtDlpLine(line)
  if (event) apply(event)
}

function lineReader(onLine: (line: string) => void) {
  const decoder = new StringDecoder('utf8')
  let buffer = ''
  return {
    push(chunk: Buffer): void {
      buffer += decoder.write(chunk)
      const parts = buffer.split(/\r\n|\r|\n/)
      buffer = parts.pop() ?? ''
      parts.forEach(onLine)
    },
    end(): void {
      buffer += decoder.end()
      if (buffer !== '') onLine(buffer)
      buffer = ''
    }
  }
}

function settle(code: number | null, failure?: string): void {
  finalizeCurrent()
  child = null
  const done = state.items.filter((item) => item.status === 'done').length
  const failed = state.items.filter((item) => item.status === 'failed').length

  if (cancelled) {
    state.phase = 'cancelled'
    state.error = null
  } else if (failure) {
    state.phase = 'failed'
    state.error = failure
  } else if (done > 0) {
    state.phase = 'downloaded'
    state.error = failed > 0 ? `${failed} could not be downloaded.` : null
  } else {
    state.phase = 'failed'
    state.error = lastError ?? `yt-dlp stopped with code ${code ?? 'unknown'}.`
  }
}

export async function startDownload(
  libraryFolder: string,
  franchiseRaw: string,
  urlRaw: string
): Promise<void> {
  if (state.phase === 'downloading') throw new Error('A download is already running.')
  const problem = checkFranchise(franchiseRaw) ?? checkUrl(urlRaw)
  if (problem) throw new Error(problem)

  const franchise = franchiseRaw.trim()
  const url = new URL(urlRaw.trim()).toString()
  const folder = path.join(libraryFolder, franchise)
  await mkdir(folder, { recursive: true })

  const template = path.join(folder.replace(/%/g, '%%'), '%(title).150s.%(ext)s')
  const args = [
    '--newline',
    '--extractor-args',
    'youtube:player_client=android',
    '-x',
    '--audio-format',
    'mp3',
    '--audio-quality',
    '192K',
    '--embed-thumbnail',
    '--add-metadata',
    '-o',
    template,
    '--',
    url
  ]

  state = { ...idleDownloadState(), phase: 'downloading', franchise, url, folder }
  cancelled = false
  lastError = null

  const proc = spawn('yt-dlp', args, {
    windowsHide: true,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
  })
  child = proc

  const out = lineReader(handleLine)
  const err = lineReader(handleLine)
  proc.stdout?.on('data', (chunk: Buffer) => out.push(chunk))
  proc.stderr?.on('data', (chunk: Buffer) => err.push(chunk))

  let settled = false
  const once = (code: number | null, failure?: string): void => {
    if (settled) return
    settled = true
    out.end()
    err.end()
    settle(code, failure)
  }
  proc.on('error', (error: NodeJS.ErrnoException) =>
    once(
      null,
      error.code === 'ENOENT'
        ? 'yt-dlp was not found. Install it and make sure it is on your PATH.'
        : error.message
    )
  )
  proc.on('close', (code) => once(code))
}

export function cancelDownload(): void {
  if (!child || state.phase !== 'downloading') return
  cancelled = true
  const pid = child.pid
  if (process.platform === 'win32' && pid) {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true })
  } else {
    child.kill('SIGTERM')
  }
}

export function resetDownload(): void {
  if (state.phase === 'downloading') throw new Error('Cancel the download first.')
  state = idleDownloadState()
}
