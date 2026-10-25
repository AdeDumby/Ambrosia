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
import { layerGain, mixReducer, type MixLayer } from '../lib/mix'
import { gainForTarget } from '../shared/loudness'
import { useLibrary } from './LibraryContext'
import { usePlayer } from './PlayerContext'
import { useSettings } from './SettingsContext'

type MixState = {
  layers: MixLayer[]
  master: number
  anyPlaying: boolean
  setMaster: (value: number) => void
  setVolume: (trackId: number, volume: number) => void
  setLoop: (trackId: number, loop: boolean) => void
  togglePlaying: (trackId: number) => void
  remove: (trackId: number) => void
  playAll: () => void
  pauseAll: () => void
  removeSilent: () => void
  clear: () => void
}

type Graph = { context: AudioContext; master: GainNode }
type Voice = { audio: HTMLAudioElement; gain: GainNode | null }

const MixContext = createContext<MixState | null>(null)
const SMOOTHING_SECONDS = 0.015
/** Review plays every unreviewed track by itself, so those are not meant for the mix. */
const NO_AUTO_ADD = '/review'

export function MixProvider({ children }: { children: ReactNode }) {
  const { tracks } = useLibrary()
  const { settings } = useSettings()
  const { currentTrack } = usePlayer()
  const { pathname } = useLocation()
  const [layers, dispatch] = useReducer(mixReducer, [])
  const [master, setMaster] = useState(1)
  const graphRef = useRef<Graph | null>(null)
  const voicesRef = useRef(new Map<number, Voice>())
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

  const ensureGraph = useCallback((): Graph | null => {
    if (graphRef.current) return graphRef.current
    try {
      const context = new AudioContext()
      const masterGain = context.createGain()
      masterGain.connect(context.destination)
      graphRef.current = { context, master: masterGain }
    } catch {
      return null
    }
    return graphRef.current
  }, [])

  const createVoice = useCallback(
    (trackId: number): Voice => {
      const audio = new Audio()
      audio.crossOrigin = 'anonymous'
      audio.preload = 'none'
      audio.src = `ambrosia-audio://track/${trackId}`
      audio.addEventListener('ended', () => dispatch({ type: 'playing', trackId, playing: false }))
      audio.addEventListener('error', () => dispatch({ type: 'playing', trackId, playing: false }))

      const graph = ensureGraph()
      let gain: GainNode | null = null
      if (graph) {
        try {
          const source = graph.context.createMediaElementSource(audio)
          gain = graph.context.createGain()
          gain.gain.value = 0
          source.connect(gain)
          gain.connect(graph.master)
        } catch {
          gain = null
        }
      }
      return { audio, gain }
    },
    [ensureGraph]
  )

  // Keeps the audio elements in line with the layers: create, set volume and loop, play or pause.
  useEffect(() => {
    const voices = voicesRef.current
    const wanted = new Set(layers.map((layer) => layer.trackId))

    for (const [trackId, voice] of voices) {
      if (wanted.has(trackId)) continue
      voice.audio.pause()
      voice.audio.removeAttribute('src')
      voice.audio.load()
      voice.gain?.disconnect()
      voices.delete(trackId)
    }

    const graph = graphRef.current
    if (graph) {
      graph.master.gain.setTargetAtTime(master, graph.context.currentTime, SMOOTHING_SECONDS)
    }

    for (const layer of layers) {
      let voice = voices.get(layer.trackId)
      if (!voice) {
        voice = createVoice(layer.trackId)
        voices.set(layer.trackId, voice)
      }

      const track = tracks.find((candidate) => candidate.id === layer.trackId)
      const correction =
        normalize && track && track.loudnessLufs !== null && track.loudnessPeak !== null
          ? gainForTarget(track.loudnessLufs, track.loudnessPeak, targetLufs)
          : 1
      const gain = layerGain(layer.volume, correction)

      voice.audio.loop = layer.loop
      if (voice.gain && graphRef.current) {
        voice.gain.gain.setTargetAtTime(
          gain,
          graphRef.current.context.currentTime,
          SMOOTHING_SECONDS
        )
      } else {
        // No audio graph available: the plain volume still works, without the loudness correction.
        voice.audio.volume = Math.min(1, gain * master)
      }

      if (layer.playing && voice.audio.paused) {
        void graphRef.current?.context.resume()
        const trackId = layer.trackId
        voice.audio.play().catch(() => dispatch({ type: 'playing', trackId, playing: false }))
      } else if (!layer.playing && !voice.audio.paused) {
        voice.audio.pause()
      }
    }
  }, [layers, master, tracks, normalize, targetLufs, createVoice])

  useEffect(() => {
    const voices = voicesRef.current
    return () => {
      for (const voice of voices.values()) voice.audio.pause()
      voices.clear()
      void graphRef.current?.context.close().catch(() => {})
      graphRef.current = null
    }
  }, [])

  const setVolume = useCallback(
    (trackId: number, volume: number) => dispatch({ type: 'volume', trackId, volume }),
    []
  )
  const setLoop = useCallback(
    (trackId: number, loop: boolean) => dispatch({ type: 'loop', trackId, loop }),
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
  const removeSilent = useCallback(() => dispatch({ type: 'remove-silent' }), [])
  const clear = useCallback(() => dispatch({ type: 'clear' }), [])

  const anyPlaying = layers.some((layer) => layer.playing)

  const value = useMemo(
    () => ({
      layers,
      master,
      anyPlaying,
      setMaster,
      setVolume,
      setLoop,
      togglePlaying,
      remove,
      playAll,
      pauseAll,
      removeSilent,
      clear
    }),
    [
      layers,
      master,
      anyPlaying,
      setVolume,
      setLoop,
      togglePlaying,
      remove,
      playAll,
      pauseAll,
      removeSilent,
      clear
    ]
  )

  return <MixContext.Provider value={value}>{children}</MixContext.Provider>
}

export function useMix(): MixState {
  const context = useContext(MixContext)
  if (!context) throw new Error('useMix must be used inside MixProvider')
  return context
}
