import type { BrowserWindow } from 'electron'
import type { DatabaseSync } from 'node:sqlite'

const KEY = 'zoom-factor'
const STEP = 0.05
const MIN = 0.5
const MAX = 2

type ZoomInput = { type: string; key: string; control: boolean; alt: boolean; meta: boolean }

export function zoomDirection(input: ZoomInput): 1 | -1 | null {
  if (input.type !== 'keyDown' || !input.control || input.alt || input.meta) return null
  if (input.key === '+' || input.key === '=') return 1
  if (input.key === '-') return -1
  return null
}

export function nextZoom(current: number, direction: 1 | -1): number {
  const stepped = Math.round((current + direction * STEP) * 100) / 100
  return Math.min(MAX, Math.max(MIN, stepped))
}

export function setupZoom(win: BrowserWindow, db: DatabaseSync): void {
  const row = db.prepare('SELECT value FROM setting WHERE key = ?').get(KEY) as unknown as
    { value: string } | undefined
  const stored = Number(row?.value)
  let factor = Number.isFinite(stored) && stored >= MIN && stored <= MAX ? stored : 1

  win.webContents.on('did-finish-load', () => win.webContents.setZoomFactor(factor))
  win.webContents.on('before-input-event', (event, input) => {
    const direction = zoomDirection(input)
    if (!direction) return
    event.preventDefault()
    factor = nextZoom(factor, direction)
    win.webContents.setZoomFactor(factor)
    db.prepare(
      `INSERT INTO setting (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(KEY, String(factor))
  })
}
