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
  reverb: 0
}

export const LAYER_LIMITS = {
  volume: { min: 0, max: 1 },
  pan: { min: -1, max: 1 },
  speed: { min: 0.25, max: 2 },
  fade: { min: 0, max: 30 },
  time: { min: 0, max: 36000 },
  gap: { min: 0, max: 3600 },
  eq: { min: -12, max: 12 },
  reverb: { min: 0, max: 1 }
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
  'reverb'
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
    reverb: number(source.reverb, base.reverb, limits.reverb)
  }
}

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
