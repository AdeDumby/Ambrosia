import {
  COPY_KEYS,
  DEFAULT_LAYER_SETTINGS,
  EFFECT_KEYS,
  sanitizeLayerSettings,
  type LayerSettings,
  type MixtapeLayer
} from '../shared/mixtape'

export type MixLayer = LayerSettings & {
  trackId: number
  playing: boolean
}

export type MixAction =
  | { type: 'add'; trackId: number }
  | { type: 'load'; layers: MixtapeLayer[] }
  | { type: 'set'; trackId: number; patch: Partial<LayerSettings> }
  | { type: 'reset-effects'; trackId: number }
  | { type: 'preset'; trackId: number; settings: Partial<LayerSettings> }
  | { type: 'paste'; trackId: number; settings: LayerSettings }
  | { type: 'playing'; trackId: number; playing: boolean }
  | { type: 'remove'; trackId: number }
  | { type: 'remove-missing'; existingIds: ReadonlySet<number> }
  | { type: 'play-all' }
  | { type: 'pause-all' }
  | { type: 'unsolo-all' }
  | { type: 'remove-silent' }
  | { type: 'clear' }

/** Playing a lot of tracks adds a lot of layers, so the oldest idle ones are dropped past this. */
export const MAX_LAYERS = 100

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function isSilent(layer: MixLayer): boolean {
  return layer.volume === 0 && !layer.playing
}

function fresh(trackId: number): MixLayer {
  return { trackId, ...DEFAULT_LAYER_SETTINGS, playing: false }
}

function patchLayer(
  layers: MixLayer[],
  trackId: number,
  change: (layer: MixLayer) => MixLayer
): MixLayer[] {
  let found = false
  const next = layers.map((layer) => {
    if (layer.trackId !== trackId) return layer
    found = true
    return change(layer)
  })
  return found ? next : layers
}

/** Drops the oldest layers that are not playing until the list fits, never one that must stay. */
function trim(layers: MixLayer[], keep: ReadonlySet<number> = new Set()): MixLayer[] {
  let result = layers
  for (let index = result.length - 1; index > 0 && result.length > MAX_LAYERS; index -= 1) {
    const layer = result[index]
    if (layer.playing || keep.has(layer.trackId)) continue
    result = result.filter((_, position) => position !== index)
  }
  return result
}

function add(layers: MixLayer[], trackId: number): MixLayer[] {
  // Playing the same track again keeps its layer, and its place in the list, as it is.
  if (layers.some((layer) => layer.trackId === trackId)) return layers

  const next = [fresh(trackId), ...layers]
  const trimmed = trim(next, new Set([trackId]))
  // When every other layer is playing there is no room: the new one is not added.
  return trimmed.length > MAX_LAYERS ? layers : trimmed
}

/** Puts the components of a mixtape in the mix with their saved settings, paused. */
function load(layers: MixLayer[], incoming: MixtapeLayer[]): MixLayer[] {
  if (incoming.length === 0) return layers

  const byTrack = new Map(incoming.map((layer) => [layer.trackId, layer]))
  const known = new Set(layers.map((layer) => layer.trackId))
  const updated = layers.map((layer) => {
    const saved = byTrack.get(layer.trackId)
    return saved
      ? { ...sanitizeLayerSettings(saved), trackId: layer.trackId, playing: false }
      : layer
  })
  const added = incoming
    .filter((layer) => !known.has(layer.trackId))
    .map((layer) => ({ ...sanitizeLayerSettings(layer), trackId: layer.trackId, playing: false }))

  return trim([...added, ...updated], new Set(byTrack.keys()))
}

function resetEffects(layer: MixLayer): MixLayer {
  const next = { ...layer }
  for (const key of EFFECT_KEYS) {
    ;(next as Record<string, unknown>)[key] = DEFAULT_LAYER_SETTINGS[key]
  }
  return next
}

export function mixReducer(layers: MixLayer[], action: MixAction): MixLayer[] {
  switch (action.type) {
    case 'add':
      return add(layers, action.trackId)
    case 'load':
      return load(layers, action.layers)
    case 'set':
      return patchLayer(layers, action.trackId, (layer) => ({
        ...layer,
        ...sanitizeLayerSettings({ ...layer, ...action.patch }),
        trackId: layer.trackId,
        playing: layer.playing
      }))
    case 'reset-effects':
      return patchLayer(layers, action.trackId, resetEffects)
    case 'preset':
      // A preset starts from plain effects, so presets do not pile up on each other.
      return patchLayer(layers, action.trackId, (layer) => ({
        ...layer,
        ...sanitizeLayerSettings(
          { ...resetEffects(layer), ...action.settings },
          DEFAULT_LAYER_SETTINGS
        ),
        volume: layer.volume,
        loop: layer.loop,
        muted: layer.muted,
        solo: layer.solo
      }))
    case 'paste':
      return patchLayer(layers, action.trackId, (layer) => {
        const next = { ...layer }
        for (const key of COPY_KEYS) {
          ;(next as Record<string, unknown>)[key] = action.settings[key]
        }
        return next
      })
    case 'playing':
      return patchLayer(layers, action.trackId, (layer) =>
        layer.playing === action.playing ? layer : { ...layer, playing: action.playing }
      )
    case 'remove':
      return layers.filter((layer) => layer.trackId !== action.trackId)
    case 'remove-missing': {
      const kept = layers.filter((layer) => action.existingIds.has(layer.trackId))
      return kept.length === layers.length ? layers : kept
    }
    case 'play-all':
      // Layers that make no sound stay paused: starting them would only use up the disk and CPU.
      return layers.map((layer) =>
        layer.volume > 0 && !layer.playing ? { ...layer, playing: true } : layer
      )
    case 'pause-all':
      return layers.map((layer) => (layer.playing ? { ...layer, playing: false } : layer))
    case 'unsolo-all':
      return layers.some((layer) => layer.solo)
        ? layers.map((layer) => (layer.solo ? { ...layer, solo: false } : layer))
        : layers
    case 'remove-silent':
      return layers.filter((layer) => !isSilent(layer))
    case 'clear':
      return layers.length === 0 ? layers : []
  }
}

/** A layer is heard unless it is muted, or another layer is solo and this one is not. */
export function isAudible(layer: LayerSettings, anySolo: boolean): boolean {
  return !layer.muted && (!anySolo || layer.solo)
}

/** Gain given to one layer: its own volume, times the loudness correction of its track. */
export function layerGain(layer: LayerSettings, anySolo: boolean, correction: number): number {
  return isAudible(layer, anySolo) ? clampVolume(layer.volume) * correction : 0
}

/**
 * True when the browser can repeat the track by itself. Anything that needs a decision at the
 * end of the track (a trimmed part, a pause between loops, a fade out) is handled by the mix.
 */
export function usesNativeLoop(layer: LayerSettings): boolean {
  return (
    layer.loop &&
    layer.startAt === 0 &&
    layer.endAt === 0 &&
    layer.gapMax === 0 &&
    layer.fadeOut === 0 &&
    !layer.randomStart &&
    !hasVariation(layer)
  )
}

/** True when the volume, pan or speed change a little each time the layer starts or loops. */
export function hasVariation(layer: LayerSettings): boolean {
  return layer.volumeJitter > 0 || layer.panJitter > 0 || layer.speedJitter > 0
}

export type Variation = {
  /** Multiplies the volume. 1 or less. */
  volume: number
  /** Added to the pan. */
  pan: number
  /** Multiplies the speed. */
  speed: number
}

/** The random change for one play. Each `random` is 0 to 1. The volume never goes above the set one. */
export function variationFor(
  layer: LayerSettings,
  random: { volume: number; pan: number; speed: number }
): Variation {
  const signed = (value: number) => value * 2 - 1
  return {
    volume: 1 - layer.volumeJitter * random.volume,
    pan: signed(random.pan) * layer.panJitter,
    speed: 1 + signed(random.speed) * layer.speedJitter
  }
}

export type PlayWindow = { start: number; end: number }

/** The part of a track that is played, in seconds, for a track of the given length. */
export function playWindow(layer: LayerSettings, duration: number): PlayWindow {
  const length = Number.isFinite(duration) && duration > 0 ? duration : 0
  if (length === 0) return { start: layer.startAt, end: layer.endAt > 0 ? layer.endAt : 0 }
  const end = layer.endAt > 0 ? Math.min(layer.endAt, length) : length
  const start = Math.min(layer.startAt, Math.max(0, end - 0.1))
  return { start, end }
}

/** Where to start: the beginning of the part, or somewhere inside it. `random` is 0 to 1. */
export function startPosition(layer: LayerSettings, window: PlayWindow, random: number): number {
  if (!layer.randomStart) return window.start
  const room = window.end - window.start - 0.5
  return room > 0 ? window.start + random * room : window.start
}

/** Seconds to wait before the next loop. `random` is 0 to 1. */
export function loopGap(layer: LayerSettings, random: number): number {
  if (layer.gapMax <= 0) return 0
  return layer.gapMin + random * (layer.gapMax - layer.gapMin)
}

export type FadePlan = {
  /** Seconds of fade in, from now. */
  fadeIn: number
  /** When the fade out starts, in seconds from now, and how long it lasts. */
  fadeOutAfter: number
  fadeOut: number
}

/**
 * Fades for a play that starts now at `position` of the part `window`. Lengths are in real
 * time, so a track played faster is over sooner. Without a fade out the end is left alone.
 */
export function fadePlan(layer: LayerSettings, window: PlayWindow, position: number): FadePlan {
  const remaining = Math.max(0, (window.end - position) / layer.speed)
  const fadeIn = window.end > 0 ? Math.min(layer.fadeIn, remaining) : layer.fadeIn
  if (layer.fadeOut <= 0 || window.end <= 0) return { fadeIn, fadeOutAfter: 0, fadeOut: 0 }
  const fadeOut = Math.min(layer.fadeOut, remaining)
  return { fadeIn, fadeOutAfter: Math.max(0, remaining - fadeOut), fadeOut }
}

/** The saved form of a layer: its settings, without whether it is playing right now. */
export function toMixtapeLayer(layer: MixLayer): MixtapeLayer {
  const { playing, ...saved } = layer
  void playing
  return saved
}
