import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { useLocation } from 'react-router-dom'
import { affectsLoudness, loudnessKey } from '../lib/layerChain'
import { loudnessCorrection } from '../lib/layerLoudness'
import { mixReducer, toMixtapeLayer, type MixLayer } from '../lib/mix'
import { MixEngine, type EngineTrack } from '../lib/mixEngine'
import { gainForTarget } from '../shared/loudness'
import { LAYER_PRESETS, type LayerSettings, type Mixtape } from '../shared/mixtape'
import { useLibrary } from './LibraryContext'
import { usePlayer } from './PlayerContext'
import { useSettings } from './SettingsContext'

type MixState = {
  layers: MixLayer[]
  master: number
  anyPlaying: boolean
  anySolo: boolean
  selectedId: number | null
  loadedMixtape: Mixtape | null
  copied: LayerSettings | null
  limiter: boolean
  matching: number
  fading: boolean
  sleepEndsAt: number | null
  select: (trackId: number | null) => void
  setLimiter: (on: boolean) => void
  applyPreset: (trackId: number, name: string) => void
  copyEffects: (trackId: number) => void
  pasteEffects: (trackId: number) => void
  fadeOutAndPause: (seconds: number) => void
  startSleepTimer: (minutes: number) => void
  cancelSleep: () => void
  setMaster: (value: number) => void
  update: (trackId: number, patch: Partial<LayerSettings>) => void
  resetEffects: (trackId: number) => void
  togglePlaying: (trackId: number) => void
  remove: (trackId: number) => void
  playAll: () => void
  pauseAll: () => void
  unsoloAll: () => void
  removeSilent: () => void
  clear: () => void
  playMixtape: (mixtape: Mixtape) => void
  saveAsMixtape: (name: string) => Promise<void>
  updateMixtape: () => Promise<void>
}

const MixContext = createContext<MixState | null>(null)
const NO_AUTO_ADD = '/review'
const MATCH_DELAY_MS = 350
const MAX_MATCHED = 300
const SLEEP_FADE_SECONDS = 20

export function MixProvider({ children }: { children: ReactNode }) {
  const { tracks, mixtapes, refreshMixtapes } = useLibrary()
  const { settings } = useSettings()
  const { currentTrack } = usePlayer()
  const { pathname } = useLocation()
  const [layers, dispatch] = useReducer(mixReducer, [])
  const [master, setMasterValue] = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loadedId, setLoadedId] = useState<number | null>(null)
  const [copied, setCopied] = useState<LayerSettings | null>(null)
  const [limiter, setLimiterValue] = useState(false)
  const [fading, setFading] = useState(false)
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null)
  const sleepTimer = useRef<number | undefined>(undefined)
  const [matched, setMatched] = useState<Map<string, number>>(new Map())
  const measuring = useRef(new Set<string>())
  const lastCorrection = useRef(new Map<number, number>())
  const engineRef = useRef<MixEngine | null>(null)
  const pathRef = useRef(pathname)
  const { normalize, targetLufs } = settings.playback

  useEffect(() => {
    pathRef.current = pathname
  }, [pathname])

  const currentId = currentTrack?.id
  useEffect(() => {
    if (currentId === undefined || pathRef.current === NO_AUTO_ADD) return
    dispatch({ type: 'add', trackId: currentId })
  }, [currentId])

  useEffect(() => {
    if (tracks.length === 0) return
    dispatch({ type: 'remove-missing', existingIds: new Set(tracks.map((track) => track.id)) })
  }, [tracks])

  useEffect(() => {
    const engine = new MixEngine((trackId) =>
      dispatch({ type: 'playing', trackId, playing: false })
    )
    engineRef.current = engine
    return () => {
      window.clearTimeout(sleepTimer.current)
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  const trackById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks])

  const needsMatch = useCallback(
    (layer: MixLayer) => normalize && affectsLoudness(layer) && trackById.has(layer.trackId),
    [normalize, trackById]
  )
  const matchKey = useCallback(
    (layer: MixLayer) => `${layer.trackId}|${targetLufs}|${loudnessKey(layer)}`,
    [targetLufs]
  )

  const matching = useMemo(
    () => layers.filter((layer) => needsMatch(layer) && !matched.has(matchKey(layer))).length,
    [layers, matched, needsMatch, matchKey]
  )

  useEffect(() => {
    const missing = layers.filter(
      (layer) =>
        needsMatch(layer) &&
        !matched.has(matchKey(layer)) &&
        !measuring.current.has(matchKey(layer))
    )
    if (missing.length === 0) return
    const timer = window.setTimeout(() => {
      for (const layer of missing) {
        const key = matchKey(layer)
        if (measuring.current.has(key)) continue
        measuring.current.add(key)
        const track = trackById.get(layer.trackId)
        const plain =
          track && track.loudnessLufs !== null && track.loudnessPeak !== null
            ? gainForTarget(track.loudnessLufs, track.loudnessPeak, targetLufs)
            : 1
        void loudnessCorrection(layer.trackId, layer, targetLufs)
          .catch(() => null)
          .then((correction) => {
            measuring.current.delete(key)
            setMatched((previous) => {
              const next = new Map(previous).set(key, correction ?? plain)
              while (next.size > MAX_MATCHED) next.delete(next.keys().next().value as string)
              return next
            })
          })
      }
    }, MATCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [layers, matched, needsMatch, matchKey, trackById, targetLufs])

  useEffect(() => {
    const info = new Map<number, EngineTrack>()
    for (const layer of layers) {
      const track = trackById.get(layer.trackId)
      const measured = track && track.loudnessLufs !== null && track.loudnessPeak !== null
      const plain =
        normalize && measured
          ? gainForTarget(track.loudnessLufs!, track.loudnessPeak!, targetLufs)
          : 1
      let correction = plain
      let pending = false
      if (needsMatch(layer)) {
        const found = matched.get(matchKey(layer))
        if (found !== undefined) {
          correction = found
          lastCorrection.current.set(layer.trackId, found)
        } else {
          correction = lastCorrection.current.get(layer.trackId) ?? plain
          pending = true
        }
      } else {
        lastCorrection.current.delete(layer.trackId)
      }
      info.set(layer.trackId, { durationSec: track?.durationSec ?? 0, correction, pending })
    }
    engineRef.current?.sync(layers, master, info)
  }, [layers, master, trackById, normalize, targetLufs, matched, needsMatch, matchKey])

  useEffect(() => {
    engineRef.current?.setLimiter(limiter)
  }, [limiter])

  const update = useCallback(
    (trackId: number, patch: Partial<LayerSettings>) => dispatch({ type: 'set', trackId, patch }),
    []
  )
  const resetEffects = useCallback(
    (trackId: number) => dispatch({ type: 'reset-effects', trackId }),
    []
  )
  const togglePlaying = useCallback(
    (trackId: number) => {
      const current = layers.find((layer) => layer.trackId === trackId)
      if (!current) return
      if (!current.playing) engineRef.current?.cancelFade()
      dispatch({ type: 'playing', trackId, playing: !current.playing })
    },
    [layers]
  )
  const layersRef = useRef(layers)
  useEffect(() => {
    layersRef.current = layers
  }, [layers])

  const applyPreset = useCallback((trackId: number, name: string) => {
    const preset = LAYER_PRESETS.find((candidate) => candidate.name === name)
    if (preset) dispatch({ type: 'preset', trackId, settings: preset.settings })
  }, [])
  const copyEffects = useCallback((trackId: number) => {
    const source = layersRef.current.find((layer) => layer.trackId === trackId)
    if (source) setCopied({ ...source })
  }, [])
  const pasteEffects = useCallback(
    (trackId: number) => {
      if (copied) dispatch({ type: 'paste', trackId, settings: copied })
    },
    [copied]
  )
  const setLimiter = useCallback((on: boolean) => setLimiterValue(on), [])

  const cancelSleep = useCallback(() => {
    window.clearTimeout(sleepTimer.current)
    sleepTimer.current = undefined
    setSleepEndsAt(null)
    setFading(false)
    engineRef.current?.cancelFade()
  }, [])
  const fadeOutAndPause = useCallback((seconds: number) => {
    setFading(true)
    const engine = engineRef.current
    const finish = () => {
      dispatch({ type: 'pause-all' })
      setFading(false)
      setSleepEndsAt(null)
    }
    if (engine) engine.fadeOut(seconds, finish)
    else finish()
  }, [])
  const startSleepTimer = useCallback(
    (minutes: number) => {
      cancelSleep()
      const total = minutes * 60
      setSleepEndsAt(Date.now() + total * 1000)
      const wait = Math.max(0, total - SLEEP_FADE_SECONDS)
      const fadeFor = Math.min(SLEEP_FADE_SECONDS, total)
      sleepTimer.current = window.setTimeout(() => fadeOutAndPause(fadeFor), wait * 1000)
    },
    [cancelSleep, fadeOutAndPause]
  )

  const remove = useCallback((trackId: number) => dispatch({ type: 'remove', trackId }), [])
  const playAll = useCallback(() => {
    engineRef.current?.cancelFade()
    dispatch({ type: 'play-all' })
  }, [])
  const pauseAll = useCallback(() => dispatch({ type: 'pause-all' }), [])
  const unsoloAll = useCallback(() => dispatch({ type: 'unsolo-all' }), [])
  const removeSilent = useCallback(() => dispatch({ type: 'remove-silent' }), [])
  const clear = useCallback(() => {
    dispatch({ type: 'clear' })
    setLoadedId(null)
  }, [])
  const setMaster = useCallback((value: number) => {
    setMasterValue(Math.min(1, Math.max(0, value)))
  }, [])

  const playMixtape = useCallback((mixtape: Mixtape) => {
    if (mixtape.layers.length === 0) return
    dispatch({ type: 'clear' })
    dispatch({ type: 'load', layers: mixtape.layers })
    engineRef.current?.cancelFade()
    dispatch({ type: 'play-all' })
    setMasterValue(mixtape.master)
    setLoadedId(mixtape.id)
    setSelectedId(mixtape.layers[0]?.trackId ?? null)
  }, [])

  const saveAsMixtape = useCallback(
    async (name: string) => {
      const id = await window.api.createMixtape(name, master, layers.map(toMixtapeLayer))
      await refreshMixtapes()
      setLoadedId(id)
    },
    [layers, master, refreshMixtapes]
  )

  const loadedMixtape = useMemo(
    () => mixtapes.find((mixtape) => mixtape.id === loadedId) ?? null,
    [mixtapes, loadedId]
  )

  const updateMixtape = useCallback(async () => {
    if (!loadedMixtape) return
    await window.api.replaceMixtape(loadedMixtape.id, master, layers.map(toMixtapeLayer))
    await refreshMixtapes()
  }, [loadedMixtape, layers, master, refreshMixtapes])

  const selected = layers.some((layer) => layer.trackId === selectedId) ? selectedId : null
  const anyPlaying = layers.some((layer) => layer.playing)
  const anySolo = layers.some((layer) => layer.solo)

  const value = useMemo(
    () => ({
      layers,
      master,
      anyPlaying,
      anySolo,
      selectedId: selected,
      loadedMixtape,
      copied,
      limiter,
      matching,
      fading,
      sleepEndsAt,
      select: setSelectedId,
      setLimiter,
      applyPreset,
      copyEffects,
      pasteEffects,
      fadeOutAndPause,
      startSleepTimer,
      cancelSleep,
      setMaster,
      update,
      resetEffects,
      togglePlaying,
      remove,
      playAll,
      pauseAll,
      unsoloAll,
      removeSilent,
      clear,
      playMixtape,
      saveAsMixtape,
      updateMixtape
    }),
    [
      layers,
      master,
      anyPlaying,
      anySolo,
      selected,
      loadedMixtape,
      copied,
      limiter,
      matching,
      fading,
      sleepEndsAt,
      setLimiter,
      applyPreset,
      copyEffects,
      pasteEffects,
      fadeOutAndPause,
      startSleepTimer,
      cancelSleep,
      setMaster,
      update,
      resetEffects,
      togglePlaying,
      remove,
      playAll,
      pauseAll,
      unsoloAll,
      removeSilent,
      clear,
      playMixtape,
      saveAsMixtape,
      updateMixtape
    ]
  )

  return <MixContext.Provider value={value}>{children}</MixContext.Provider>
}

export function useMix(): MixState {
  const context = useContext(MixContext)
  if (!context) throw new Error('useMix must be used inside MixProvider')
  return context
}
