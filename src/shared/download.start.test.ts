import { describe, expect, it } from 'vitest'
import { checkStartAt, parseStartAt } from './download.ts'

describe('checkStartAt', () => {
  it('accepts empty and whole numbers', () => {
    for (const ok of ['', '  ', '1', ' 25 ', '100000']) expect(checkStartAt(ok)).toBeNull()
  })
  it('refuses the rest', () => {
    for (const bad of ['0', '-3', '2.5', 'abc', '1e3', '100001', '٣']) {
      expect(checkStartAt(bad)).not.toBeNull()
    }
  })
  it('parses to a number, 1 when empty', () => {
    expect(parseStartAt('')).toBe(1)
    expect(parseStartAt(' 25 ')).toBe(25)
  })
})
