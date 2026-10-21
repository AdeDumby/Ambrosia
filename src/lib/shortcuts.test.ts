import { describe, expect, it } from 'vitest'
import { actionFor, createChord, volumeStep, type KeyInfo } from './shortcuts'

const key = (name: string, extra: Partial<KeyInfo> = {}): KeyInfo => ({
  key: name,
  code: '',
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  shiftKey: false,
  repeat: false,
  ...extra
})

describe('actionFor', () => {
  it('maps plain keys, ignoring letter case', () => {
    expect(actionFor(key(' '), null)).toEqual({ type: 'play-pause' })
    expect(actionFor(key('N'), null)).toEqual({ type: 'next' })
    expect(actionFor(key('q'), null)).toEqual({ type: 'random' })
    expect(actionFor(key('ArrowLeft'), null)).toEqual({ type: 'seek', seconds: -10 })
    expect(actionFor(key('ArrowDown'), null)).toEqual({ type: 'volume', direction: -1 })
  })

  it('reads page digits from the physical key, so AZERTY works with or without Shift', () => {
    expect(actionFor(key('&', { code: 'Digit1' }), null)).toEqual({ type: 'go', route: '/' })
    expect(actionFor(key('2', { code: 'Digit2', shiftKey: true }), null)).toEqual({
      type: 'go',
      route: '/review'
    })
    expect(actionFor(key('3', { code: 'Numpad3' }), null)).toEqual({
      type: 'go',
      route: '/download'
    })
    expect(actionFor(key('ArrowDown', { code: 'Numpad2' }), null)).toEqual({
      type: 'volume',
      direction: -1
    })
    expect(actionFor(key('5', { code: 'Digit5' }), null)).toBeNull()
  })

  it('accepts the slash with or without Shift', () => {
    expect(actionFor(key('/'), null)).toEqual({ type: 'focus' })
    expect(actionFor(key('/', { shiftKey: true }), null)).toEqual({ type: 'focus' })
  })

  it('stays out of text fields but not checkboxes or buttons', () => {
    expect(actionFor(key(' '), { tagName: 'INPUT', type: 'text' })).toBeNull()
    expect(actionFor(key('n'), { tagName: 'TEXTAREA' })).toBeNull()
    expect(actionFor(key('ArrowLeft'), { tagName: 'INPUT', type: 'range' })).toBeNull()
    expect(actionFor(key('n'), { tagName: 'INPUT', type: 'checkbox' })).toEqual({ type: 'next' })
    expect(actionFor(key('n'), { tagName: 'BUTTON' })).toEqual({ type: 'next' })
  })

  it('ignores letters with Ctrl, Alt, Meta or Shift', () => {
    expect(actionFor(key('r', { ctrlKey: true }), null)).toBeNull()
    expect(actionFor(key('s', { altKey: true }), null)).toBeNull()
    expect(actionFor(key('n', { shiftKey: true }), null)).toBeNull()
    expect(actionFor(key('1', { code: 'Digit1', ctrlKey: true }), null)).toBeNull()
  })

  it('lets only seek and volume repeat while a key is held', () => {
    expect(actionFor(key(' ', { repeat: true }), null)).toBeNull()
    expect(actionFor(key('/', { repeat: true }), null)).toBeNull()
    expect(actionFor(key('ArrowRight', { repeat: true }), null)).toEqual({
      type: 'seek',
      seconds: 10
    })
  })

  it('ignores unmapped keys', () => {
    expect(actionFor(key('x'), null)).toBeNull()
  })
})

describe('volumeStep', () => {
  it('moves by 2 points, then by 5 once held for 3 seconds', () => {
    expect(volumeStep(0)).toBe(0.02)
    expect(volumeStep(2999)).toBe(0.02)
    expect(volumeStep(3000)).toBe(0.05)
  })
})

describe('createChord', () => {
  const modifier = (name: string, ctrlKey: boolean, altKey: boolean) => ({
    key: name,
    ctrlKey,
    altKey,
    repeat: false
  })

  it('fires once when Ctrl and Alt are released, in either order', () => {
    const chord = createChord()
    chord.down(modifier('Control', true, false))
    chord.down(modifier('Alt', true, true))
    expect(chord.up({ key: 'Alt' })).toBe(true)
    expect(chord.up({ key: 'Control' })).toBe(false)
  })

  it('does not fire when another key was pressed in between', () => {
    const chord = createChord()
    chord.down(modifier('Alt', false, true))
    chord.down(modifier('Control', true, true))
    chord.down(modifier('a', true, true))
    expect(chord.up({ key: 'Control' })).toBe(false)
  })

  it('ignores AltGr and a single modifier', () => {
    const chord = createChord()
    chord.down(modifier('Control', true, false))
    chord.down(modifier('AltGraph', true, true))
    expect(chord.up({ key: 'AltGraph' })).toBe(false)
    expect(chord.up({ key: 'Control' })).toBe(false)
  })
})
