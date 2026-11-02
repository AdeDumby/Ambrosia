import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { checkFranchise, checkUrl } from '../../src/shared/download.ts'
import {
  compareWithPlaylist,
  type FolderFile,
  type MissingReport,
  type PlaylistEntry
} from '../../src/shared/missing.ts'
import type { YoutubeCookies } from '../../src/shared/settings.ts'
import { probeFileInfo } from './probe.services.ts'
import {
  classifyYtDlpError,
  cookieArgs,
  explainYtDlpProblem,
  usesCookies
} from './ytdlp-options.ts'

const LIST_TIMEOUT_MS = 240_000
const PROBE_AT_ONCE = 8
const AUDIO_FILE = /\.(mp3|m4a|opus|ogg|wav|flac|aac|webm)$/i

type FlatEntry = { id?: unknown; title?: unknown; duration?: unknown }
type FlatList = FlatEntry & { entries?: unknown }

/** Reads the list that `yt-dlp --flat-playlist -J` prints. A single video counts as a list of one. */
export function parsePlaylistJson(text: string): PlaylistEntry[] {
  let parsed: FlatList
  try {
    parsed = JSON.parse(text) as FlatList
  } catch {
    throw new Error('yt-dlp did not return a readable list.')
  }
  const raw: FlatEntry[] = Array.isArray(parsed.entries)
    ? (parsed.entries as (FlatEntry | null)[]).map((entry) => entry ?? {})
    : [parsed]
  return raw.map((entry, position) => ({
    index: position + 1,
    id: typeof entry.id === 'string' ? entry.id : '',
    title: typeof entry.title === 'string' ? entry.title : '',
    durationSec:
      typeof entry.duration === 'number' && Number.isFinite(entry.duration) ? entry.duration : null
  }))
}

function listPlaylist(url: string, cookies: YoutubeCookies): Promise<PlaylistEntry[]> {
  return new Promise((resolve, reject) => {
    const args = [
      '--encoding',
      'utf-8',
      ...cookieArgs(cookies),
      '--flat-playlist',
      '--ignore-errors',
      '-J',
      '--',
      url
    ]
    let out = ''
    let err = ''
    const proc = spawn('yt-dlp', args, {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
    })
    const timer = setTimeout(() => proc.kill(), LIST_TIMEOUT_MS)
    proc.stdout?.on('data', (chunk: Buffer) => (out += chunk.toString('utf8')))
    proc.stderr?.on('data', (chunk: Buffer) => (err += chunk.toString('utf8')))
    proc.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      reject(
        new Error(
          error.code === 'ENOENT'
            ? 'yt-dlp was not found. Install it and make sure it is on your PATH.'
            : error.message
        )
      )
    })
    proc.on('close', () => {
      clearTimeout(timer)
      if (out.trim() === '') {
        const message = err
          .split(/\r?\n/)
          .find((line) => line.startsWith('ERROR:'))
          ?.replace(/^ERROR:\s*/, '')
        const explained = message
          ? explainYtDlpProblem(classifyYtDlpError(message), usesCookies(cookies))
          : null
        reject(new Error(explained?.full ?? message ?? 'Could not read that playlist.'))
        return
      }
      try {
        resolve(parsePlaylistJson(out))
      } catch (error) {
        reject(error)
      }
    })
  })
}

async function readFolder(folder: string): Promise<FolderFile[]> {
  const names = (await readdir(folder)).filter((name) => AUDIO_FILE.test(name))
  const files: FolderFile[] = names.map((name) => ({ name, durationSec: null, videoId: null }))
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < files.length) {
      const file = files[next++]
      const info = await probeFileInfo(path.join(folder, file.name))
      file.durationSec = info.durationSec
      file.videoId = info.videoId
    }
  }
  await Promise.all(Array.from({ length: Math.min(PROBE_AT_ONCE, files.length) }, worker))
  return files
}

/** Compares the tracks of a playlist with the files in a franchise folder. Nothing is downloaded. */
export async function checkMissingTracks(
  libraryFolder: string,
  franchiseRaw: string,
  urlRaw: string,
  cookies: YoutubeCookies
): Promise<MissingReport> {
  const problem = checkFranchise(franchiseRaw) ?? checkUrl(urlRaw)
  if (problem) throw new Error(problem)
  if (cookies.source === 'file' && !(path.isAbsolute(cookies.file) && existsSync(cookies.file))) {
    throw new Error('The cookies file was not found. Choose it again in YouTube sign-in.')
  }
  const folder = path.join(libraryFolder, franchiseRaw.trim())
  const url = new URL(urlRaw.trim()).toString()

  const entries = await listPlaylist(url, cookies)
  const folderMissing = !existsSync(folder)
  const files = folderMissing ? [] : await readFolder(folder)
  return compareWithPlaylist(entries, files, folderMissing)
}
