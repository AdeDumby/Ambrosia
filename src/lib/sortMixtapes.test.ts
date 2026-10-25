import { describe, expect, it } from 'vitest'
import type { Mixtape } from '../shared/mixtape'
import { effectiveMixtapeSort, sortMixtapes } from './sortMixtapes'

const tape = (id: number, name: string, tagCount = 0): Mixtape => ({
  id,
  name,
  master: 1,
  createdAt: '2026-10-25 10:00:00',
  layers: [],
  tags: Array.from({ length: tagCount }, (_, index) => ({
    folderOrder: 0,
    id: index + 1,
    name: `t${index}`,
    color: null
  }))
})

describe('sortMixtapes', () => {
  const tapes = [tape(1, 'Storm 10'), tape(2, 'Storm 2', 3), tape(3, 'Calm', 1)]

  it('sorts by name with numbers in order', () => {
    expect(sortMixtapes(tapes, 'name-asc').map((item) => item.name)).toEqual([
      'Calm',
      'Storm 2',
      'Storm 10'
    ])
    expect(sortMixtapes(tapes, 'name-desc').map((item) => item.id)).toEqual([1, 2, 3])
  })

  it('sorts by number of tags', () => {
    expect(sortMixtapes(tapes, 'most-tags').map((item) => item.id)).toEqual([2, 3, 1])
    expect(sortMixtapes(tapes, 'fewest-tags').map((item) => item.id)).toEqual([1, 3, 2])
  })

  it('falls back to name for sorts that only fit tracks, without touching the input', () => {
    const copy = [...tapes]
    expect(sortMixtapes(tapes, 'loudest').map((item) => item.id)).toEqual([3, 2, 1])
    expect(tapes).toEqual(copy)
    expect(effectiveMixtapeSort('longest')).toBe('name-asc')
    expect(effectiveMixtapeSort('most-tags')).toBe('most-tags')
  })
})
