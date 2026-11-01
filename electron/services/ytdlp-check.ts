import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { SignInCheck } from '../../src/shared/download.ts'
import type { YoutubeCookies } from '../../src/shared/settings.ts'
import {
  classifyYtDlpError,
  clientArgs,
  cookieArgs,
  explainYtDlpProblem,
  usesCookies
} from './ytdlp-options.ts'

/** The first video ever put on YouTube: short, public and always there. */
const CHECK_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
const VERSION_TIMEOUT_MS = 10_000
const CHECK_TIMEOUT_MS = 60_000

type Run = { code: number | null; out: string; err: string; missing: boolean; timedOut: boolean }

function run(args: string[], timeoutMs: number): Promise<Run> {
  return new Promise((resolve) => {
    let out = ''
    let err = ''
    let missing = false
    let timedOut = false
    const proc = spawn('yt-dlp', args, {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }
    })
    const timer = setTimeout(() => {
      timedOut = true
      proc.kill()
    }, timeoutMs)
    proc.stdout?.on('data', (chunk: Buffer) => (out += chunk.toString('utf8')))
    proc.stderr?.on('data', (chunk: Buffer) => (err += chunk.toString('utf8')))
    proc.on('error', (error: NodeJS.ErrnoException) => {
      missing = error.code === 'ENOENT'
      err += error.message
      clearTimeout(timer)
      resolve({ code: null, out, err, missing, timedOut })
    })
    proc.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, out, err, missing, timedOut })
    })
  })
}

/** Looks at one video with the current sign-in settings, to tell whether downloads will work. */
export async function checkYoutubeSignIn(cookies: YoutubeCookies): Promise<SignInCheck> {
  if (cookies.source === 'file' && !(path.isAbsolute(cookies.file) && existsSync(cookies.file))) {
    return {
      ok: false,
      version: null,
      message: 'The cookies file was not found. Choose it again.'
    }
  }

  const versionRun = await run(['--version'], VERSION_TIMEOUT_MS)
  if (versionRun.missing) {
    return {
      ok: false,
      version: null,
      message: 'yt-dlp was not found. Install it and make sure it is on your PATH.'
    }
  }
  const version = versionRun.out.trim() || null

  const result = await run(
    [
      ...clientArgs(cookies),
      ...cookieArgs(cookies),
      '--skip-download',
      '--no-playlist',
      '--print',
      '%(title)s',
      '--',
      CHECK_URL
    ],
    CHECK_TIMEOUT_MS
  )

  if (result.timedOut) {
    return { ok: false, version, message: 'YouTube did not answer in time. Try again.' }
  }
  if (result.code === 0 && result.out.trim() !== '') {
    const note = /javascript runtime/i.test(result.err)
      ? ' yt-dlp also says it wants a JavaScript runtime. If downloads fail, install one with: winget install DenoLand.Deno'
      : ''
    return {
      ok: true,
      version,
      message: `It works${usesCookies(cookies) ? ' with your sign-in' : ' without a sign-in'}.${note}`
    }
  }

  const lines = result.err.split(/\r\n|\r|\n/)
  const error = lines.reverse().find((line) => line.startsWith('ERROR:'))
  const message = error ? error.replace(/^ERROR:\s*/, '') : result.err.trim().slice(-300)
  const explained = explainYtDlpProblem(classifyYtDlpError(message), usesCookies(cookies))
  return { ok: false, version, message: explained?.full ?? (message || 'yt-dlp failed.') }
}
