import type { TrackTag } from './types.js'

/** Everything that can be set on one layer of the mix. Saved as it is in a mixtape. */
export type LayerSettings = {
  /** 0 to 1. A new layer starts silent. */
  volume: number
  loop: boolean
  muted: boolean
  solo: boolean
  /** -1 (left) to 1 (right). */
  pan: number
  /** Playback speed, 1 is normal. */
  speed: number
  /** Keep the pitch when the speed changes. */
  keepPitch: boolean
  /** Seconds of fade at the start and before the end. */
  fadeIn: number
  fadeOut: number
  /** Part of the track that is played, in seconds. An end of 0 means "until the end". */
  startAt: number
  endAt: number
  randomStart: boolean
  /** Pause between two loops, picked at random between the two values, in seconds. */
  gapMin: number
  gapMax: number
  /** Tone, in dB. */
  eqLow: number
  eqMid: number
  eqHigh: number
  /** 0 to 1. */
  reverb: number
  /** Cut the lows below this many Hz. 0 is off. */
  lowCut: number
  /** Cut the highs above this many Hz. The maximum is off. */
  highCut: number
  /** Echo: delay in seconds, how much of it comes back, and how loud it is (0 is off). */
  echoTime: number
  echoFeedback: number
  echoMix: number
  /** Tremolo: the volume goes up and down. Rate in Hz, depth 0 (off) to 1. */
  tremoloRate: number
  tremoloDepth: number
  /** Play in mono. */
  mono: boolean
  /**
   * Variation, 0 to 1 (speed: 0 to 0.5). Each time the layer starts or loops, its volume, pan
   * and speed are changed by a random amount up to this much.
   */
  volumeJitter: number
  panJitter: number
  speedJitter: number
  /** Seconds to wait between pressing play and the first sound. */
  startDelay: number
}

export const DEFAULT_LAYER_SETTINGS: LayerSettings = {
  volume: 0,
  loop: false,
  muted: false,
  solo: false,
  pan: 0,
  speed: 1,
  keepPitch: true,
  fadeIn: 0,
  fadeOut: 0,
  startAt: 0,
  endAt: 0,
  randomStart: false,
  gapMin: 0,
  gapMax: 0,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  reverb: 0,
  lowCut: 0,
  highCut: 20000,
  echoTime: 0.4,
  echoFeedback: 0.35,
  echoMix: 0,
  tremoloRate: 4,
  tremoloDepth: 0,
  mono: false,
  volumeJitter: 0,
  panJitter: 0,
  speedJitter: 0,
  startDelay: 0
}

export const LAYER_LIMITS = {
  volume: { min: 0, max: 1 },
  pan: { min: -1, max: 1 },
  speed: { min: 0.25, max: 2 },
  fade: { min: 0, max: 30 },
  time: { min: 0, max: 36000 },
  gap: { min: 0, max: 3600 },
  eq: { min: -12, max: 12 },
  reverb: { min: 0, max: 1 },
  lowCut: { min: 0, max: 1000 },
  highCut: { min: 200, max: 20000 },
  echoTime: { min: 0.05, max: 2 },
  echoFeedback: { min: 0, max: 0.9 },
  echoMix: { min: 0, max: 1 },
  tremoloRate: { min: 0.1, max: 20 },
  tremoloDepth: { min: 0, max: 1 },
  jitter: { min: 0, max: 1 },
  speedJitter: { min: 0, max: 0.5 },
  startDelay: { min: 0, max: 3600 }
} as const

/** The settings that "Reset effects" puts back to their defaults. Level and loop stay as they are. */
export const EFFECT_KEYS = [
  'pan',
  'speed',
  'keepPitch',
  'fadeIn',
  'fadeOut',
  'startAt',
  'endAt',
  'randomStart',
  'gapMin',
  'gapMax',
  'eqLow',
  'eqMid',
  'eqHigh',
  'reverb',
  'lowCut',
  'highCut',
  'echoTime',
  'echoFeedback',
  'echoMix',
  'tremoloRate',
  'tremoloDepth',
  'mono',
  'volumeJitter',
  'panJitter',
  'speedJitter',
  'startDelay'
] as const satisfies readonly (keyof LayerSettings)[]

export const MAX_MIXTAPE_NAME = 60
export const MAX_MIXTAPE_LAYERS = 200

export type MixtapeLayer = LayerSettings & { trackId: number }

export type Mixtape = {
  id: number
  name: string
  /** Master volume the mix had when it was saved. */
  master: number
  createdAt: string
  layers: MixtapeLayer[]
  tags: TrackTag[]
}

function number(
  raw: unknown,
  fallback: number,
  limit: { min: number; max: number },
  decimals = 2
): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback
  const clamped = Math.min(limit.max, Math.max(limit.min, raw))
  const scale = 10 ** decimals
  return Math.round(clamped * scale) / scale
}

function flag(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback
}

/** Reads settings from anything (a saved row, a message from the page) and fixes what is off. */
export function sanitizeLayerSettings(
  raw: unknown,
  base: LayerSettings = DEFAULT_LAYER_SETTINGS
): LayerSettings {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const limits = LAYER_LIMITS

  const startAt = number(source.startAt, base.startAt, limits.time)
  let endAt = number(source.endAt, base.endAt, limits.time)
  // An end that is not after the start would play nothing: treat it as "until the end".
  if (endAt > 0 && endAt <= startAt) endAt = 0

  const gapMin = number(source.gapMin, base.gapMin, limits.gap)
  const gapMax = Math.max(gapMin, number(source.gapMax, base.gapMax, limits.gap))

  return {
    volume: number(source.volume, base.volume, limits.volume),
    loop: flag(source.loop, base.loop),
    muted: flag(source.muted, base.muted),
    solo: flag(source.solo, base.solo),
    pan: number(source.pan, base.pan, limits.pan),
    speed: number(source.speed, base.speed, limits.speed),
    keepPitch: flag(source.keepPitch, base.keepPitch),
    fadeIn: number(source.fadeIn, base.fadeIn, limits.fade, 1),
    fadeOut: number(source.fadeOut, base.fadeOut, limits.fade, 1),
    startAt,
    endAt,
    randomStart: flag(source.randomStart, base.randomStart),
    gapMin,
    gapMax,
    eqLow: number(source.eqLow, base.eqLow, limits.eq, 1),
    eqMid: number(source.eqMid, base.eqMid, limits.eq, 1),
    eqHigh: number(source.eqHigh, base.eqHigh, limits.eq, 1),
    reverb: number(source.reverb, base.reverb, limits.reverb),
    lowCut: number(source.lowCut, base.lowCut, limits.lowCut, 0),
    highCut: number(source.highCut, base.highCut, limits.highCut, 0),
    echoTime: number(source.echoTime, base.echoTime, limits.echoTime),
    echoFeedback: number(source.echoFeedback, base.echoFeedback, limits.echoFeedback),
    echoMix: number(source.echoMix, base.echoMix, limits.echoMix),
    tremoloRate: number(source.tremoloRate, base.tremoloRate, limits.tremoloRate, 1),
    tremoloDepth: number(source.tremoloDepth, base.tremoloDepth, limits.tremoloDepth),
    mono: flag(source.mono, base.mono),
    volumeJitter: number(source.volumeJitter, base.volumeJitter, limits.jitter),
    panJitter: number(source.panJitter, base.panJitter, limits.jitter),
    speedJitter: number(source.speedJitter, base.speedJitter, limits.speedJitter),
    startDelay: number(source.startDelay, base.startDelay, limits.startDelay, 1)
  }
}

/**
 * The settings that "Paste effects" copies from one layer to another. The part that is played and
 * the start delay belong to a track, so they stay as they are.
 */
export const COPY_KEYS = EFFECT_KEYS.filter(
  (key) => key !== 'startAt' && key !== 'endAt' && key !== 'randomStart' && key !== 'startDelay'
)

export type LayerPreset = { name: string; description: string; settings: Partial<LayerSettings> }

/** Ready-made sounds. A preset resets the effects first, then sets what it lists. */
export const LAYER_PRESETS: LayerPreset[] = [
  {
    name: 'Cave',
    description: 'Big, dark space',
    settings: { reverb: 0.7, highCut: 6000, eqHigh: -4, eqLow: 2 }
  },
  {
    name: 'Distant',
    description: 'Far away, softened',
    settings: { highCut: 3000, reverb: 0.35, eqHigh: -6 }
  },
  {
    name: 'Underwater',
    description: 'Muffled and wobbly',
    settings: { highCut: 900, reverb: 0.3, eqLow: 3, tremoloDepth: 0.2, tremoloRate: 0.7 }
  },
  {
    name: 'Radio',
    description: 'Narrow, mono',
    settings: { lowCut: 400, highCut: 3500, eqMid: 4, mono: true }
  },
  {
    name: 'Telephone',
    description: 'Very narrow, mono',
    settings: { lowCut: 500, highCut: 3000, mono: true, eqMid: 6 }
  },
  {
    name: 'Lo-fi',
    description: 'Warm and dull',
    settings: { lowCut: 120, highCut: 5000, speed: 0.95, keepPitch: false }
  },
  {
    name: 'Echo hall',
    description: 'Repeats that fade away',
    settings: { echoMix: 0.45, echoTime: 0.55, echoFeedback: 0.5, reverb: 0.25 }
  },
  {
    name: 'Pulse',
    description: 'Volume goes up and down',
    settings: { tremoloDepth: 0.6, tremoloRate: 5 }
  },
  {
    name: 'Natural ambience',
    description: 'Never quite the same twice',
    settings: { volumeJitter: 0.35, panJitter: 0.5, speedJitter: 0.05, randomStart: true }
  }
]

export function cleanMixtapeName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

/** Reads the layers of a mixtape from a message. Layers of the same track are kept once. */
export function parseMixtapeLayers(raw: unknown): MixtapeLayer[] {
  if (!Array.isArray(raw)) throw new Error('Invalid layers')
  if (raw.length > MAX_MIXTAPE_LAYERS) throw new Error('Too many layers')

  const seen = new Set<number>()
  const layers: MixtapeLayer[] = []
  for (const item of raw) {
    const source =
      typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {}
    const trackId = source.trackId
    if (typeof trackId !== 'number' || !Number.isInteger(trackId) || trackId <= 0) {
      throw new Error('Invalid layers')
    }
    if (seen.has(trackId)) continue
    seen.add(trackId)
    layers.push({ trackId, ...sanitizeLayerSettings(source) })
  }
  return layers
}
