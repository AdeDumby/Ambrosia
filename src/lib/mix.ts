export type MixLayer = {
  trackId: number
  /** 0 to 1. A new layer starts silent. */
  volume: number
  loop: boolean
  playing: boolean
}

export type MixAction =
  | { type: 'add'; trackId: number }
  | { type: 'volume'; trackId: number; volume: number }
  | { type: 'loop'; trackId: number; loop: boolean }
  | { type: 'playing'; trackId: number; playing: boolean }
  | { type: 'remove'; trackId: number }
  | { type: 'remove-missing'; existingIds: ReadonlySet<number> }
  | { type: 'play-all' }
  | { type: 'pause-all' }
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

function patch(layers: MixLayer[], trackId: number, change: Partial<MixLayer>): MixLayer[] {
  let found = false
  const next = layers.map((layer) => {
    if (layer.trackId !== trackId) return layer
    found = true
    return { ...layer, ...change }
  })
  return found ? next : layers
}

function add(layers: MixLayer[], trackId: number): MixLayer[] {
  // Playing the same track again keeps its layer, and its place in the list, as it is.
  if (layers.some((layer) => layer.trackId === trackId)) return layers

  const created: MixLayer = { trackId, volume: 0, loop: false, playing: false }
  const next = [created, ...layers]
  if (next.length <= MAX_LAYERS) return next

  // Drop the oldest layer that is not making sound. If every layer is playing, keep them all.
  for (let index = next.length - 1; index > 0; index -= 1) {
    if (!next[index].playing) return next.filter((_, position) => position !== index)
  }
  return layers
}

export function mixReducer(layers: MixLayer[], action: MixAction): MixLayer[] {
  switch (action.type) {
    case 'add':
      return add(layers, action.trackId)
    case 'volume':
      return patch(layers, action.trackId, { volume: clampVolume(action.volume) })
    case 'loop':
      return patch(layers, action.trackId, { loop: action.loop })
    case 'playing':
      return patch(layers, action.trackId, { playing: action.playing })
    case 'remove':
      return layers.filter((layer) => layer.trackId !== action.trackId)
    case 'remove-missing': {
      const kept = layers.filter((layer) => action.existingIds.has(layer.trackId))
      return kept.length === layers.length ? layers : kept
    }
    case 'play-all':
      // Silent layers stay paused: starting them would only use up the disk and the CPU.
      return layers.map((layer) =>
        layer.volume > 0 && !layer.playing ? { ...layer, playing: true } : layer
      )
    case 'pause-all':
      return layers.map((layer) => (layer.playing ? { ...layer, playing: false } : layer))
    case 'remove-silent':
      return layers.filter((layer) => !isSilent(layer))
    case 'clear':
      return layers.length === 0 ? layers : []
  }
}

/** Gain given to one layer: its own volume, times the loudness correction of its track. */
export function layerGain(volume: number, normalizeGain: number): number {
  return clampVolume(volume) * normalizeGain
}
