import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LAYER_SETTINGS,
  cleanMixtapeName,
  parseMixtapeLayers,
  sanitizeLayerSettings
} from './mixtape'

describe('sanitizeLayerSettings', () => {
  it('gives the defaults for anything that is not an object', () => {
    expect(sanitizeLayerSettings(null)).toEqual(DEFAULT_LAYER_SETTINGS)
    expect(sanitizeLayerSettings('x')).toEqual(DEFAULT_LAYER_SETTINGS)
    expect(sanitizeLayerSettings(undefined)).toEqual(DEFAULT_LAYER_SETTINGS)
  })

  it('keeps every value inside its range', () => {
    const result = sanitizeLayerSettings({
      volume: 4,
      pan: -9,
      speed: 10,
      fadeIn: 500,
      eqLow: 40,
      eqHigh: -40,
      reverb: 2,
      startAt: -5
    })
    expect(result.volume).toBe(1)
    expect(result.pan).toBe(-1)
    expect(result.speed).toBe(2)
    expect(result.fadeIn).toBe(30)
    expect(result.eqLow).toBe(12)
    expect(result.eqHigh).toBe(-12)
    expect(result.reverb).toBe(1)
    expect(result.startAt).toBe(0)
  })

  it('ignores values of the wrong type', () => {
    const result = sanitizeLayerSettings({ volume: 'loud', loop: 'yes', pan: NaN, solo: 1 })
    expect(result.volume).toBe(0)
    expect(result.loop).toBe(false)
    expect(result.pan).toBe(0)
    expect(result.solo).toBe(false)
  })

  it('treats an end before the start as "until the end"', () => {
    expect(sanitizeLayerSettings({ startAt: 10, endAt: 5 }).endAt).toBe(0)
    expect(sanitizeLayerSettings({ startAt: 10, endAt: 10 }).endAt).toBe(0)
    expect(sanitizeLayerSettings({ startAt: 10, endAt: 20 }).endAt).toBe(20)
  })

  it('never lets the longest gap be shorter than the shortest', () => {
    const result = sanitizeLayerSettings({ gapMin: 8, gapMax: 2 })
    expect(result.gapMin).toBe(8)
    expect(result.gapMax).toBe(8)
  })

  it('keeps a change on top of the settings it is given', () => {
    const base = sanitizeLayerSettings({ volume: 0.5, loop: true })
    const result = sanitizeLayerSettings({ pan: 0.5 }, base)
    expect(result.volume).toBe(0.5)
    expect(result.loop).toBe(true)
    expect(result.pan).toBe(0.5)
  })
})

describe('parseMixtapeLayers', () => {
  it('reads layers and drops a second layer of the same track', () => {
    const result = parseMixtapeLayers([
      { trackId: 3, volume: 0.5 },
      { trackId: 3, volume: 1 },
      { trackId: 4, loop: true }
    ])
    expect(result.map((layer) => layer.trackId)).toEqual([3, 4])
    expect(result[0].volume).toBe(0.5)
    expect(result[1].loop).toBe(true)
  })

  it('refuses anything that is not a list of layers with a track', () => {
    expect(() => parseMixtapeLayers('nope')).toThrow()
    expect(() => parseMixtapeLayers([{ volume: 1 }])).toThrow()
    expect(() => parseMixtapeLayers([{ trackId: 1.5 }])).toThrow()
    expect(() => parseMixtapeLayers([{ trackId: -2 }])).toThrow()
  })
})

describe('cleanMixtapeName', () => {
  it('trims and collapses spaces but keeps the letters as typed', () => {
    expect(cleanMixtapeName('  Rainy   forest  night ')).toBe('Rainy forest night')
  })
})
