import { describe, expect, it } from 'vitest'
import {
  checkFranchise,
  checkNewName,
  findNameProblems,
  fsKey,
  hasUnsavableChars,
  removeUnsavableChars
} from './download'

describe('unsavable characters', () => {
  it('finds half symbols, invisible characters and text reversers', () => {
    for (const text of ['a\ud83d', '\ude00a', 'a​b', 'a‮b', 'a﻿b', 'a\u0085b', 'a\u007fb']) {
      expect(hasUnsavableChars(text)).toBe(true)
    }
  })

  it('accepts whole emoji, accents and other alphabets', () => {
    for (const text of ['😀', 'Étude', 'ゲーム♪', 'Тема', '𠮷', 'Zoë‍', 'ś']) {
      expect(hasUnsavableChars(text.replace('‍', ''))).toBe(false)
    }
  })

  it('removes only those characters', () => {
    expect(removeUnsavableChars('A​B\ud83dC😀')).toBe('ABC😀')
  })

  it('is refused by the name checks', () => {
    expect(checkNewName('Boss​')).toMatch(/invisible or broken/)
    expect(checkFranchise('Fire‮Emblem')).toMatch(/invisible or broken/)
    expect(checkNewName('Boss 😀')).toBeNull()
  })
})

describe('fsKey', () => {
  it('treats names the way Windows does', () => {
    expect(fsKey('Boss')).toBe(fsKey('BOSS'))
    expect('Σ'.toLowerCase()).not.toBe('ς'.toLowerCase())
    expect(fsKey('ς')).toBe(fsKey('σ'))
    expect(fsKey('ß')).not.toBe(fsKey('ss'))
  })

  it('catches two new names that would end up as one file', () => {
    const problems = findNameProblems(
      [
        { index: 1, path: null, newName: 'Ὀδυσσεύς.mp3' },
        { index: 2, path: null, newName: 'ὀδυσσεύσ.mp3' }
      ],
      new Set()
    )
    expect(problems.get(1)).toBe('duplicate')
    expect(problems.get(2)).toBe('duplicate')
  })
})
