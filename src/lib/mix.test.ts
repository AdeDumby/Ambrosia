import { describe, expect, it } from 'vitest'
import { MAX_LAYERS, clampVolume, layerGain, mixReducer, type MixLayer } from './mix'

const layer = (trackId: number, change: Partial<MixLayer> = {}): MixLayer => ({
  trackId,
  volume: 0,
  loop: false,
  playing: false,
  ...change
})

describe('mixReducer', () => {
  it('adds a played track as a silent, paused layer at the top', () => {
    const result = mixReducer([layer(1)], { type: 'add', trackId: 2 })
    expect(result).toEqual([layer(2), layer(1)])
  })

  it('does not add a track twice or move its layer', () => {
    const start = [layer(2, { volume: 0.5, playing: true }), layer(1)]
    expect(mixReducer(start, { type: 'add', trackId: 1 })).toBe(start)
  })

  it('keeps the volume between 0 and 1', () => {
    const start = [layer(1)]
    expect(mixReducer(start, { type: 'volume', trackId: 1, volume: 3 })[0].volume).toBe(1)
    expect(mixReducer(start, { type: 'volume', trackId: 1, volume: -1 })[0].volume).toBe(0)
    expect(mixReducer(start, { type: 'volume', trackId: 1, volume: NaN })[0].volume).toBe(0)
    expect(clampVolume(0.25)).toBe(0.25)
  })

  it('changes only the layer it is told to', () => {
    const start = [layer(1), layer(2)]
    const result = mixReducer(start, { type: 'loop', trackId: 2, loop: true })
    expect(result[0]).toBe(start[0])
    expect(result[1].loop).toBe(true)
  })

  it('ignores an unknown track', () => {
    const start = [layer(1)]
    expect(mixReducer(start, { type: 'playing', trackId: 9, playing: true })).toBe(start)
  })

  it('removes a layer', () => {
    expect(mixReducer([layer(1), layer(2)], { type: 'remove', trackId: 1 })).toEqual([layer(2)])
  })

  it('removes layers whose track is gone from the library', () => {
    const start = [layer(1), layer(2), layer(3)]
    const result = mixReducer(start, { type: 'remove-missing', existingIds: new Set([1, 3]) })
    expect(result.map((item) => item.trackId)).toEqual([1, 3])
    expect(mixReducer(start, { type: 'remove-missing', existingIds: new Set([1, 2, 3]) })).toBe(
      start
    )
  })

  it('plays every audible layer and leaves silent ones paused', () => {
    const start = [layer(1, { volume: 0.4 }), layer(2), layer(3, { volume: 0.2, playing: true })]
    const result = mixReducer(start, { type: 'play-all' })
    expect(result.map((item) => item.playing)).toEqual([true, false, true])
  })

  it('pauses everything', () => {
    const start = [layer(1, { playing: true }), layer(2)]
    expect(mixReducer(start, { type: 'pause-all' }).every((item) => !item.playing)).toBe(true)
  })

  it('removes silent layers but keeps audible and playing ones', () => {
    const start = [layer(1), layer(2, { volume: 0.5 }), layer(3, { playing: true })]
    const result = mixReducer(start, { type: 'remove-silent' })
    expect(result.map((item) => item.trackId)).toEqual([2, 3])
  })

  it('clears the mix', () => {
    expect(mixReducer([layer(1), layer(2)], { type: 'clear' })).toEqual([])
  })

  it('drops the oldest idle layer once there are too many', () => {
    let layers: MixLayer[] = []
    for (let id = 1; id <= MAX_LAYERS; id += 1)
      layers = mixReducer(layers, { type: 'add', trackId: id })
    layers = mixReducer(layers, { type: 'playing', trackId: 1, playing: true })

    layers = mixReducer(layers, { type: 'add', trackId: 999 })
    expect(layers).toHaveLength(MAX_LAYERS)
    expect(layers[0].trackId).toBe(999)
    // Track 1 is the oldest but is playing, so the next oldest one goes.
    expect(layers.some((item) => item.trackId === 1)).toBe(true)
    expect(layers.some((item) => item.trackId === 2)).toBe(false)
  })

  it('keeps every layer when all of them are playing', () => {
    let layers: MixLayer[] = []
    for (let id = 1; id <= MAX_LAYERS; id += 1) {
      layers = mixReducer(layers, { type: 'add', trackId: id })
      layers = mixReducer(layers, { type: 'playing', trackId: id, playing: true })
    }
    const result = mixReducer(layers, { type: 'add', trackId: 999 })
    expect(result).toBe(layers)
  })
})

describe('layerGain', () => {
  it('multiplies the volume by the loudness correction', () => {
    expect(layerGain(0.5, 2)).toBe(1)
    expect(layerGain(0, 3)).toBe(0)
    expect(layerGain(5, 1)).toBe(1)
  })
})
