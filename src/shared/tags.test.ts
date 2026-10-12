import { describe, expect, it } from 'vitest'
import { compareNames, foldText, formatTagName } from './tags'

describe('formatTagName', () => {
  it('capitalizes each word and keeps single spaces', () => {
    expect(formatTagName('ace attorney')).toBe('Ace Attorney')
    expect(formatTagName('  sea   of  stars ')).toBe('Sea Of Stars')
  })

  it('keeps capitals inside a word and fixes the first letter', () => {
    expect(formatTagName('mcDonald')).toBe('McDonald')
    expect(formatTagName('BRIAR EQUIVALENT')).toBe('BRIAR EQUIVALENT')
  })

  it('capitalizes after a hyphen but not after an apostrophe', () => {
    expect(formatTagName('light-hearted')).toBe('Light-Hearted')
    expect(formatTagName("li'nan port")).toBe("Li'nan Port")
  })

  it('handles accents, digits and empty input', () => {
    expect(formatTagName('éclair au chocolat')).toBe('Éclair Au Chocolat')
    expect(formatTagName('location 235')).toBe('Location 235')
    expect(formatTagName('   ')).toBe('')
  })
})

describe('foldText', () => {
  it('removes accents and case', () => {
    expect(foldText('Café Crème')).toBe('cafe creme')
    expect(foldText('ÉCLAIR')).toBe('eclair')
  })
})

describe('compareNames', () => {
  it('sorts accented letters after their plain letters', () => {
    const sorted = ['Zebra', 'Éclair', 'Eclair', 'Ecole', 'Eagle'].sort(compareNames)
    expect(sorted).toEqual(['Eagle', 'Eclair', 'Éclair', 'Ecole', 'Zebra'])
  })

  it('ignores case and sorts numbers naturally', () => {
    expect(['b', 'A', 'c'].sort(compareNames)).toEqual(['A', 'b', 'c'])
    expect(['Part 10', 'Part 2'].sort(compareNames)).toEqual(['Part 2', 'Part 10'])
  })
})
