export type ShortcutAction =
  | { type: 'play-pause' }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'seek'; seconds: number }
  | { type: 'volume'; direction: 1 | -1 }
  | { type: 'shuffle' }
  | { type: 'repeat' }
  | { type: 'random' }
  | { type: 'go'; route: string }
  | { type: 'focus' }

export type KeyInfo = {
  key: string
  code: string
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
  shiftKey: boolean
  repeat: boolean
}

export type Target = { tagName?: string; type?: string; isContentEditable?: boolean } | null

export const SEEK_SECONDS = 10
export const HOLD_TICK_MS = 200
export const VOLUME_STEP = 0.02
export const VOLUME_BOOST_STEP = 0.05
export const VOLUME_BOOST_AFTER_MS = 3000

const KEYMAP: Record<string, ShortcutAction> = {
  ' ': { type: 'play-pause' },
  n: { type: 'next' },
  p: { type: 'previous' },
  s: { type: 'shuffle' },
  r: { type: 'repeat' },
  q: { type: 'random' },
  ArrowRight: { type: 'seek', seconds: SEEK_SECONDS },
  ArrowLeft: { type: 'seek', seconds: -SEEK_SECONDS },
  ArrowUp: { type: 'volume', direction: 1 },
  ArrowDown: { type: 'volume', direction: -1 }
}

const PAGES: Record<string, string> = {
  '1': '/',
  '2': '/review',
  '3': '/download',
  '4': '/settings'
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

function allowRepeat(event: KeyInfo, action: ShortcutAction): ShortcutAction | null {
  return event.repeat && !HOLDABLE.has(action.type) ? null : action
}

export function actionFor(event: KeyInfo, target: Target): ShortcutAction | null {
  if (event.ctrlKey || event.altKey || event.metaKey) return null
  if (isTypingTarget(target)) return null

  const digit =
    /^Digit([1-4])$/.exec(event.code)?.[1] ??
    (event.code.startsWith('Numpad') && /^[1-4]$/.test(event.key) ? event.key : undefined)
  if (digit) return allowRepeat(event, { type: 'go', route: PAGES[digit] })
  if (event.key === '/') return allowRepeat(event, { type: 'focus' })

  if (event.shiftKey) return null
  const action = KEYMAP[event.key.length === 1 ? event.key.toLowerCase() : event.key]
  return action ? allowRepeat(event, action) : null
}

export function volumeStep(heldMs: number): number {
  return heldMs >= VOLUME_BOOST_AFTER_MS ? VOLUME_BOOST_STEP : VOLUME_STEP
}

export type ChordKey = { key: string; ctrlKey: boolean; altKey: boolean; repeat: boolean }

export function createChord() {
  let armed = false
  return {
    down(event: ChordKey): void {
      if (event.key === 'Control' || event.key === 'Alt') {
        if (event.ctrlKey && event.altKey && !event.repeat) armed = true
      } else {
        armed = false
      }
    },
    up(event: { key: string }): boolean {
      if (armed && (event.key === 'Control' || event.key === 'Alt')) {
        armed = false
        return true
      }
      return false
    },
    reset(): void {
      armed = false
    }
  }
}
