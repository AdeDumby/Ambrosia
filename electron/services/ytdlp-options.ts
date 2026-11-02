import type { DownloadPace, YoutubeCookies } from '../../src/shared/settings.ts'

/** The yt-dlp arguments that sign in to YouTube. Nothing when sign-in is off. */
export function cookieArgs(cookies: YoutubeCookies): string[] {
  if (cookies.source === 'browser') return ['--cookies-from-browser', cookies.browser]
  if (cookies.source === 'file' && cookies.file !== '') return ['--cookies', cookies.file]
  return []
}

export function usesCookies(cookies: YoutubeCookies): boolean {
  return cookieArgs(cookies).length > 0
}

/**
 * Without a sign-in, the android client is asked for. It cannot use cookies, so with cookies the
 * default clients of yt-dlp are used instead.
 */
export function clientArgs(cookies: YoutubeCookies): string[] {
  return usesCookies(cookies) ? [] : ['--extractor-args', 'youtube:player_client=android']
}

/**
 * Time left between requests, so that YouTube does not take a long playlist for a robot. The
 * gentle values are the ones the yt-dlp wiki gives for avoiding the rate limit.
 */
export function paceArgs(pace: DownloadPace): string[] {
  if (pace === 'balanced') {
    return ['--sleep-requests', '1', '--sleep-interval', '2', '--max-sleep-interval', '5']
  }
  if (pace === 'gentle') {
    return ['--sleep-requests', '1.5', '--sleep-interval', '5', '--max-sleep-interval', '10']
  }
  return []
}

export type DownloadExtras = {
  pace?: DownloadPace
  /** A file that remembers the videos that were downloaded, so a new launch skips them. */
  archive?: string
}

export function buildDownloadArgs(
  template: string,
  url: string,
  cookies: YoutubeCookies,
  extras: DownloadExtras = {}
): string[] {
  return [
    '--newline',
    // Write names as UTF-8 whatever the console would use, so a symbol or a letter of another
    // alphabet is not turned into "?".
    '--encoding',
    'utf-8',
    ...clientArgs(cookies),
    ...cookieArgs(cookies),
    ...paceArgs(extras.pace ?? 'fast'),
    ...(extras.archive ? ['--download-archive', extras.archive] : []),
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
}

export type YtDlpProblem =
  'sign-in' | 'cookies-unreadable' | 'cookies-expired' | 'cookie-file' | 'other'

/** Tells what a yt-dlp error message is about, for the messages that sign-in can fix. */
export function classifyYtDlpError(message: string): YtDlpProblem {
  if (/sign in to confirm|not a bot/i.test(message)) return 'sign-in'
  if (/no longer valid|have likely been rotated/i.test(message)) return 'cookies-expired'
  if (/cookie database|failed to decrypt|dpapi|keyring/i.test(message)) return 'cookies-unreadable'
  if (/netscape format|cookies? file/i.test(message)) return 'cookie-file'
  return 'other'
}

/** True for the problems that the YouTube sign-in settings are about. */
export function isSignInProblem(problem: YtDlpProblem): boolean {
  return problem !== 'other'
}

/** A short text for the list of tracks, and a full explanation. Null for other problems. */
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
