export const MAX_FRANCHISE_NAME = 60

const HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be'
])
const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f]/
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
/**
 * Characters that cannot be saved as they are, or that make a name look different from what it
 * is: half of an emoji (a lone surrogate, which the disk turns into a replacement symbol),
 * control characters, zero-width and line-break characters, and the ones that reverse the text.
 */
const UNSAVABLE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]|[\u007f-\u009f\u200b\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff\ufffe\uffff]/g

export function hasUnsavableChars(text: string): boolean {
  return new RegExp(UNSAVABLE.source).test(text)
}

/** Removes the characters that cannot be saved (see hasUnsavableChars). */
export function removeUnsavableChars(text: string): string {
  return text.replace(UNSAVABLE, '')
}

/**
 * What Windows compares to tell whether two names are the same file: it ignores case with a
 * table of capital letters, one letter at a time. Lower casing misses some pairs (a final and a
 * normal sigma, for example), and a rename onto such a name would replace the other file.
 */
export function fsKey(name: string): string {
  let key = ''
  for (const letter of name) {
    const upper = letter.toUpperCase()
    key += [...upper].length === 1 ? upper : letter
  }
  return key
}

export type DownloadPhase = 'idle' | 'downloading' | 'downloaded' | 'failed' | 'cancelled'
export type ItemStatus = 'downloading' | 'converting' | 'done' | 'failed'

export type DownloadItem = {
  index: number
  title: string
  status: ItemStatus
  percent: number
  path: string | null
  error: string | null
}

export type FinishResult = { renamed: number; total: number; folder: string }

export type DownloadState = {
  phase: DownloadPhase
  franchise: string
  url: string
  folder: string
  total: number | null
  items: DownloadItem[]
  error: string | null
  log: string[]
  renameActive: boolean
  /** The failure is about signing in to YouTube, which the sign-in settings can fix. */
  signInProblem: boolean
}

/** What a check of the YouTube sign-in found. */
export type SignInCheck = { ok: boolean; message: string; version: string | null }

export function idleDownloadState(): DownloadState {
  return {
    phase: 'idle',
    franchise: '',
    url: '',
    folder: '',
    total: null,
    items: [],
    error: null,
    log: [],
    renameActive: false,
    signInProblem: false
  }
}

export function checkFranchise(raw: string): string | null {
  const name = raw.trim()
  if (name === '') return 'Give the folder a name.'
  if (name.length > MAX_FRANCHISE_NAME) return `Use at most ${MAX_FRANCHISE_NAME} characters.`
  if (FORBIDDEN.test(name)) {
    return 'A folder name cannot contain slashes, colons, quotes, asterisks, question marks, angle brackets or pipes.'
  }
  if (hasUnsavableChars(name)) return 'That name has invisible or broken characters.'
  if (name.endsWith('.') || RESERVED.test(name.split('.')[0])) {
    return 'Windows does not allow that folder name.'
  }
  if (name.toLowerCase() === '_deleted') return 'That folder name is reserved.'
  return null
}

export function checkUrl(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return 'That is not a valid link.'
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'The link must start with http:// or https://.'
  }
  if (!HOSTS.has(url.hostname.toLowerCase())) return 'Only YouTube links are supported for now.'
  return null
}

const MAX_NEW_NAME = 150

export function splitName(fileName: string): { stem: string; ext: string } {
  const dot = fileName.lastIndexOf('.')
  return dot > 0
    ? { stem: fileName.slice(0, dot), ext: fileName.slice(dot) }
    : { stem: fileName, ext: '' }
}

export function checkNewName(raw: string): string | null {
  const name = raw.trim()
  if (name === '') return 'The name cannot be empty.'
  if (name.length > MAX_NEW_NAME) return `Use at most ${MAX_NEW_NAME} characters.`
  if (FORBIDDEN.test(name)) return 'That name has characters Windows does not allow.'
  if (hasUnsavableChars(name)) return 'That name has invisible or broken characters. Retype it.'
  if (name.endsWith('.') || RESERVED.test(name.split('.')[0]))
    return 'Windows does not allow that name.'
  return null
}

export type NameProblem = 'empty' | 'invalid' | 'duplicate' | 'exists'

export function findNameProblems(
  items: { index: number; newName: string; path: string | null }[],
  existing: Set<string>
): Map<number, NameProblem> {
  const problems = new Map<number, NameProblem>()
  const seen = new Map<string, number[]>()

  for (const item of items) {
    const name = item.newName.trim()
    if (name === '') {
      problems.set(item.index, 'empty')
      continue
    }
    if (checkNewName(name)) {
      problems.set(item.index, 'invalid')
      continue
    }
    const key = fsKey(name)
    seen.set(key, [...(seen.get(key) ?? []), item.index])
  }

  for (const [key, indexes] of seen) {
    if (indexes.length > 1) for (const index of indexes) problems.set(index, 'duplicate')
    else if (existing.has(key)) problems.set(indexes[0], 'exists')
  }
  return problems
}
