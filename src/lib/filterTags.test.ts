import { describe, expect, it } from 'vitest'
import { matchesSearch, matchesTags, selectTags } from './filterTags'

const ids = (...values: number[]) => new Set(values)

describe('selectTags', () => {
  it('separates included and excluded tags and drops unknown ones', () => {
    const result = selectTags(
      { 1: 'include', 2: 'exclude', 3: 'include', 9: 'include' },
      ids(1, 2, 3)
    )
    expect(result).toEqual({ included: [1, 3], excluded: [2] })
  })
})

describe('matchesTags', () => {
  const selection = { included: [1, 2], excluded: [9] }

  it('needs one included tag in "any" mode', () => {
    expect(matchesTags(ids(2, 5), selection, 'any')).toBe(true)
    expect(matchesTags(ids(5), selection, 'any')).toBe(false)
  })

  it('needs every included tag in "all" mode', () => {
    expect(matchesTags(ids(1, 2), selection, 'all')).toBe(true)
    expect(matchesTags(ids(1), selection, 'all')).toBe(false)
  })

  it('always rejects an excluded tag', () => {
    expect(matchesTags(ids(1, 2, 9), selection, 'any')).toBe(false)
  })

  it('lets everything through without included tags', () => {
    expect(matchesTags(ids(), { included: [], excluded: [] }, 'all')).toBe(true)
    expect(matchesTags(ids(9), { included: [], excluded: [9] }, 'any')).toBe(false)
  })
})

describe('matchesSearch', () => {
  it('needs every word, in any order', () => {
    expect(matchesSearch('rainy forest night', ['forest', 'rainy'])).toBe(true)
    expect(matchesSearch('rainy forest night', ['forest', 'cave'])).toBe(false)
    expect(matchesSearch('anything', [])).toBe(true)
  })
})
