import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import { notifyDownloadFinished } from './notify.ts'
import {
  checkFranchise,
  checkUrl,
  idleDownloadState,
  type DownloadItem,
  type DownloadState,
  findNameProblems,
  fsKey,
  type FinishResult
} from '../../src/shared/download.ts'
import { renameAll } from './files.services.ts'
import type { YoutubeCookies } from '../../src/shared/settings.ts'
import {
  buildDownloadArgs,
  classifyYtDlpError,
  explainYtDlpProblem,
  isSignInProblem,
  usesCookies
} from './ytdlp-options.ts'
import { parseYtDlpLine, type YtDlpEvent } from './ytdlp-parser.ts'

const MAX_LOG = 200
/** Stop after this many sign-in failures in a row with nothing downloaded: the rest would fail too. */
const SIGN_IN_ABORT_AFTER = 3

let state: DownloadState = idleDownloadState()
let child: ChildProcess | null = null
let cancelled = false
let lastError: string | null = null
let signedIn = false
let signInStreak = 0
let abortedForSignIn = false
/** The files that were already in the folder when the download started (lower case). */
let folderBefore = new Set<string>()

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
      signInStreak = 0
      const item = currentItem() ?? newItem(1)
      item.path = event.path
      item.title = stemOf(event.path)
      item.status = 'converting'
      item.percent = 100
      break
    }
    case 'error': {
      const problem = classifyYtDlpError(event.message)
      const explained = explainYtDlpProblem(problem, signedIn)
      lastError = explained?.full ?? event.message
      const item = currentItem() ?? newItem(1)
      if (item.status === 'downloading') item.status = 'failed'
      if (item.status !== 'done') item.error = explained?.short ?? event.message
      if (isSignInProblem(problem)) {
        state.signInProblem = true
        signInStreak += 1
        const nothingYet = !state.items.some((candidate) => candidate.status === 'done')
        if (signInStreak >= SIGN_IN_ABORT_AFTER && nothingYet) abortForSignIn()
      } else {
        signInStreak = 0
      }
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
    const key = fsKey(item.path)
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

function abortForSignIn(): void {
  if (abortedForSignIn || !child) return
  abortedForSignIn = true
  killChild()
}

function killChild(): void {
  const pid = child?.pid
  if (process.platform === 'win32' && pid) {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true })
  } else {
    child?.kill('SIGTERM')
  }
}

export async function startDownload(
  libraryFolder: string,
  franchiseRaw: string,
  urlRaw: string,
  cookies: YoutubeCookies
): Promise<void> {
  if (state.phase === 'downloading') throw new Error('A download is already running.')
  const problem = checkFranchise(franchiseRaw) ?? checkUrl(urlRaw)
  if (problem) throw new Error(problem)

  if (cookies.source === 'file' && !(path.isAbsolute(cookies.file) && existsSync(cookies.file))) {
    throw new Error('The cookies file was not found. Choose it again in YouTube sign-in.')
  }

  const franchise = franchiseRaw.trim()
  const url = new URL(urlRaw.trim()).toString()
  const folder = path.join(libraryFolder, franchise)
  await mkdir(folder, { recursive: true })
  const before = await readdir(folder).catch(() => [] as string[])

  const template = path.join(folder.replace(/%/g, '%%'), '%(title).150s.%(ext)s')
  const args = buildDownloadArgs(template, url, cookies)

  state = { ...idleDownloadState(), phase: 'downloading', franchise, url, folder }
  cancelled = false
  lastError = null
  signedIn = usesCookies(cookies)
  signInStreak = 0
  abortedForSignIn = false
  folderBefore = new Set(before.map(fsKey))

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
    void reconcilePaths().then(() => settle(code, failure))
  }
  proc.on('error', (error: NodeJS.ErrnoException) =>
    once(
      null,
      error.code === 'ENOENT'
        ? 'yt-dlp was not found. Install it and make sure it is on your PATH.'
        : error.message
    )
  )
  proc.on('close', (code) =>
    once(code, abortedForSignIn ? (lastError ?? 'YouTube asked to sign in.') : undefined)
  )
}

function fold(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

const AUDIO_EXTENSION = /\.mp3$/i
const NOT_FOUND = 'The file could not be found in the folder.'

/**
 * yt-dlp prints the name of each file, but it may not be able to print every character: a
 * symbol or a letter of another alphabet can come out as "?". So the printed names are matched
 * with the files that are really in the folder:
 *   1. the same name,
 *   2. the same letters and digits (accents, case and symbols ignored), when only one file fits,
 *   3. the files that appeared during this download, in the order they were made.
 * An item whose file is still not found is marked as failed, so one odd name cannot stop the
 * others from being renamed.
 */
export async function reconcilePaths(): Promise<void> {
  const candidates = state.items.filter(
    (item) => item.path && (item.status === 'converting' || item.status === 'done')
  )
  if (candidates.length === 0) return

  let names: string[]
  try {
    names = (await listFolderNames()).filter((name) => AUDIO_EXTENSION.test(name))
  } catch {
    return
  }

  const claimed = new Set<string>()
  const take = (item: DownloadItem, real: string): void => {
    claimed.add(fsKey(real))
    item.path = path.join(state.folder, real)
    item.title = stemOf(real)
  }

  // 1. The printed name is a real file.
  const present = new Map(names.map((name) => [fsKey(name), name]))
  let open = candidates.filter((item) => {
    const real = present.get(fsKey(path.basename(item.path as string)))
    if (!real || claimed.has(fsKey(real))) return true
    take(item, real)
    return false
  })

  // 2. The same letters and digits. A name that fits several files is left for step 3.
  const free = () => names.filter((name) => !claimed.has(fsKey(name)))
  const byKey = new Map<string, string[]>()
  for (const name of free()) {
    const key = fold(name)
    if (key !== '') byKey.set(key, [...(byKey.get(key) ?? []), name])
  }
  const sharedKey = (key: string) =>
    candidates.filter((item) => fold(path.basename(item.path as string)) === key).length
  open = open.filter((item) => {
    const key = fold(path.basename(item.path as string))
    const fits = (byKey.get(key) ?? []).filter((name) => !claimed.has(fsKey(name)))
    if (key === '' || fits.length !== 1 || sharedKey(key) !== 1) return true
    take(item, fits[0])
    return false
  })

  // 3. What is left, in the order the files were made.
  if (open.length > 0) {
    const created: { name: string; time: number }[] = []
    for (const name of free()) {
      if (folderBefore.has(fsKey(name))) continue
      try {
        created.push({ name, time: (await stat(path.join(state.folder, name))).mtimeMs })
      } catch {
        // The file went away: it cannot be matched.
      }
    }
    created.sort((a, b) => a.time - b.time || a.name.localeCompare(b.name))
    // Only when every new file has an item, so a stray file cannot be given to the wrong track.
    if (created.length === open.length) {
      open.forEach((item, position) => take(item, created[position].name))
      open = []
    }
  }

  for (const item of open) {
    item.status = 'failed'
    item.error = NOT_FOUND
    item.path = null
  }
}

export function cancelDownload(): void {
  if (!child || state.phase !== 'downloading') return
  cancelled = true
  killChild()
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

    const folderKey = fsKey(path.resolve(state.folder))
    const planned = done.map((item) => {
      const from = item.path as string
      if (fsKey(path.resolve(path.dirname(from))) !== folderKey) {
        throw new Error('A downloaded file is outside the download folder.')
      }
      const ext = path.extname(from)
      const name = wanted.get(item.index) as string
      return { item, from, ext, name, to: path.join(path.dirname(from), name + ext) }
    })
    if (planned.some((plan) => plan.to.length > 259)) throw new Error('A path would be too long.')

    const own = new Set(planned.map((plan) => fsKey(path.basename(plan.from))))
    const existing = new Set((await listFolderNames()).map(fsKey).filter((name) => !own.has(name)))
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
