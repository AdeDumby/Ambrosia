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
import { mixReducer, toMixtapeLayer, type MixLayer } from '../lib/mix'
import { MixEngine, type EngineTrack } from '../lib/mixEngine'
import { gainForTarget } from '../shared/loudness'
import type { LayerSettings, Mixtape } from '../shared/mixtape'
import { useLibrary } from './LibraryContext'
import { usePlayer } from './PlayerContext'
import { useSettings } from './SettingsContext'

type MixState = {
  layers: MixLayer[]
  master: number
  anyPlaying: boolean
  anySolo: boolean
  /** The layer whose settings are shown in the panel. */
  selectedId: number | null
  /** The mixtape the current layers came from, or were saved as. */
  loadedMixtape: Mixtape | null
  select: (trackId: number | null) => void
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
  /** Replaces the mix with the components of a mixtape, and starts them. */
  playMixtape: (mixtape: Mixtape) => void
  saveAsMixtape: (name: string) => Promise<void>
  updateMixtape: () => Promise<void>
}

const MixContext = createContext<MixState | null>(null)
/** Review plays every unreviewed track by itself, so those are not meant for the mix. */
const NO_AUTO_ADD = '/review'

export function MixProvider({ children }: { children: ReactNode }) {
  const { tracks, mixtapes, refreshMixtapes } = useLibrary()
  const { settings } = useSettings()
  const { currentTrack } = usePlayer()
  const { pathname } = useLocation()
  const [layers, dispatch] = useReducer(mixReducer, [])
  const [master, setMasterValue] = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loadedId, setLoadedId] = useState<number | null>(null)
  const engineRef = useRef<MixEngine | null>(null)
  const pathRef = useRef(pathname)
  const { normalize, targetLufs } = settings.playback

  useEffect(() => {
    pathRef.current = pathname
  }, [pathname])

  // A track that starts playing in the main player is sent to the mix, silent and paused.
  const currentId = currentTrack?.id
  useEffect(() => {
    if (currentId === undefined || pathRef.current === NO_AUTO_ADD) return
    dispatch({ type: 'add', trackId: currentId })
  }, [currentId])

  // Forget layers whose track was deleted from the library.
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
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  const trackById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks])

  // Keeps the sound in line with the layers.
  useEffect(() => {
    const info = new Map<number, EngineTrack>()
    for (const layer of layers) {
      const track = trackById.get(layer.trackId)
      const measured = track && track.loudnessLufs !== null && track.loudnessPeak !== null
      info.set(layer.trackId, {
        durationSec: track?.durationSec ?? 0,
        correction:
          normalize && measured
            ? gainForTarget(track.loudnessLufs!, track.loudnessPeak!, targetLufs)
            : 1
      })
    }
    engineRef.current?.sync(layers, master, info)
  }, [layers, master, trackById, normalize, targetLufs])

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
      if (current) dispatch({ type: 'playing', trackId, playing: !current.playing })
    },
    [layers]
  )
  const remove = useCallback((trackId: number) => dispatch({ type: 'remove', trackId }), [])
  const playAll = useCallback(() => dispatch({ type: 'play-all' }), [])
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
    // A mixtape whose tracks were all deleted has nothing to play: keep the mix as it is.
    if (mixtape.layers.length === 0) return
    dispatch({ type: 'clear' })
    dispatch({ type: 'load', layers: mixtape.layers })
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
      select: setSelectedId,
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
