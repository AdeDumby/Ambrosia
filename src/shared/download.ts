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

export type DownloadState = {
  phase: DownloadPhase
  franchise: string
  url: string
  folder: string
  total: number | null
  items: DownloadItem[]
  error: string | null
  log: string[]
}

export function idleDownloadState(): DownloadState {
  return {
    phase: 'idle',
    franchise: '',
    url: '',
    folder: '',
    total: null,
    items: [],
    error: null,
    log: []
  }
}

export function checkFranchise(raw: string): string | null {
  const name = raw.trim()
  if (name === '') return 'Give the folder a name.'
  if (name.length > MAX_FRANCHISE_NAME) return `Use at most ${MAX_FRANCHISE_NAME} characters.`
  if (FORBIDDEN.test(name)) {
    return 'A folder name cannot contain slashes, colons, quotes, asterisks, question marks, angle brackets or pipes.'
  }
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
