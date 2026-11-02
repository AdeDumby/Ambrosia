import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import { notifyDownloadFinished } from './notify.ts'
import {
  checkFranchise,
  checkStartAt,
  checkUrl,
  idleDownloadState,
  type DownloadItem,
  type DownloadState,
  findNameProblems,
  fsKey,
  type FinishResult
} from '../../src/shared/download.ts'
import { renameAll } from './files.services.ts'
import type { DownloadPace, DownloadSettings, YoutubeCookies } from '../../src/shared/settings.ts'
import {
  buildDownloadArgs,
  classifyYtDlpError,
  explainYtDlpProblem,
  isSignInProblem,
  usesCookies
} from './ytdlp-options.ts'
import { parseYtDlpLine, type YtDlpEvent } from './ytdlp-parser.ts'

const MAX_LOG = 200
/** This many sign-in failures in a row mean YouTube has stopped answering: the rest would fail too. */
const SIGN_IN_STALL_AFTER = 3
/** YouTube's "too many requests" pauses the download at once, and the track is tried again. */
const RATE_LIMIT_STALL_AFTER = 1
/** Seconds to wait before trying again, longer each time nothing new could be downloaded. */
const DEFAULT_COOLDOWNS = [120, 300, 600, 900, 1200]
/** A stopped download can be continued by running the same link again for this long. */
const RESUME_WINDOW_MS = 24 * 60 * 60 * 1000

let cooldowns = DEFAULT_COOLDOWNS

/** Only for tests: waits that do not take minutes. */
export function setCooldownsForTests(seconds: number[] | null): void {
  cooldowns = seconds ?? DEFAULT_COOLDOWNS
}

type Run = {
  template: string
  url: string
  franchise: string
  cookies: YoutubeCookies
  pace: DownloadPace
  /** The number of the first track to download. */
  startAt: number
  /** Only these playlist numbers are wanted (the missing tracks), and the size of the playlist. */
  only: { items: number[]; total: number } | null
  /** The numbers that the current launch of yt-dlp was asked for. */
  launched: number[] | null
  /** Added to the numbers yt-dlp prints, when it counts from the chosen start. */
  offset: number | undefined
  /** Remembers the downloaded videos, so that a new launch of yt-dlp skips them. */
  archive: string
  /** Waits in a row in which nothing new could be downloaded. */
  stalls: number
  /** Tracks that were fine when the current launch started. */
  fineAtLaunch: number
  timer: NodeJS.Timeout | undefined
  /** Gave up while YouTube was refusing, so the same link can be continued later. */
  stalledOut: boolean
}

let state: DownloadState = idleDownloadState()
let child: ChildProcess | null = null
let run: Run | null = null
let cursor: DownloadItem | null = null
let cancelled = false
let lastError: string | null = null
/** The last error was YouTube's rate limit, which lasts longer than a sign-in check. */
let rateLimited = false
/** The number of the track that YouTube refused with a 429. */
let rateLimitedAt: number | null = null
let signedIn = false
let signInStreak = 0
let stallRequested = false
/** The files that were already in the folder when the download started. */
let folderBefore = new Set<string>()
let stopped: { url: string; franchise: string; archive: string; at: number } | null = null

export function getDownloadState(): DownloadState {
  return state
}

function stemOf(file: string): string {
  const base = path.basename(file)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(0, dot) : base
}

function currentItem(): DownloadItem | undefined {
  return cursor ?? undefined
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
  cursor = item
  return item
}

/** Tracks that are downloaded: finished, or finished and being converted. */
function succeeded(): number {
  return state.items.filter(
    (item) => (item.status === 'done' || item.status === 'converting') && item.path
  ).length
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
    case 'item': {
      finalizeCurrent()
      let { index, total } = event
      const current = run
      if (current?.launched && current.only) {
        // With a list of numbers yt-dlp counts the tracks it was asked for, or keeps the real
        // numbers. When its total is the size of the list it is counting them: map back.
        if (total === current.launched.length) index = current.launched[index - 1] ?? index
        total = current.only.total
      } else if (current && current.startAt > 1) {
        // With a start number yt-dlp may count from 1 again, or keep the real numbers. The first
        // number of a launch tells which, so the list always shows the real track numbers.
        current.offset ??= index < current.startAt ? current.startAt - 1 : 0
        index += current.offset
        total += current.offset
      }
      state.total = total
      // A new launch of yt-dlp counts from the start again. Tracks that are done keep their
      // place, and the ones that failed before are tried again.
      const known = state.items.find((item) => item.index === index)
      if (known && (known.status === 'done' || known.status === 'skipped')) {
        cursor = known
      } else if (known) {
        Object.assign(known, { status: 'downloading', percent: 0, path: null, error: null })
        cursor = known
      } else {
        newItem(index)
      }
      break
    }
    case 'archived': {
      const item = currentItem()
      if (item && item.status === 'downloading') {
        item.status = 'skipped'
        item.percent = 100
        item.error = null
      }
      break
    }
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
      rateLimited = problem === 'rate-limit'
      if (rateLimited) rateLimitedAt = currentItem()?.index ?? null
      const item = currentItem() ?? newItem(1)
      if (item.status === 'downloading') item.status = 'failed'
      if (item.status !== 'done') item.error = explained?.short ?? event.message
      if (isSignInProblem(problem)) {
        state.signInProblem = true
        signInStreak += 1
        if (signInStreak >= SIGN_IN_STALL_AFTER) requestStall()
      } else if (problem === 'rate-limit') {
        signInStreak += 1
        if (signInStreak >= RATE_LIMIT_STALL_AFTER) requestStall()
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
  // After a stall is called, what is still arriving is not worth following.
  if (stallRequested) return
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
  state.waiting = null
  endRun(done > 0)

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
  state.error =
    failed > 0
      ? stopped
        ? `${failed} could not be downloaded, because YouTube kept asking to sign in. Run the same link again later: the tracks that are done are skipped.`
        : `${failed} could not be downloaded.`
      : null
  state.renameActive = true
  notifyDownloadFinished(done, state.franchise)
}

/** Forgets the run. The list of downloaded videos is kept only when the same link can be continued. */
function endRun(keepArchive: boolean): void {
  const finished = run
  run = null
  if (!finished) return
  clearTimeout(finished.timer)
  if (finished.stalledOut && keepArchive) {
    stopped = {
      url: finished.url,
      franchise: finished.franchise,
      archive: finished.archive,
      at: Date.now()
    }
    return
  }
  stopped = null
  void rm(finished.archive, { force: true }).catch(() => {})
}

function requestStall(): void {
  if (stallRequested || !child) return
  stallRequested = true
  killChild()
}

/** YouTube stopped answering. Wait and go on from where it stopped, or give up. */
function onStall(): void {
  child = null
  const current = run
  const fine = succeeded()
  finalizeCurrent()
  const give = (failure?: string) => {
    if (current && fine > 0) current.stalledOut = true
    void reconcilePaths().then(() => settle(null, failure))
  }

  // Nothing was ever downloaded: the sign-in itself is wrong, and waiting will not help.
  if (!current || cancelled || (fine === 0 && !rateLimited)) {
    give(cancelled ? undefined : (lastError ?? 'YouTube asked to sign in.'))
    return
  }

  current.stalls = fine > current.fineAtLaunch ? 1 : current.stalls + 1
  if (current.stalls > cooldowns.length) {
    give()
    return
  }
  // A 429 is about the connection and often hits only some tracks: a shorter first wait, and the
  // same track is tried again by starting the next launch at its number.
  const seconds = cooldowns[current.stalls - 1] * (rateLimited ? 0.5 : 1)
  if (rateLimited && rateLimitedAt !== null)
    current.startAt = Math.max(current.startAt, rateLimitedAt)
  state.waiting = {
    until: Date.now() + seconds * 1000,
    reason: lastError ?? 'YouTube asked to sign in again.'
  }
  current.timer = setTimeout(resume, seconds * 1000)
}

/** Starts yt-dlp again after the wait. It skips what is done and reads the cookies again. */
function resume(): void {
  const current = run
  if (!current || cancelled || state.phase !== 'downloading' || !state.waiting) return
  clearTimeout(current.timer)
  current.timer = undefined
  state.waiting = null
  launch(true)
}

/** Ends the wait of a download that is waiting to try again. */
export function continueDownloadNow(): void {
  resume()
}

function killChild(): void {
  const pid = child?.pid
  if (process.platform === 'win32' && pid) {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true })
  } else {
    child?.kill('SIGTERM')
  }
}

function launch(gentle: boolean): void {
  const current = run as Run
  stallRequested = false
  signInStreak = 0
  lastError = null
  rateLimited = false
  rateLimitedAt = null
  current.fineAtLaunch = succeeded()
  current.offset = undefined
  const wanted = current.only?.items.filter((number) => number >= current.startAt) ?? []
  current.launched = current.only ? (wanted.length > 0 ? wanted : current.only.items) : null

  const args = buildDownloadArgs(current.template, current.url, current.cookies, {
    pace: gentle ? 'gentle' : current.pace,
    archive: current.archive,
    startAt: current.startAt,
    items: current.launched ?? undefined
  })
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
    if (stallRequested && !failure) {
      onStall()
      return
    }
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
  proc.on('close', (code) => once(code))
}

export async function startDownload(
  libraryFolder: string,
  franchiseRaw: string,
  urlRaw: string,
  options: DownloadSettings,
  startAt = 1,
  only: { items: number[]; total: number } | null = null
): Promise<void> {
  if (state.phase === 'downloading') throw new Error('A download is already running.')
  const problem = checkFranchise(franchiseRaw) ?? checkUrl(urlRaw) ?? checkStartAt(String(startAt))
  if (problem) throw new Error(problem)

  const { cookies, pace } = options
  if (cookies.source === 'file' && !(path.isAbsolute(cookies.file) && existsSync(cookies.file))) {
    throw new Error('The cookies file was not found. Choose it again in YouTube sign-in.')
  }

  const franchise = franchiseRaw.trim()
  const url = new URL(urlRaw.trim()).toString()
  const folder = path.join(libraryFolder, franchise)
  await mkdir(folder, { recursive: true })
  const before = await readdir(folder).catch(() => [] as string[])

  // The same link, soon after a download that was stopped by YouTube: go on from there.
  const earlier =
    stopped &&
    stopped.url === url &&
    stopped.franchise === franchise &&
    Date.now() - stopped.at < RESUME_WINDOW_MS &&
    existsSync(stopped.archive)
      ? stopped
      : null
  if (stopped && !earlier) void rm(stopped.archive, { force: true }).catch(() => {})
  stopped = null

  state = {
    ...idleDownloadState(),
    phase: 'downloading',
    franchise,
    url,
    folder,
    notice: earlier
      ? 'Continuing an earlier download of this link. The tracks that were done are skipped.'
      : only
        ? `Downloading the ${only.items.length} missing ${only.items.length === 1 ? 'track' : 'tracks'}.`
        : startAt > 1
          ? `Starting at track ${startAt}.`
          : null
  }
  cursor = null
  cancelled = false
  lastError = null
  rateLimited = false
  signedIn = usesCookies(cookies)
  folderBefore = new Set(before.map(fsKey))
  run = {
    template: path.join(folder.replace(/%/g, '%%'), '%(title).150s.%(ext)s'),
    url,
    franchise,
    cookies,
    pace,
    startAt,
    only,
    launched: null,
    offset: undefined,
    archive: earlier?.archive ?? path.join(tmpdir(), `ambrosia-archive-${Date.now()}.txt`),
    stalls: 0,
    fineAtLaunch: 0,
    timer: undefined,
    stalledOut: false
  }
  launch(false)
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
  if (state.phase !== 'downloading') return
  cancelled = true
  if (!child) {
    // Waiting to try again: there is no process to stop.
    void reconcilePaths().then(() => settle(null))
    return
  }
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
