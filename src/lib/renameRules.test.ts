import { describe, expect, it } from 'vitest'
import {
  RULE_PRESETS,
  compileRules,
  finalName,
  matchRanges,
  splitByRanges,
  tidy
} from './renameRules'

const rule = (find: string, replace = '', ignoreCase = false, id = 1) => ({
  id,
  find,
  replace,
  ignoreCase
})

describe('rules', () => {
  it('reproduces the PowerShell rename, with or without a capture group', () => {
    expect(
      finalName('01. FTL soundtrack-Space Cruise', compileRules([rule('^\\d+\\. FTL soundtrack-')]))
    ).toBe('Space Cruise')
    expect(
      finalName(
        '02. FTL soundtrack-Jungle Ambush',
        compileRules([rule('^\\d+\\. FTL soundtrack-(.+)$', '$1')])
      )
    ).toBe('Jungle Ambush')
  })

  it('runs rules in order and cleans up spaces after each one', () => {
    const compiled = compileRules([
      { ...RULE_PRESETS[1], id: 1 },
      { ...RULE_PRESETS[0], id: 2 }
    ])
    expect(finalName('01. Song (Live) [HD]', compiled)).toBe('Song')
  })

  it('can ignore case', () => {
    expect(finalName('Song OFFICIAL', compileRules([rule('official', '', true)]))).toBe('Song')
    expect(finalName('Song OFFICIAL', compileRules([rule('official')]))).toBe('Song OFFICIAL')
  })

  it('skips empty and invalid rules and reports the problem', () => {
    const compiled = compileRules([
      rule(''),
      rule('(', '', false, 2),
      rule('a'.repeat(201), '', false, 3)
    ])
    expect(compiled[0].error).toBeNull()
    expect(compiled[1].regex).toBeNull()
    expect(compiled[1].error).toBeTruthy()
    expect(compiled[2].error).toBeTruthy()
    expect(finalName(' keep  ', compiled)).toBe(' keep  ')
  })
})

describe('quick rules', () => {
  const cases: [string, string, string][] = [
    ['Leading track number', '01. Song', 'Song'],
    ['Leading track number', '12 - Name', 'Name'],
    ['Leading track number', '2001 A Space Odyssey', '2001 A Space Odyssey'],
    ['Text in brackets', 'Song (Official Video) [HD]', 'Song'],
    ['Everything before a dash', 'Artist - Title - Live', 'Title - Live'],
    ['Words like Official or Lyrics', 'Song Official Audio', 'Song'],
    ['Trailing dashes or underscores', 'Song - _', 'Song']
  ]

  it.each(cases)('%s: %s', (label, input, expected) => {
    const preset = RULE_PRESETS.find((candidate) => candidate.label === label)
    if (!preset) throw new Error(`No preset named ${label}`)
    expect(finalName(input, compileRules([{ ...preset, id: 1 }]))).toBe(expected)
  })
})

describe('highlighting', () => {
  it('lists non-empty matches only', () => {
    expect(matchRanges('abc', /x*/g)).toEqual([])
    expect(matchRanges('a1b22', /\d+/g)).toEqual([
      [1, 2],
      [3, 5]
    ])
  })

  it('splits text around the matches', () => {
    expect(
      splitByRanges('a1b22', [
        [1, 2],
        [3, 5]
      ])
    ).toEqual([
      { text: 'a', hit: false },
      { text: '1', hit: true },
      { text: 'b', hit: false },
      { text: '22', hit: true }
    ])
    expect(splitByRanges('', [])).toEqual([])
  })

  it('tidies spaces', () => {
    expect(tidy('  a   b ')).toBe('a b')
  })
})

describe('names with unusual symbols', () => {
  it('lets a pattern see a whole emoji or rare letter, not half of it', () => {
    const compiled = compileRules([{ id: 1, find: '^.', replace: '', ignoreCase: false }])
    expect(finalName('😀Boss Theme', compiled)).toBe('Boss Theme')
    expect(finalName('𠮷野家 Theme', compiled)).toBe('野家 Theme')
  })

  it('still accepts patterns that only work without the u flag', () => {
    const compiled = compileRules([{ id: 1, find: '\\_', replace: ' ', ignoreCase: false }])
    expect(compiled[0].error).toBeNull()
    expect(finalName('a_b', compiled)).toBe('a b')
  })

  it('removes broken and invisible characters from the result', () => {
    expect(finalName('Boss​ Theme﻿', [])).toBe('Boss Theme')
    expect(finalName('Half \ud83d', []).trim()).toBe('Half')
    expect(finalName('‮emehT', [])).toBe('emehT')
  })

  it('can use letters of any alphabet in a pattern', () => {
    const compiled = compileRules([
      { id: 1, find: '[^\\p{L}\\p{N} ]', replace: '', ignoreCase: false }
    ])
    expect(finalName('ゲーム♪ Theme!', compiled)).toBe('ゲーム Theme')
  })
})
