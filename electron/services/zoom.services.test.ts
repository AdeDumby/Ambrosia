import { describe, expect, it } from 'vitest'
import { nextZoom, zoomDirection } from './zoom.services.ts'

const input = (key: string, extra: Record<string, unknown> = {}) => ({
  type: 'keyDown',
  key,
  control: true,
  alt: false,
  meta: false,
  ...extra
})

describe('zoomDirection', () => {
  it('zooms in on plus and equals, out on minus, with Ctrl held', () => {
    expect(zoomDirection(input('+'))).toBe(1)
    expect(zoomDirection(input('='))).toBe(1)
    expect(zoomDirection(input('-'))).toBe(-1)
  })

  it('ignores other keys, missing Ctrl, Alt (AltGr) and key releases', () => {
    expect(zoomDirection(input('a'))).toBeNull()
    expect(zoomDirection(input('+', { control: false }))).toBeNull()
    expect(zoomDirection(input('+', { alt: true }))).toBeNull()
    expect(zoomDirection(input('-', { type: 'keyUp' }))).toBeNull()
  })
})

describe('nextZoom', () => {
  it('moves in exact 5% steps', () => {
    let factor = 1
    for (let step = 0; step < 5; step += 1) factor = nextZoom(factor, 1)
    expect(factor).toBe(1.25)
    for (let step = 0; step < 3; step += 1) factor = nextZoom(factor, -1)
    expect(factor).toBe(1.1)
  })

  it('stops at 50% and 200%', () => {
    expect(nextZoom(2, 1)).toBe(2)
    expect(nextZoom(0.5, -1)).toBe(0.5)
  })
})
