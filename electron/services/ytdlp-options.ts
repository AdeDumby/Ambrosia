import type { DownloadPace, YoutubeCookies } from '../../src/shared/settings.ts'

export function cookieArgs(cookies: YoutubeCookies): string[] {
  if (cookies.source === 'browser') return ['--cookies-from-browser', cookies.browser]
  if (cookies.source === 'file' && cookies.file !== '') return ['--cookies', cookies.file]
  return []
}

export function usesCookies(cookies: YoutubeCookies): boolean {
  return cookieArgs(cookies).length > 0
}

export function clientArgs(cookies: YoutubeCookies): string[] {
  return usesCookies(cookies) ? [] : ['--extractor-args', 'youtube:player_client=android']
}

export function paceArgs(pace: DownloadPace): string[] {
  if (pace === 'balanced') {
    return ['--sleep-requests', '1', '--sleep-interval', '2', '--max-sleep-interval', '5']
  }
  if (pace === 'gentle') {
    return ['--sleep-requests', '3', '--sleep-interval', '10', '--max-sleep-interval', '25']
  }
  return []
}

export type DownloadExtras = {
  pace?: DownloadPace
  archive?: string
  startAt?: number
  items?: number[]
}

export function itemsArg(items: number[]): string {
  const sorted = [...new Set(items)].sort((a, b) => a - b)
  const parts: string[] = []
  for (let i = 0; i < sorted.length;) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j += 1
    parts.push(j > i ? `${sorted[i]}-${sorted[j]}` : String(sorted[i]))
    i = j + 1
  }
  return parts.join(',')
}

export function buildDownloadArgs(
  template: string,
  url: string,
  cookies: YoutubeCookies,
  extras: DownloadExtras = {}
): string[] {
  return [
    '--newline',
    '--encoding',
    'utf-8',
    ...clientArgs(cookies),
    ...cookieArgs(cookies),
    ...paceArgs(extras.pace ?? 'fast'),
    ...(extras.items && extras.items.length > 0
      ? ['--playlist-items', itemsArg(extras.items)]
      : extras.startAt && extras.startAt > 1
        ? ['--playlist-start', String(extras.startAt)]
        : []),
    ...(extras.archive ? ['--download-archive', extras.archive] : []),
    '-x',
    '--audio-format',
    'mp3',
    '--audio-quality',
    '192K',
    '--embed-thumbnail',
    '--add-metadata',
    '--parse-metadata',
    '%(id)s:%(meta_ambrosia_id)s',
    '-o',
    template,
    '--',
    url
  ]
}

export type YtDlpProblem =
  'sign-in' | 'rate-limit' | 'cookies-unreadable' | 'cookies-expired' | 'cookie-file' | 'other'

export function classifyYtDlpError(message: string): YtDlpProblem {
  if (/sign in to confirm|not a bot/i.test(message)) return 'sign-in'
  if (/http error 429|too many requests|rate.?limit/i.test(message)) return 'rate-limit'
  if (/no longer valid|have likely been rotated/i.test(message)) return 'cookies-expired'
  if (/cookie database|failed to decrypt|dpapi|keyring/i.test(message)) return 'cookies-unreadable'
  if (/netscape format|cookies? file/i.test(message)) return 'cookie-file'
  return 'other'
}

export function isSignInProblem(problem: YtDlpProblem): boolean {
  return problem !== 'other' && problem !== 'rate-limit'
}

export function explainYtDlpProblem(
  problem: YtDlpProblem,
  signedIn: boolean
): { short: string; full: string } | null {
  switch (problem) {
    case 'sign-in':
      return signedIn
        ? {
            short: 'YouTube still asks to sign in',
            full: 'YouTube still asks to sign in, even with your cookies. They may be old, or come from a browser that is not signed in to YouTube. Export them again, or pick another browser.'
          }
        : {
            short: 'YouTube asks to sign in',
            full: 'YouTube is asking for proof that you are not a bot. Turn on YouTube sign-in in the YouTube sign-in box, then press Start over.'
          }
    case 'rate-limit':
      return {
        short: 'YouTube says too many requests',
        full: 'YouTube is slowing this connection down (error 429: too many requests). Ambrosia waits and tries again by itself. If it keeps happening, wait an hour or two, or change connection (a VPN or phone hotspot), then use Start at track number to go on.'
      }
    case 'cookies-unreadable':
      return {
        short: 'Could not read the cookies',
        full: 'Ambrosia could not read the cookies of that browser. Close the browser and try again, pick Firefox, or use a cookies file.'
      }
    case 'cookies-expired':
      return {
        short: 'The cookies expired',
        full: 'YouTube no longer accepts those cookies, because the browser replaced them. Export a fresh cookies file from a private window, or use another browser.'
      }
    case 'cookie-file':
      return {
        short: 'Cookies file not readable',
        full: 'yt-dlp could not read the cookies file. It must be a cookies.txt file in the Netscape format.'
      }
    default:
      return null
  }
}
