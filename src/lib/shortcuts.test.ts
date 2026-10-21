import { describe, expect, it } from 'vitest'
import { actionFor, type KeyInfo } from './shortcuts'

const key = (name: string, extra: Partial<KeyInfo> = {}): KeyInfo => ({
  key: name,
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
    expect(actionFor(key('2'), null)).toEqual({ type: 'go', route: '/review' })
  })

  it('stays out of text fields but not checkboxes or buttons', () => {
    expect(actionFor(key(' '), { tagName: 'INPUT', type: 'text' })).toBeNull()
    expect(actionFor(key('n'), { tagName: 'TEXTAREA' })).toBeNull()
    expect(actionFor(key('ArrowLeft'), { tagName: 'INPUT', type: 'range' })).toBeNull()
    expect(actionFor(key('n'), { tagName: 'INPUT', type: 'checkbox' })).toEqual({ type: 'next' })
    expect(actionFor(key('n'), { tagName: 'BUTTON' })).toEqual({ type: 'next' })
  })

  it('ignores combinations with modifier keys', () => {
    expect(actionFor(key('r', { ctrlKey: true }), null)).toBeNull()
    expect(actionFor(key('s', { altKey: true }), null)).toBeNull()
    expect(actionFor(key('/', { shiftKey: true }), null)).toBeNull()
  })

  it('lets only seek and volume repeat while a key is held', () => {
    expect(actionFor(key(' ', { repeat: true }), null)).toBeNull()
    expect(actionFor(key('ArrowRight', { repeat: true }), null)).toEqual({
      type: 'seek',
      seconds: 5
    })
  })

  it('ignores unmapped keys', () => {
    expect(actionFor(key('x'), null)).toBeNull()
  })
})
