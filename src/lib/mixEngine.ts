import {
  fadePlan,
  layerGain,
  loopGap,
  playWindow,
  startPosition,
  usesNativeLoop,
  variationFor,
  type MixLayer,
  type Variation
} from './mix'

/** What the engine needs to know about a track, from the library. */
export type EngineTrack = {
  durationSec: number
  /** Loudness correction (1 when Normalize volume is off or the track is not measured). */
  correction: number
}

type Nodes = {
  /** Cuts the lows. */
  cutLow: BiquadFilterNode
  /** Cuts the highs. */
  cutHigh: BiquadFilterNode
  /** Joins both channels into one when the layer is mono. */
  mono: GainNode
  delay: DelayNode
  feedback: GainNode
  echoWet: GainNode
  /** Volume wobble. Its value moves with the LFO. */
  tremolo: GainNode
  lfo: OscillatorNode
  lfoDepth: GainNode
  low: BiquadFilterNode
  mid: BiquadFilterNode
  high: BiquadFilterNode
  pan: StereoPannerNode
  dry: GainNode
  convolver: ConvolverNode
  wet: GainNode
  /** Fade in and fade out, 0 to 1. */
  fade: GainNode
  /** Volume, mute and solo. */
  level: GainNode
}

type VoiceState = 'idle' | 'playing' | 'paused' | 'gap'

type Voice = {
  trackId: number
  audio: HTMLAudioElement
  nodes: Nodes | null
  state: VoiceState
  gapTimer: number | undefined
  /** The random change picked when the layer last started. */
  variation: Variation
}

type Graph = {
  context: AudioContext
  master: GainNode
  /** Only for fading everything out. */
  out: GainNode
  limiter: DynamicsCompressorNode
  impulse: AudioBuffer
}

const NO_VARIATION: Variation = { volume: 1, pan: 0, speed: 1 }
const MAX_ECHO_SECONDS = 2
const OUT_RESTORE_MS = 300
/** A cut this low does nothing, so "off" is a filter nobody can hear. */
const LOW_CUT_OFF_HZ = 10

const SMOOTHING = 0.015
const TICK_MS = 100
/** A part that ends this close to the position is over. */
const END_MARGIN = 0.03
const RESUME_FADE_IN = 0.05
const REVERB_SECONDS = 2.5
const EQ_LOW_HZ = 200
const EQ_MID_HZ = 1000
const EQ_HIGH_HZ = 4000

function makeImpulse(context: AudioContext): AudioBuffer {
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

/**
 * Plays the layers of the mix. Each layer that has been played has its own audio element and its
 * own chain: tone, pan, reverb, fades and level, all into one master volume.
 * It does not know about React: `sync` tells it what the layers should be doing now.
 */
export class MixEngine {
  private graph: Graph | null = null
  private readonly voices = new Map<number, Voice>()
  private layers = new Map<number, MixLayer>()
  private tracks = new Map<number, EngineTrack>()
  private anySolo = false
  private master = 1
  private ticker: number | undefined
  private limiter = false
  private fadeTimer: number | undefined
  private restoreTimer: number | undefined

  private readonly onStopped: (trackId: number) => void

  constructor(onStopped: (trackId: number) => void) {
    this.onStopped = onStopped
  }

  sync(layers: MixLayer[], master: number, tracks: Map<number, EngineTrack>): void {
    this.layers = new Map(layers.map((layer) => [layer.trackId, layer]))
    this.tracks = tracks
    this.anySolo = layers.some((layer) => layer.solo)
    this.master = master

    for (const voice of [...this.voices.values()]) {
      if (!this.layers.has(voice.trackId)) this.destroy(voice)
    }

    if (this.graph) {
      this.graph.master.gain.setTargetAtTime(master, this.graph.context.currentTime, SMOOTHING)
    }

    for (const layer of layers) {
      let voice = this.voices.get(layer.trackId)
      // Nothing is created for a layer that was never played.
      if (!voice && !layer.playing) continue
      if (!voice) voice = this.create(layer.trackId)

      this.apply(voice, layer)
      if (layer.playing) this.start(voice, layer)
      else this.pause(voice)
    }
    this.updateTicker()
  }

  /** Keeps a loud mix from clipping, by pressing down only the peaks. */
  setLimiter(on: boolean): void {
    this.limiter = on
    this.route()
  }

  /** Brings everything down over `seconds`, then calls `done` (which should pause the layers). */
  fadeOut(seconds: number, done: () => void): void {
    this.cancelFade()
    const graph = this.graph
    if (graph) {
      const now = graph.context.currentTime
      graph.out.gain.cancelScheduledValues(now)
      graph.out.gain.setValueAtTime(graph.out.gain.value, now)
      graph.out.gain.linearRampToValueAtTime(0, now + seconds)
    }
    this.fadeTimer = window.setTimeout(() => {
      this.fadeTimer = undefined
      done()
      // The layers pause on the next sync, so the level comes back a moment later.
      this.restoreTimer = window.setTimeout(() => this.restoreOut(), OUT_RESTORE_MS)
    }, seconds * 1000)
  }

  /** Stops a fade that is going on and brings the level back. */
  cancelFade(): void {
    window.clearTimeout(this.fadeTimer)
    window.clearTimeout(this.restoreTimer)
    this.fadeTimer = undefined
    this.restoreTimer = undefined
    this.restoreOut()
  }

  private restoreOut(): void {
    const graph = this.graph
    if (!graph) return
    const now = graph.context.currentTime
    graph.out.gain.cancelScheduledValues(now)
    graph.out.gain.setTargetAtTime(1, now, SMOOTHING)
  }

  private route(): void {
    const graph = this.graph
    if (!graph) return
    graph.out.disconnect()
    graph.limiter.disconnect()
    if (this.limiter) {
      graph.out.connect(graph.limiter)
      graph.limiter.connect(graph.context.destination)
    } else {
      graph.out.connect(graph.context.destination)
    }
  }

  dispose(): void {
    window.clearTimeout(this.fadeTimer)
    window.clearTimeout(this.restoreTimer)
    for (const voice of [...this.voices.values()]) this.destroy(voice)
    window.clearInterval(this.ticker)
    this.ticker = undefined
    void this.graph?.context.close().catch(() => {})
    this.graph = null
  }

  private ensureGraph(): Graph | null {
    if (this.graph) return this.graph
    try {
      const context = new AudioContext()
      const master = context.createGain()
      master.gain.value = this.master
      const out = context.createGain()
      const limiter = context.createDynamicsCompressor()
      limiter.threshold.value = -3
      limiter.knee.value = 0
      limiter.ratio.value = 20
      limiter.attack.value = 0.003
      limiter.release.value = 0.15
      master.connect(out)
      this.graph = { context, master, out, limiter, impulse: makeImpulse(context) }
      this.route()
    } catch {
      return null
    }
    return this.graph
  }

  private create(trackId: number): Voice {
    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    audio.preload = 'auto'
    audio.src = `ambrosia-audio://track/${trackId}`

    const voice: Voice = {
      trackId,
      audio,
      nodes: this.buildNodes(audio),
      state: 'idle',
      gapTimer: undefined,
      variation: NO_VARIATION
    }
    // A removed element still fires events (emptying its source raises an error). They must not
    // stop a newer layer of the same track, so only the voice that is current is listened to.
    const current = () => this.voices.get(trackId) === voice
    audio.addEventListener('ended', () => {
      const layer = this.layers.get(trackId)
      if (current() && voice.state === 'playing' && layer) this.finish(voice, layer)
    })
    audio.addEventListener('error', () => {
      if (current()) this.fail(voice)
    })
    this.voices.set(trackId, voice)
    return voice
  }

  private buildNodes(audio: HTMLAudioElement): Nodes | null {
    const graph = this.ensureGraph()
    if (!graph) return null
    const { context } = graph
    try {
      const source = context.createMediaElementSource(audio)
      const cutLow = context.createBiquadFilter()
      cutLow.type = 'highpass'
      cutLow.frequency.value = LOW_CUT_OFF_HZ
      const cutHigh = context.createBiquadFilter()
      cutHigh.type = 'lowpass'
      cutHigh.frequency.value = Math.min(20000, context.sampleRate / 2)
      const mono = context.createGain()
      mono.channelInterpretation = 'speakers'
      const delay = context.createDelay(MAX_ECHO_SECONDS)
      const feedback = context.createGain()
      feedback.gain.value = 0
      const echoWet = context.createGain()
      echoWet.gain.value = 0
      const tremolo = context.createGain()
      const lfo = context.createOscillator()
      lfo.type = 'sine'
      const lfoDepth = context.createGain()
      lfoDepth.gain.value = 0
      const low = context.createBiquadFilter()
      low.type = 'lowshelf'
      low.frequency.value = EQ_LOW_HZ
      const mid = context.createBiquadFilter()
      mid.type = 'peaking'
      mid.frequency.value = EQ_MID_HZ
      mid.Q.value = 0.8
      const high = context.createBiquadFilter()
      high.type = 'highshelf'
      high.frequency.value = EQ_HIGH_HZ
      const pan = context.createStereoPanner()
      const dry = context.createGain()
      const convolver = context.createConvolver()
      convolver.buffer = graph.impulse
      const wet = context.createGain()
      wet.gain.value = 0
      const fade = context.createGain()
      const level = context.createGain()
      level.gain.value = 0

      source.connect(cutLow)
      cutLow.connect(cutHigh)
      cutHigh.connect(low)
      low.connect(mid)
      mid.connect(high)
      high.connect(mono)
      mono.connect(pan)
      pan.connect(dry)
      pan.connect(convolver)
      pan.connect(delay)
      delay.connect(feedback)
      feedback.connect(delay)
      delay.connect(echoWet)
      convolver.connect(wet)
      dry.connect(fade)
      wet.connect(fade)
      echoWet.connect(fade)
      fade.connect(tremolo)
      lfo.connect(lfoDepth)
      lfoDepth.connect(tremolo.gain)
      lfo.start()
      tremolo.connect(level)
      level.connect(graph.master)
      return {
        cutLow,
        cutHigh,
        mono,
        delay,
        feedback,
        echoWet,
        tremolo,
        lfo,
        lfoDepth,
        low,
        mid,
        high,
        pan,
        dry,
        convolver,
        wet,
        fade,
        level
      }
    } catch {
      return null
    }
  }

  private destroy(voice: Voice): void {
    window.clearTimeout(voice.gapTimer)
    voice.audio.pause()
    voice.audio.removeAttribute('src')
    voice.audio.load()
    if (voice.nodes) {
      try {
        voice.nodes.lfo.stop()
      } catch {
        // Already stopped.
      }
      for (const node of Object.values(voice.nodes)) node.disconnect()
    }
    this.voices.delete(voice.trackId)
  }

  private apply(voice: Voice, layer: MixLayer): void {
    const { audio, nodes } = voice
    const track = this.tracks.get(layer.trackId)
    const { variation } = voice
    const level = layerGain(layer, this.anySolo, track?.correction ?? 1) * variation.volume

    const native = usesNativeLoop(layer)
    if (audio.loop !== native) audio.loop = native
    const rate = layer.speed * variation.speed
    if (audio.playbackRate !== rate) audio.playbackRate = rate
    if (audio.preservesPitch !== layer.keepPitch) audio.preservesPitch = layer.keepPitch

    if (!nodes || !this.graph) {
      // No audio graph: the volume still works, the tone and space settings do not.
      audio.volume = Math.min(1, level * this.master)
      return
    }
    const now = this.graph.context.currentTime
    nodes.level.gain.setTargetAtTime(level, now, SMOOTHING)
    nodes.pan.pan.setTargetAtTime(
      Math.min(1, Math.max(-1, layer.pan + variation.pan)),
      now,
      SMOOTHING
    )
    nodes.cutLow.frequency.setTargetAtTime(Math.max(LOW_CUT_OFF_HZ, layer.lowCut), now, SMOOTHING)
    nodes.cutHigh.frequency.setTargetAtTime(
      Math.min(layer.highCut, this.graph.context.sampleRate / 2),
      now,
      SMOOTHING
    )
    // One channel in, and the panner spreads it again, so mono ignores the original stereo width.
    const channels = layer.mono ? 1 : 2
    if (nodes.mono.channelCount !== channels) {
      nodes.mono.channelCountMode = layer.mono ? 'explicit' : 'max'
      nodes.mono.channelCount = channels
    }
    nodes.delay.delayTime.setTargetAtTime(
      Math.min(MAX_ECHO_SECONDS, layer.echoTime),
      now,
      SMOOTHING
    )
    nodes.feedback.gain.setTargetAtTime(layer.echoFeedback, now, SMOOTHING)
    nodes.echoWet.gain.setTargetAtTime(layer.echoMix, now, SMOOTHING)
    nodes.lfo.frequency.setTargetAtTime(layer.tremoloRate, now, SMOOTHING)
    nodes.lfoDepth.gain.setTargetAtTime(layer.tremoloDepth / 2, now, SMOOTHING)
    nodes.tremolo.gain.setTargetAtTime(1 - layer.tremoloDepth / 2, now, SMOOTHING)
    nodes.low.gain.setTargetAtTime(layer.eqLow, now, SMOOTHING)
    nodes.mid.gain.setTargetAtTime(layer.eqMid, now, SMOOTHING)
    nodes.high.gain.setTargetAtTime(layer.eqHigh, now, SMOOTHING)
    nodes.wet.gain.setTargetAtTime(layer.reverb, now, SMOOTHING)
    nodes.dry.gain.setTargetAtTime(1 - layer.reverb * 0.5, now, SMOOTHING)
  }

  private start(voice: Voice, layer: MixLayer): void {
    if (voice.state === 'playing' || voice.state === 'gap') return
    if (voice.state === 'paused') {
      this.resume(voice, layer)
      return
    }
    if (layer.startDelay > 0) {
      voice.state = 'gap'
      voice.gapTimer = window.setTimeout(() => this.beginAfterWait(voice), layer.startDelay * 1000)
      return
    }
    this.begin(voice, layer)
  }

  private beginAfterWait(voice: Voice): void {
    const current = this.layers.get(voice.trackId)
    if (voice.state === 'gap' && current?.playing) this.begin(voice, current)
  }

  private pause(voice: Voice): void {
    if (voice.state === 'gap') {
      window.clearTimeout(voice.gapTimer)
      voice.state = 'idle'
      return
    }
    if (voice.state !== 'playing') return
    voice.audio.pause()
    voice.state = 'paused'
    // The fades are planned in real time, so the plan is dropped and made again on resume.
    this.holdFade(voice)
  }

  private holdFade(voice: Voice): void {
    if (!voice.nodes || !this.graph) return
    const gain = voice.nodes.fade.gain
    gain.cancelScheduledValues(this.graph.context.currentTime)
    gain.setValueAtTime(1, this.graph.context.currentTime)
  }

  /** Plays from the beginning of the part, or from a random place inside it. */
  private begin(voice: Voice, layer: MixLayer): void {
    const track = this.tracks.get(layer.trackId)
    const window = playWindow(layer, track?.durationSec ?? 0)
    const position = startPosition(layer, window, Math.random())
    voice.variation = variationFor(layer, {
      volume: Math.random(),
      pan: Math.random(),
      speed: Math.random()
    })
    this.apply(voice, layer)
    voice.audio.currentTime = position
    this.planFade(voice, fadePlan(layer, window, position))
    this.play(voice)
  }

  private resume(voice: Voice, layer: MixLayer): void {
    const track = this.tracks.get(layer.trackId)
    const window = playWindow(layer, track?.durationSec ?? 0)
    const soft = { ...layer, fadeIn: Math.min(layer.fadeIn, RESUME_FADE_IN) }
    this.planFade(voice, fadePlan(soft, window, voice.audio.currentTime))
    this.play(voice)
  }

  private play(voice: Voice): void {
    voice.state = 'playing'
    void this.graph?.context.resume()
    voice.audio.play().catch(() => this.fail(voice))
  }

  private planFade(voice: Voice, plan: ReturnType<typeof fadePlan>): void {
    if (!voice.nodes || !this.graph) return
    const gain = voice.nodes.fade.gain
    const now = this.graph.context.currentTime
    gain.cancelScheduledValues(now)
    if (plan.fadeIn > 0) {
      gain.setValueAtTime(0, now)
      gain.linearRampToValueAtTime(1, now + plan.fadeIn)
    } else {
      gain.setValueAtTime(1, now)
    }
    if (plan.fadeOut > 0) {
      const from = now + plan.fadeOutAfter
      if (from > now + plan.fadeIn) gain.setValueAtTime(1, from)
      gain.linearRampToValueAtTime(0, from + plan.fadeOut)
    }
  }

  /** The end of the track or of the part was reached: loop again, wait, or stop. */
  private finish(voice: Voice, layer: MixLayer): void {
    if (!layer.loop) {
      voice.state = 'idle'
      voice.audio.pause()
      this.onStopped(voice.trackId)
      return
    }
    const gap = loopGap(layer, Math.random())
    if (gap > 0) {
      voice.audio.pause()
      voice.state = 'gap'
      voice.gapTimer = window.setTimeout(() => this.beginAfterWait(voice), gap * 1000)
      return
    }
    this.begin(voice, layer)
  }

  private fail(voice: Voice): void {
    window.clearTimeout(voice.gapTimer)
    voice.state = 'idle'
    this.onStopped(voice.trackId)
  }

  /** A part that ends before the end of the track needs watching: the browser does not know. */
  private tick = (): void => {
    for (const voice of this.voices.values()) {
      if (voice.state !== 'playing') continue
      const layer = this.layers.get(voice.trackId)
      if (!layer || layer.endAt <= 0) continue
      const track = this.tracks.get(layer.trackId)
      const end = playWindow(layer, track?.durationSec ?? 0).end
      if (end > 0 && voice.audio.currentTime >= end - END_MARGIN) this.finish(voice, layer)
    }
  }

  private updateTicker(): void {
    const needed = [...this.voices.values()].some((voice) => voice.state === 'playing')
    if (needed && this.ticker === undefined) {
      this.ticker = window.setInterval(this.tick, TICK_MS)
    } else if (!needed && this.ticker !== undefined) {
      window.clearInterval(this.ticker)
      this.ticker = undefined
    }
  }
}
