import { describe, expect, it } from 'vitest'
import { isFullHex, parseHex } from './color'

describe('parseHex', () => {
  it('accepts six digits with or without the hash, in any case', () => {
    expect(parseHex('#AD88DD')).toBe('#ad88dd')
    expect(parseHex('ad88dd')).toBe('#ad88dd')
  })

  it('expands the three digit shorthand', () => {
    expect(parseHex('#a8d')).toBe('#aa88dd')
    expect(parseHex('FFF')).toBe('#ffffff')
  })

  it('ignores spaces around the value', () => {
    expect(parseHex('  #0c0817 \n')).toBe('#0c0817')
  })

  it('rejects anything else', () => {
    for (const text of [
      '',
      '#',
      '#12',
      '#12345',
      '#1234567',
      '#aabbccdd',
      '#gggggg',
      'rgb(1,2,3)',
      '12 34 56'
    ]) {
      expect(parseHex(text)).toBeNull()
    }
  })
})

describe('isFullHex', () => {
  it('is true only for six digits', () => {
    expect(isFullHex('#ad88dd')).toBe(true)
    expect(isFullHex('ad88dd')).toBe(true)
    expect(isFullHex('#a8d')).toBe(false)
  })
})
