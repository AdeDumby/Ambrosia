export type ShortcutAction =
  | { type: 'play-pause' }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'seek'; seconds: number }
  | { type: 'volume'; delta: number }
  | { type: 'shuffle' }
  | { type: 'repeat' }
  | { type: 'go'; route: string }
  | { type: 'search' }

export type KeyInfo = {
  key: string
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
  shiftKey: boolean
  repeat: boolean
}

export type Target = { tagName?: string; type?: string; isContentEditable?: boolean } | null

const KEYMAP: Record<string, ShortcutAction> = {
  ' ': { type: 'play-pause' },
  n: { type: 'next' },
  p: { type: 'previous' },
  ArrowRight: { type: 'seek', seconds: 5 },
  ArrowLeft: { type: 'seek', seconds: -5 },
  ArrowUp: { type: 'volume', delta: 0.05 },
  ArrowDown: { type: 'volume', delta: -0.05 },
  s: { type: 'shuffle' },
  r: { type: 'repeat' },
  '1': { type: 'go', route: '/' },
  '2': { type: 'go', route: '/review' },
  '3': { type: 'go', route: '/download' },
  '4': { type: 'go', route: '/settings' },
  '/': { type: 'search' }
}

const HOLDABLE = new Set(['seek', 'volume'])
const TEXT_LIKE = new Set(['text', 'search', 'number', 'password', 'email', 'url', 'tel', 'range'])

export function isTypingTarget(target: Target): boolean {
  if (!target) return false
  const tag = target.tagName?.toUpperCase()
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') return TEXT_LIKE.has((target.type ?? 'text').toLowerCase())
  return target.isContentEditable === true
}

export function actionFor(event: KeyInfo, target: Target): ShortcutAction | null {
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return null
  if (isTypingTarget(target)) return null
  const action = KEYMAP[event.key.length === 1 ? event.key.toLowerCase() : event.key]
  if (!action) return null
  if (event.repeat && !HOLDABLE.has(action.type)) return null
  return action
}
