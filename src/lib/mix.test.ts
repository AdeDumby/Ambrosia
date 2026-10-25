import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYER_SETTINGS, type LayerSettings, type MixtapeLayer } from '../shared/mixtape'
import {
  MAX_LAYERS,
  clampVolume,
  fadePlan,
  isAudible,
  layerGain,
  loopGap,
  mixReducer,
  playWindow,
  startPosition,
  toMixtapeLayer,
  usesNativeLoop,
  type MixLayer
} from './mix'

const layer = (trackId: number, change: Partial<MixLayer> = {}): MixLayer => ({
  trackId,
  ...DEFAULT_LAYER_SETTINGS,
  playing: false,
  ...change
})

const saved = (trackId: number, change: Partial<LayerSettings> = {}): MixtapeLayer => ({
  trackId,
  ...DEFAULT_LAYER_SETTINGS,
  ...change
})

const settings = (change: Partial<LayerSettings> = {}): LayerSettings => ({
  ...DEFAULT_LAYER_SETTINGS,
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

  it('changes any setting of a layer and keeps it inside its range', () => {
    const start = [layer(1)]
    const result = mixReducer(start, {
      type: 'set',
      trackId: 1,
      patch: { volume: 3, pan: -0.5, eqLow: 40, loop: true }
    })
    expect(result[0].volume).toBe(1)
    expect(result[0].pan).toBe(-0.5)
    expect(result[0].eqLow).toBe(12)
    expect(result[0].loop).toBe(true)
    expect(result[0].playing).toBe(false)
    expect(mixReducer(start, { type: 'set', trackId: 1, patch: { volume: NaN } })[0].volume).toBe(0)
  })

  it('changes only the layer it is told to', () => {
    const start = [layer(1), layer(2)]
    const result = mixReducer(start, { type: 'set', trackId: 2, patch: { loop: true } })
    expect(result[0]).toBe(start[0])
    expect(result[1].loop).toBe(true)
  })

  it('ignores an unknown track', () => {
    const start = [layer(1)]
    expect(mixReducer(start, { type: 'playing', trackId: 9, playing: true })).toBe(start)
    expect(mixReducer(start, { type: 'set', trackId: 9, patch: { pan: 1 } })).toBe(start)
  })

  it('resets the effects and leaves level, loop, mute and solo alone', () => {
    const start = [
      layer(1, {
        volume: 0.7,
        loop: true,
        muted: true,
        pan: 0.4,
        speed: 1.5,
        reverb: 0.5,
        eqHigh: 6,
        fadeIn: 3,
        startAt: 4,
        playing: true
      })
    ]
    const result = mixReducer(start, { type: 'reset-effects', trackId: 1 })[0]
    expect(result).toMatchObject({
      volume: 0.7,
      loop: true,
      muted: true,
      playing: true,
      pan: 0,
      speed: 1,
      reverb: 0,
      eqHigh: 0,
      fadeIn: 0,
      startAt: 0
    })
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

  it('plays every layer that makes sound and leaves silent ones paused', () => {
    const start = [layer(1, { volume: 0.4 }), layer(2), layer(3, { volume: 0.2, playing: true })]
    const result = mixReducer(start, { type: 'play-all' })
    expect(result.map((item) => item.playing)).toEqual([true, false, true])
  })

  it('pauses everything', () => {
    const start = [layer(1, { playing: true }), layer(2)]
    expect(mixReducer(start, { type: 'pause-all' }).every((item) => !item.playing)).toBe(true)
  })

  it('turns every solo off', () => {
    const start = [layer(1, { solo: true }), layer(2), layer(3, { solo: true })]
    expect(mixReducer(start, { type: 'unsolo-all' }).some((item) => item.solo)).toBe(false)
    const none = [layer(1)]
    expect(mixReducer(none, { type: 'unsolo-all' })).toBe(none)
  })

  it('removes silent layers but keeps audible and playing ones', () => {
    const start = [layer(1), layer(2, { volume: 0.5 }), layer(3, { playing: true })]
    const result = mixReducer(start, { type: 'remove-silent' })
    expect(result.map((item) => item.trackId)).toEqual([2, 3])
  })

  it('clears the mix', () => {
    expect(mixReducer([layer(1), layer(2)], { type: 'clear' })).toEqual([])
  })

  describe('load', () => {
    it('adds the components of a mixtape with their settings, paused, in order', () => {
      const start = [layer(9)]
      const result = mixReducer(start, {
        type: 'load',
        layers: [saved(1, { volume: 0.6, loop: true }), saved(2, { pan: -1 })]
      })
      expect(result.map((item) => item.trackId)).toEqual([1, 2, 9])
      expect(result[0]).toMatchObject({ volume: 0.6, loop: true, playing: false })
      expect(result[1].pan).toBe(-1)
      expect(result[2]).toBe(start[0])
    })

    it('gives a track that is already in the mix the settings of the mixtape, paused', () => {
      const start = [layer(1, { volume: 0.2, playing: true, reverb: 0.9 }), layer(2)]
      const result = mixReducer(start, { type: 'load', layers: [saved(1, { volume: 0.8 })] })
      expect(result.map((item) => item.trackId)).toEqual([1, 2])
      expect(result[0]).toMatchObject({ volume: 0.8, reverb: 0, playing: false })
    })

    it('does nothing for an empty mixtape', () => {
      const start = [layer(1)]
      expect(mixReducer(start, { type: 'load', layers: [] })).toBe(start)
    })

    it('fixes settings that are out of range', () => {
      const result = mixReducer([], { type: 'load', layers: [saved(1, { volume: 7, speed: 99 })] })
      expect(result[0].volume).toBe(1)
      expect(result[0].speed).toBe(2)
    })
  })

  describe('limit', () => {
    it('drops the oldest idle layer once there are too many', () => {
      let layers: MixLayer[] = []
      for (let id = 1; id <= MAX_LAYERS; id += 1) {
        layers = mixReducer(layers, { type: 'add', trackId: id })
      }
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
      expect(mixReducer(layers, { type: 'add', trackId: 999 })).toBe(layers)
    })

    it('keeps the components of a loaded mixtape when the mix is full', () => {
      let layers: MixLayer[] = []
      for (let id = 1; id <= MAX_LAYERS; id += 1) {
        layers = mixReducer(layers, { type: 'add', trackId: id })
      }
      const result = mixReducer(layers, {
        type: 'load',
        layers: [saved(500), saved(501), saved(502)]
      })
      expect(result).toHaveLength(MAX_LAYERS)
      expect(result.slice(0, 3).map((item) => item.trackId)).toEqual([500, 501, 502])
    })
  })
})

describe('clampVolume', () => {
  it('keeps the volume between 0 and 1', () => {
    expect(clampVolume(0.25)).toBe(0.25)
    expect(clampVolume(2)).toBe(1)
    expect(clampVolume(-1)).toBe(0)
    expect(clampVolume(NaN)).toBe(0)
  })
})

describe('audibility', () => {
  it('hears a layer unless it is muted', () => {
    expect(isAudible(settings(), false)).toBe(true)
    expect(isAudible(settings({ muted: true }), false)).toBe(false)
  })

  it('hears only the solo layers once one is solo, even if a solo layer is muted', () => {
    expect(isAudible(settings(), true)).toBe(false)
    expect(isAudible(settings({ solo: true }), true)).toBe(true)
    expect(isAudible(settings({ solo: true, muted: true }), true)).toBe(false)
  })

  it('multiplies the volume by the loudness correction, and is silent when not heard', () => {
    expect(layerGain(settings({ volume: 0.5 }), false, 2)).toBe(1)
    expect(layerGain(settings({ volume: 0.5, muted: true }), false, 2)).toBe(0)
    expect(layerGain(settings({ volume: 0.5 }), true, 2)).toBe(0)
    expect(layerGain(settings({ volume: 5 }), false, 1)).toBe(1)
  })
})

describe('looping', () => {
  it('lets the browser loop a plain loop', () => {
    expect(usesNativeLoop(settings({ loop: true }))).toBe(true)
    expect(usesNativeLoop(settings({ loop: true, fadeIn: 2 }))).toBe(true)
  })

  it('handles the loop itself when a part, a gap, a fade out or a random start is used', () => {
    expect(usesNativeLoop(settings())).toBe(false)
    expect(usesNativeLoop(settings({ loop: true, startAt: 1 }))).toBe(false)
    expect(usesNativeLoop(settings({ loop: true, endAt: 5 }))).toBe(false)
    expect(usesNativeLoop(settings({ loop: true, gapMax: 3 }))).toBe(false)
    expect(usesNativeLoop(settings({ loop: true, fadeOut: 1 }))).toBe(false)
    expect(usesNativeLoop(settings({ loop: true, randomStart: true }))).toBe(false)
  })

  it('picks a gap between the two values, or none', () => {
    expect(loopGap(settings({ gapMin: 2, gapMax: 6 }), 0)).toBe(2)
    expect(loopGap(settings({ gapMin: 2, gapMax: 6 }), 0.5)).toBe(4)
    expect(loopGap(settings({ gapMin: 2, gapMax: 6 }), 1)).toBe(6)
    expect(loopGap(settings(), 0.7)).toBe(0)
  })
})

describe('playWindow', () => {
  it('plays the whole track by default', () => {
    expect(playWindow(settings(), 120)).toEqual({ start: 0, end: 120 })
  })

  it('plays the part that was asked for, inside the track', () => {
    expect(playWindow(settings({ startAt: 10, endAt: 30 }), 120)).toEqual({ start: 10, end: 30 })
    expect(playWindow(settings({ endAt: 500 }), 120).end).toBe(120)
    const late = playWindow(settings({ startAt: 500 }), 120)
    expect(late.end).toBe(120)
    expect(late.start).toBeLessThan(120)
  })

  it('copes with a track whose length is not known', () => {
    expect(playWindow(settings({ startAt: 2 }), NaN)).toEqual({ start: 2, end: 0 })
  })

  it('starts at the beginning of the part, or inside it with a random start', () => {
    const window = { start: 10, end: 30 }
    expect(startPosition(settings(), window, 0.9)).toBe(10)
    expect(startPosition(settings({ randomStart: true }), window, 0)).toBe(10)
    expect(startPosition(settings({ randomStart: true }), window, 1)).toBe(29.5)
    expect(startPosition(settings({ randomStart: true }), { start: 0, end: 0.3 }, 1)).toBe(0)
  })
})

describe('fadePlan', () => {
  const window = { start: 0, end: 100 }

  it('has no fade by default', () => {
    expect(fadePlan(settings(), window, 0)).toEqual({ fadeIn: 0, fadeOutAfter: 0, fadeOut: 0 })
  })

  it('fades out so that it ends with the part', () => {
    expect(fadePlan(settings({ fadeIn: 2, fadeOut: 5 }), window, 0)).toEqual({
      fadeIn: 2,
      fadeOutAfter: 95,
      fadeOut: 5
    })
  })

  it('counts real time when the speed changes', () => {
    const plan = fadePlan(settings({ fadeOut: 5, speed: 2 }), window, 0)
    expect(plan.fadeOutAfter).toBe(45)
  })

  it('shortens the fades when little is left', () => {
    const plan = fadePlan(settings({ fadeIn: 4, fadeOut: 6 }), window, 98)
    expect(plan).toEqual({ fadeIn: 2, fadeOutAfter: 0, fadeOut: 2 })
  })

  it('does not schedule a fade out when the end of the track is unknown', () => {
    const plan = fadePlan(settings({ fadeIn: 3, fadeOut: 3 }), { start: 0, end: 0 }, 0)
    expect(plan).toEqual({ fadeIn: 3, fadeOutAfter: 0, fadeOut: 0 })
  })
})

describe('toMixtapeLayer', () => {
  it('keeps every setting of the layer but not whether it is playing', () => {
    const saved = toMixtapeLayer(
      layer(7, { volume: 0.4, loop: true, pan: -0.5, reverb: 0.3, playing: true })
    )
    expect(saved).not.toHaveProperty('playing')
    expect(saved).toMatchObject({ trackId: 7, volume: 0.4, loop: true, pan: -0.5, reverb: 0.3 })
  })
})
