import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../../src/shared/settings.ts'
import { parseSettings, parseYoutubeCookies } from './settings.services.ts'

describe('YouTube sign-in settings', () => {
  it('is off for settings saved before it existed', () => {
    expect(parseSettings({}).download).toEqual(DEFAULT_SETTINGS.download)
    expect(parseSettings({ playback: { normalize: false } }).download.cookies.source).toBe('off')
  })

  it('keeps a valid choice', () => {
    expect(
      parseYoutubeCookies({ source: 'browser', browser: 'edge', file: ' C:\\cookies.txt ' })
    ).toEqual({ source: 'browser', browser: 'edge', file: 'C:\\cookies.txt' })
  })

  it('falls back to safe values for anything else', () => {
    expect(parseYoutubeCookies({ source: 'ftp', browser: 'netscape', file: 5 })).toEqual({
      source: 'off',
      browser: 'firefox',
      file: ''
    })
    expect(parseYoutubeCookies(null).source).toBe('off')
  })

  it('refuses a path that is too long or has a null character', () => {
    expect(parseYoutubeCookies({ source: 'file', file: 'a'.repeat(501) }).file).toBe('')
    expect(parseYoutubeCookies({ source: 'file', file: 'a\0b' }).file).toBe('')
  })

  it('round trips through parseSettings', () => {
    const saved = parseSettings({ download: { cookies: { source: 'file', file: 'C:\\c.txt' } } })
    expect(parseSettings(JSON.parse(JSON.stringify(saved))).download.cookies).toEqual({
      source: 'file',
      browser: 'firefox',
      file: 'C:\\c.txt'
    })
  })
})
