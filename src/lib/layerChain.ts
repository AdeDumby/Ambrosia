import type { LayerSettings } from '../shared/mixtape'

export const EQ_LOW_HZ = 200
export const EQ_MID_HZ = 1000
export const EQ_HIGH_HZ = 4000
export const REVERB_SECONDS = 2.5
export const MAX_ECHO_SECONDS = 2
export const LOW_CUT_OFF_HZ = 10

export function makeImpulse(context: BaseAudioContext): AudioBuffer {
  const length = Math.round(context.sampleRate * REVERB_SECONDS)
  const buffer = context.createBuffer(2, length, context.sampleRate)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 3
    }
  }
  return buffer
}

export type ChainParams = {
  lowCut: number
  highCut: number
  mono: boolean
  eqLow: number
  eqMid: number
  eqHigh: number
  dry: number
  wet: number
  echoTime: number
  echoFeedback: number
  echoMix: number
  tremoloRate: number
  tremoloDepth: number
}

export function chainParams(layer: LayerSettings): ChainParams {
  return {
    lowCut: Math.max(LOW_CUT_OFF_HZ, layer.lowCut),
    highCut: layer.highCut,
    mono: layer.mono,
    eqLow: layer.eqLow,
    eqMid: layer.eqMid,
    eqHigh: layer.eqHigh,
    dry: 1 - layer.reverb * 0.5,
    wet: layer.reverb,
    echoTime: Math.min(MAX_ECHO_SECONDS, layer.echoTime),
    echoFeedback: layer.echoFeedback,
    echoMix: layer.echoMix,
    tremoloRate: layer.tremoloRate,
    tremoloDepth: layer.tremoloDepth
  }
}

export function affectsLoudness(layer: LayerSettings): boolean {
  return (
    layer.eqLow !== 0 ||
    layer.eqMid !== 0 ||
    layer.eqHigh !== 0 ||
    layer.lowCut > 0 ||
    layer.highCut < 20000 ||
    layer.mono ||
    layer.reverb > 0 ||
    layer.echoMix > 0 ||
    layer.tremoloDepth > 0
  )
}

export function loudnessKey(layer: LayerSettings): string {
  const echo = layer.echoMix > 0
  const wobble = layer.tremoloDepth > 0
  return [
    layer.eqLow,
    layer.eqMid,
    layer.eqHigh,
    layer.lowCut,
    layer.highCut,
    layer.mono ? 1 : 0,
    layer.reverb,
    layer.echoMix,
    echo ? layer.echoTime : 0,
    echo ? layer.echoFeedback : 0,
    layer.tremoloDepth,
    wobble ? layer.tremoloRate : 0,
    layer.startAt,
    layer.endAt
  ].join('|')
}
