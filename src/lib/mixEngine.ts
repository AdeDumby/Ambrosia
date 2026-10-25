import {
  fadePlan,
  layerGain,
  loopGap,
  playWindow,
  startPosition,
  usesNativeLoop,
  type MixLayer
} from './mix'

/** What the engine needs to know about a track, from the library. */
export type EngineTrack = {
  durationSec: number
  /** Loudness correction (1 when Normalize volume is off or the track is not measured). */
  correction: number
}

type Nodes = {
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
}

type Graph = { context: AudioContext; master: GainNode; impulse: AudioBuffer }

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

  dispose(): void {
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
      master.connect(context.destination)
      this.graph = { context, master, impulse: makeImpulse(context) }
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
      gapTimer: undefined
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

      source.connect(low)
      low.connect(mid)
      mid.connect(high)
      high.connect(pan)
      pan.connect(dry)
      pan.connect(convolver)
      convolver.connect(wet)
      dry.connect(fade)
      wet.connect(fade)
      fade.connect(level)
      level.connect(graph.master)
      return { low, mid, high, pan, dry, convolver, wet, fade, level }
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
      for (const node of Object.values(voice.nodes)) node.disconnect()
    }
    this.voices.delete(voice.trackId)
  }

  private apply(voice: Voice, layer: MixLayer): void {
    const { audio, nodes } = voice
    const track = this.tracks.get(layer.trackId)
    const level = layerGain(layer, this.anySolo, track?.correction ?? 1)

    const native = usesNativeLoop(layer)
    if (audio.loop !== native) audio.loop = native
    if (audio.playbackRate !== layer.speed) audio.playbackRate = layer.speed
    if (audio.preservesPitch !== layer.keepPitch) audio.preservesPitch = layer.keepPitch

    if (!nodes || !this.graph) {
      // No audio graph: the volume still works, the tone and space settings do not.
      audio.volume = Math.min(1, level * this.master)
      return
    }
    const now = this.graph.context.currentTime
    nodes.level.gain.setTargetAtTime(level, now, SMOOTHING)
    nodes.pan.pan.setTargetAtTime(layer.pan, now, SMOOTHING)
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
    this.begin(voice, layer)
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
      voice.gapTimer = window.setTimeout(() => {
        const current = this.layers.get(voice.trackId)
        if (voice.state === 'gap' && current?.playing) this.begin(voice, current)
      }, gap * 1000)
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
