import { describe, expect, it } from 'vitest'
import type { YoutubeCookies } from '../../src/shared/settings.ts'
import {
  paceArgs,
  buildDownloadArgs,
  classifyYtDlpError,
  clientArgs,
  cookieArgs,
  explainYtDlpProblem,
  isSignInProblem
} from './ytdlp-options.ts'

const off: YoutubeCookies = { source: 'off', browser: 'firefox', file: '' }
const browser: YoutubeCookies = { source: 'browser', browser: 'edge', file: 'C:\\old.txt' }
const file: YoutubeCookies = { source: 'file', browser: 'firefox', file: 'C:\\my cookies.txt' }

describe('cookieArgs', () => {
  it('gives nothing when sign-in is off', () => {
    expect(cookieArgs(off)).toEqual([])
  })

  it('reads the cookies of the chosen browser, and ignores the file', () => {
    expect(cookieArgs(browser)).toEqual(['--cookies-from-browser', 'edge'])
  })

  it('passes the path of the file as one argument, spaces included', () => {
    expect(cookieArgs(file)).toEqual(['--cookies', 'C:\\my cookies.txt'])
  })

  it('gives nothing when the file source has no file yet', () => {
    expect(cookieArgs({ ...file, file: '' })).toEqual([])
  })
})

describe('buildDownloadArgs', () => {
  it('keeps the android client without a sign-in', () => {
    const args = buildDownloadArgs('out', 'https://youtu.be/x', off)
    expect(args).toContain('youtube:player_client=android')
    expect(args.slice(-2)).toEqual(['--', 'https://youtu.be/x'])
  })

  it('drops the android client, which cannot use cookies, and adds the cookies', () => {
    const args = buildDownloadArgs('out', 'https://youtu.be/x', browser)
    expect(args).not.toContain('--extractor-args')
    expect(args).toEqual(expect.arrayContaining(['--cookies-from-browser', 'edge']))
    expect(clientArgs(file)).toEqual([])
  })
})

describe('pace and archive', () => {
  it('adds no waiting at the fast pace, and more waiting when gentler', () => {
    expect(paceArgs('fast')).toEqual([])
    expect(paceArgs('balanced')).toContain('--sleep-interval')
    expect(paceArgs('gentle')).toEqual(expect.arrayContaining(['--max-sleep-interval', '10']))
  })

  it('asks yt-dlp to remember what it downloaded only when told to', () => {
    expect(buildDownloadArgs('out', 'u', off)).not.toContain('--download-archive')
    const args = buildDownloadArgs('out', 'u', off, { pace: 'gentle', archive: 'C:\\a b.txt' })
    expect(args).toEqual(expect.arrayContaining(['--download-archive', 'C:\\a b.txt']))
    expect(args).toContain('--sleep-requests')
    expect(args.slice(-2)).toEqual(['--', 'u'])
  })
})

describe('classifyYtDlpError', () => {
  it('recognises the bot check', () => {
    expect(
      classifyYtDlpError(
        "[youtube] abc: Sign in to confirm you're not a bot. Use --cookies-from-browser or --cookies"
      )
    ).toBe('sign-in')
  })

  it('recognises the exact message yt-dlp prints', () => {
    const real =
      '[youtube] 0AQMAth2gio: Sign in to confirm you\u2019re not a bot. Use --cookies-from-browser or --cookies for the authentication. See  https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp  for how to manually pass cookies. Also see  https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies  for tips on effectively exporting YouTube cookies'
    expect(classifyYtDlpError(real)).toBe('sign-in')
  })

  it('recognises problems with the cookies themselves', () => {
    expect(classifyYtDlpError('Could not copy Chrome cookie database. See https://x')).toBe(
      'cookies-unreadable'
    )
    expect(classifyYtDlpError('Failed to decrypt with DPAPI')).toBe('cookies-unreadable')
    expect(classifyYtDlpError('The provided YouTube account cookies are no longer valid.')).toBe(
      'cookies-expired'
    )
    expect(classifyYtDlpError('does not look like a Netscape format cookies file')).toBe(
      'cookie-file'
    )
  })

  it('leaves other errors alone', () => {
    expect(classifyYtDlpError('Video unavailable. This video is private')).toBe('other')
  })
})

describe('explainYtDlpProblem', () => {
  it('has no text for problems that are not about signing in', () => {
    expect(explainYtDlpProblem('other', false)).toBeNull()
  })

  it('tells to turn sign-in on, or that it did not work', () => {
    expect(explainYtDlpProblem('sign-in', false)?.full).toMatch(/Turn on YouTube sign-in/)
    expect(explainYtDlpProblem('sign-in', true)?.full).toMatch(/even with your cookies/)
  })
})

describe('start number', () => {
  const args = (startAt?: number) =>
    buildDownloadArgs(
      't',
      'https://youtu.be/x',
      { source: 'off', browser: 'firefox', file: '' },
      { startAt }
    )
  it('adds --playlist-start only after the first track', () => {
    expect(args(undefined)).not.toContain('--playlist-start')
    expect(args(1)).not.toContain('--playlist-start')
    const list = args(42)
    expect(list[list.indexOf('--playlist-start') + 1]).toBe('42')
  })
})

describe('rate limit', () => {
  it('knows the 429 error and does not call it a sign-in problem', () => {
    const message = 'Unable to download webpage: HTTP Error 429: Too Many Requests'
    expect(classifyYtDlpError(message)).toBe('rate-limit')
    expect(isSignInProblem('rate-limit')).toBe(false)
    expect(explainYtDlpProblem('rate-limit', true)?.short).toMatch(/too many/i)
  })
})
