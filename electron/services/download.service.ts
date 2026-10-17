import { spawn, type ChildProcess } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { readdir } from 'node:fs/promises'
import { StringDecoder } from 'node:string_decoder'
import { notifyDownloadFinished } from './notify.ts'
import {
  checkFranchise,
  checkUrl,
  idleDownloadState,
  type DownloadItem,
  type DownloadState,
  findNameProblems,
  type FinishResult
} from '../../src/shared/download.ts'
import { renameAll } from './files.services.ts'
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

  const claimed = new Set<string>()
  for (const item of state.items) {
    if (item.status !== 'done' || !item.path) continue
    const key = item.path.toLowerCase()
    if (claimed.has(key)) {
      item.status = 'failed'
      item.error = 'Same title as an earlier track, so it replaced that file.'
    } else {
      claimed.add(key)
    }
  }

  const done = state.items.filter((item) => item.status === 'done').length
  const failed = state.items.filter((item) => item.status === 'failed').length

  if (cancelled) {
    state.phase = 'cancelled'
    state.error = null
    return
  }
  if (failure) {
    state.phase = 'failed'
    state.error = failure
    return
  }
  if (done === 0) {
    state.phase = 'failed'
    state.error = lastError ?? `yt-dlp stopped with code ${code ?? 'unknown'}.`
    return
  }

  state.phase = 'downloaded'
  state.error = failed > 0 ? `${failed} could not be downloaded.` : null
  state.renameActive = true
  notifyDownloadFinished(done, state.franchise)
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

let finishing = false

export async function finishDownload(
  entries: { index: number; name: string }[]
): Promise<FinishResult> {
  if (state.phase !== 'downloaded' || !state.renameActive) {
    throw new Error('There is nothing to finish.')
  }
  if (finishing) throw new Error('Already renaming.')
  finishing = true

  try {
    const done = state.items.filter((item) => item.status === 'done' && item.path)
    const wanted = new Map(entries.map((entry) => [entry.index, entry.name.trim()]))
    if (
      wanted.size !== entries.length ||
      wanted.size !== done.length ||
      !done.every((item) => wanted.has(item.index))
    ) {
      throw new Error('The list of names does not match the downloaded tracks.')
    }

    const folderKey = path.resolve(state.folder).toLowerCase()
    const planned = done.map((item) => {
      const from = item.path as string
      if (path.resolve(path.dirname(from)).toLowerCase() !== folderKey) {
        throw new Error('A downloaded file is outside the download folder.')
      }
      const ext = path.extname(from)
      const name = wanted.get(item.index) as string
      return { item, from, ext, name, to: path.join(path.dirname(from), name + ext) }
    })
    if (planned.some((plan) => plan.to.length > 259)) throw new Error('A path would be too long.')

    const own = new Set(planned.map((plan) => path.basename(plan.from).toLowerCase()))
    const existing = new Set(
      (await listFolderNames()).map((name) => name.toLowerCase()).filter((name) => !own.has(name))
    )
    const problems = findNameProblems(
      planned.map((plan) => ({
        index: plan.item.index,
        path: plan.from,
        newName: plan.name === '' ? '' : plan.name + plan.ext
      })),
      existing
    )
    if (problems.size > 0) {
      throw new Error('Some names are empty, not allowed by Windows or already used.')
    }

    const moves = planned.filter((plan) => plan.to !== plan.from)
    try {
      await renameAll(moves.map((move) => ({ from: move.from, to: move.to })))
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'EPERM' || code === 'EBUSY' || code === 'EACCES') {
        throw new Error('A file is in use by another program, so nothing was renamed.')
      }
      throw error
    }

    for (const plan of planned) {
      plan.item.path = plan.to
      plan.item.title = plan.name
    }
    state.renameActive = false
    return { renamed: moves.length, total: done.length, folder: state.folder }
  } finally {
    finishing = false
  }
}

export async function listFolderNames(): Promise<string[]> {
  if (!state.folder) return []
  try {
    const entries = await readdir(state.folder, { withFileTypes: true })
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name)
  } catch {
    return []
  }
}
