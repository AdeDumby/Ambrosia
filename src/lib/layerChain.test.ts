import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYER_SETTINGS, type LayerSettings } from '../shared/mixtape'
import { affectsLoudness, chainParams, loudnessKey } from './layerChain'

const layer = (patch: Partial<LayerSettings> = {}): LayerSettings => ({
  ...DEFAULT_LAYER_SETTINGS,
  ...patch
})

describe('affectsLoudness', () => {
  it('is false for plain layers and for settings that only move or fade the sound', () => {
    expect(affectsLoudness(layer())).toBe(false)
    expect(
      affectsLoudness(
        layer({ volume: 0.3, pan: 0.5, speed: 1.5, fadeIn: 5, loop: true, gapMax: 9 })
      )
    ).toBe(false)
  })

  it('is true for every setting that changes how loud the layer is', () => {
    for (const patch of [
      { eqLow: 3 },
      { eqMid: -3 },
      { eqHigh: 6 },
      { lowCut: 200 },
      { highCut: 5000 },
      { mono: true },
      { reverb: 0.2 },
      { echoMix: 0.3 },
      { tremoloDepth: 0.4 }
    ]) {
      expect(affectsLoudness(layer(patch))).toBe(true)
    }
  })
})

describe('loudnessKey', () => {
  it('stays the same when a setting that does not change the loudness changes', () => {
    const base = layer({ reverb: 0.4 })
    expect(loudnessKey({ ...base, volume: 0.1, pan: -1, fadeOut: 4 })).toBe(loudnessKey(base))
  })

  it('changes with the effects and with the part that is measured', () => {
    const base = layer({ reverb: 0.4 })
    expect(loudnessKey({ ...base, reverb: 0.5 })).not.toBe(loudnessKey(base))
    expect(loudnessKey({ ...base, startAt: 10 })).not.toBe(loudnessKey(base))
  })

  it('ignores the echo and wobble details while they are off', () => {
    const base = layer({ reverb: 0.4 })
    expect(loudnessKey({ ...base, echoTime: 1.5, tremoloRate: 9 })).toBe(loudnessKey(base))
    const on = layer({ echoMix: 0.3 })
    expect(loudnessKey({ ...on, echoTime: 1.5 })).not.toBe(loudnessKey(on))
  })
})

describe('chainParams', () => {
  it('turns the settings into the numbers of the sound', () => {
    const params = chainParams(layer({ reverb: 0.5, lowCut: 0, echoTime: 5 }))
    expect(params.dry).toBeCloseTo(0.75)
    expect(params.wet).toBe(0.5)
    expect(params.lowCut).toBe(10)
    expect(params.echoTime).toBe(2)
  })
})
