import { gainForTarget } from '../shared/loudness'
import type { LayerSettings } from '../shared/mixtape'
import { measureInWorker } from './analyseTrack'
import {
  EQ_HIGH_HZ,
  EQ_LOW_HZ,
  EQ_MID_HZ,
  MAX_ECHO_SECONDS,
  chainParams,
  makeImpulse
} from './layerChain'
import { playWindow } from './mix'

/** Only this much of the part is played through the effects to measure it. */
const SEGMENT_SECONDS = 30
/** Room for the end of the reverb and of the echoes. */
const TAIL_SECONDS = 4
const DECODE_SAMPLE_RATE = 44_100
/** A part shorter than this says too little about the loudness. */
const MIN_SEGMENT_SECONDS = 0.5

/** Plays a stretch of a track through the same effects as the live mix, into a buffer. */
async function renderThroughEffects(
  decoded: AudioBuffer,
  segment: { start: number; length: number },
  layer: LayerSettings
): Promise<AudioBuffer> {
  const rate = decoded.sampleRate
  const tail = Math.round(TAIL_SECONDS * rate)
  const context = new OfflineAudioContext(2, segment.length + tail, rate)
  const params = chainParams(layer)

  const buffer = context.createBuffer(decoded.numberOfChannels, segment.length, rate)
  for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
    const samples = new Float32Array(segment.length)
    decoded.copyFromChannel(samples, channel, segment.start)
    buffer.copyToChannel(samples, channel)
  }
  const source = context.createBufferSource()
  source.buffer = buffer

  const cutLow = context.createBiquadFilter()
  cutLow.type = 'highpass'
  cutLow.frequency.value = params.lowCut
  const cutHigh = context.createBiquadFilter()
  cutHigh.type = 'lowpass'
  cutHigh.frequency.value = Math.min(params.highCut, rate / 2)
  const low = context.createBiquadFilter()
  low.type = 'lowshelf'
  low.frequency.value = EQ_LOW_HZ
  low.gain.value = params.eqLow
  const mid = context.createBiquadFilter()
  mid.type = 'peaking'
  mid.frequency.value = EQ_MID_HZ
  mid.Q.value = 0.8
  mid.gain.value = params.eqMid
  const high = context.createBiquadFilter()
  high.type = 'highshelf'
  high.frequency.value = EQ_HIGH_HZ
  high.gain.value = params.eqHigh
  const mono = context.createGain()
  mono.channelInterpretation = 'speakers'
  if (params.mono) {
    mono.channelCountMode = 'explicit'
    mono.channelCount = 1
  }

  const dry = context.createGain()
  dry.gain.value = params.dry
  const convolver = context.createConvolver()
  convolver.buffer = makeImpulse(context)
  const wet = context.createGain()
  wet.gain.value = params.wet
  const delay = context.createDelay(MAX_ECHO_SECONDS)
  delay.delayTime.value = params.echoTime
  const feedback = context.createGain()
  feedback.gain.value = params.echoFeedback
  const echoWet = context.createGain()
  echoWet.gain.value = params.echoMix
  const sum = context.createGain()
  const tremolo = context.createGain()
  tremolo.gain.value = 1 - params.tremoloDepth / 2
  const lfo = context.createOscillator()
  lfo.frequency.value = params.tremoloRate
  const lfoDepth = context.createGain()
  lfoDepth.gain.value = params.tremoloDepth / 2

  source.connect(cutLow)
  cutLow.connect(cutHigh)
  cutHigh.connect(low)
  low.connect(mid)
  mid.connect(high)
  high.connect(mono)
  mono.connect(dry)
  // The live mix has a pan here. A pan keeps the total loudness, so it is left out.
  if (params.wet > 0) {
    mono.connect(convolver)
    convolver.connect(wet)
    wet.connect(sum)
  }
  if (params.echoMix > 0) {
    mono.connect(delay)
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(echoWet)
    echoWet.connect(sum)
  }
  dry.connect(sum)
  sum.connect(tremolo)
  lfo.connect(lfoDepth)
  lfoDepth.connect(tremolo.gain)
  tremolo.connect(context.destination)

  lfo.start()
  source.start()
  return context.startRendering()
}

/**
 * The gain that brings the layer, with its effects, to the target loudness. It plays the start
 * of the part through the effects, measures that, and applies the same rule as the main player
 * (including the ceiling that keeps a boost from distorting). Null when the part is too short
 * or the track cannot be read, so the caller keeps the correction of the plain track.
 */
export async function loudnessCorrection(
  trackId: number,
  layer: LayerSettings,
  targetLufs: number
): Promise<number | null> {
  const response = await fetch(`ambrosia-audio://track/${trackId}`)
  if (!response.ok) return null
  const encoded = await response.arrayBuffer()
  let decoded: AudioBuffer
  try {
    decoded = await new OfflineAudioContext(1, 1, DECODE_SAMPLE_RATE).decodeAudioData(encoded)
  } catch {
    return null
  }

  const part = playWindow(layer, decoded.duration)
  const first = Math.floor(part.start * decoded.sampleRate)
  const last = part.end > 0 ? Math.floor(part.end * decoded.sampleRate) : decoded.length
  const length = Math.min(last - first, Math.round(SEGMENT_SECONDS * decoded.sampleRate))
  if (length < MIN_SEGMENT_SECONDS * decoded.sampleRate) return null

  const rendered = await renderThroughEffects(decoded, { start: first, length }, layer)
  const channels = [0, 1].map((index) => {
    const samples = new Float32Array(rendered.length)
    rendered.copyFromChannel(samples, index)
    return samples
  })
  const { result } = await measureInWorker(channels, rendered.sampleRate)
  if (!Number.isFinite(result.integrated)) return null
  return gainForTarget(result.integrated, result.peak, targetLufs)
}
