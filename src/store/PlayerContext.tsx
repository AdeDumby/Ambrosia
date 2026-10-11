import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject
} from 'react'
import { gainForTarget } from '../shared/loudness'
import { useLibrary } from './LibraryContext'
import { useSettings } from './SettingsContext'

export type PlayerTrack = { id: number; filename: string }

type PlayerState = {
  audioRef: RefObject<HTMLAudioElement | null>
  currentTrack: PlayerTrack | null
  isPlaying: boolean
  volume: number
  playTrack: (track: PlayerTrack) => void
  toggleTrack: (track: PlayerTrack) => void
  togglePause: () => void
  seek: (seconds: number) => void
  setVolume: (value: number) => void
  stop: () => void
  stopTrack: (trackId: number) => void
}

type Graph = { context: AudioContext; gain: GainNode }

const PlayerContext = createContext<PlayerState | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const { tracks } = useLibrary()
  const audioRef = useRef<HTMLAudioElement>(null)
  const graphRef = useRef<Graph | null>(null)
  const currentRef = useRef<PlayerTrack | null>(null)
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(settings.playback.defaultVolume)
  const { normalize, targetLufs } = settings.playback

  const loudness = useMemo(() => {
    if (!currentTrack) return null
    const track = tracks.find((candidate) => candidate.id === currentTrack.id)
    if (!track || track.loudnessLufs === null || track.loudnessPeak === null) return null
    return { lufs: track.loudnessLufs, peak: track.loudnessPeak }
  }, [tracks, currentTrack])
  const lufs = loudness?.lufs ?? null
  const peak = loudness?.peak ?? null

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  useEffect(() => {
    const graph = graphRef.current
    if (!graph) return
    const gain =
      normalize && lufs !== null && peak !== null ? gainForTarget(lufs, peak, targetLufs) : 1
    graph.gain.gain.setTargetAtTime(gain, graph.context.currentTime, 0.015)
  }, [normalize, targetLufs, lufs, peak])

  const ensureGraph = useCallback((): Graph | null => {
    const audio = audioRef.current
    if (!audio) return null
    if (!graphRef.current) {
      try {
        const context = new AudioContext()
        const source = context.createMediaElementSource(audio)
        const gain = context.createGain()
        source.connect(gain)
        gain.connect(context.destination)
        graphRef.current = { context, gain }
      } catch {
        return null
      }
    }
    return graphRef.current
  }, [])

  const resumePlayback = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    void ensureGraph()?.context.resume()
    void audio.play().catch(() => {})
  }, [ensureGraph])

  const playTrack = useCallback(
    (track: PlayerTrack) => {
      const audio = audioRef.current
      if (!audio) return
      ensureGraph()
      audio.src = `ambrosia-audio://track/${track.id}`
      currentRef.current = track
      setCurrentTrack(track)
      resumePlayback()
    },
    [ensureGraph, resumePlayback]
  )

  const toggleTrack = useCallback(
    (track: PlayerTrack) => {
      const audio = audioRef.current
      if (!audio) return

      const isCurrent = currentRef.current?.id === track.id && audio.src !== '' && !audio.error
      if (isCurrent) {
        if (audio.paused) resumePlayback()
        else audio.pause()
        return
      }

      playTrack(track)
    },
    [playTrack, resumePlayback]
  )

  const togglePause = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentRef.current) return
    if (audio.paused) resumePlayback()
    else audio.pause()
  }, [resumePlayback])

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (audio) audio.currentTime = seconds
  }, [])

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    currentRef.current = null
    setCurrentTrack(null)
  }, [])

  const stopTrack = useCallback(
    (trackId: number) => {
      if (currentRef.current?.id === trackId) stop()
    },
    [stop]
  )

  const value = useMemo(
    () => ({
      audioRef,
      currentTrack,
      isPlaying,
      volume,
      playTrack,
      toggleTrack,
      togglePause,
      seek,
      setVolume,
      stop,
      stopTrack
    }),
    [currentTrack, isPlaying, volume, playTrack, toggleTrack, togglePause, seek, stop, stopTrack]
  )

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={() => setIsPlaying(false)}
      />
    </PlayerContext.Provider>
  )
}

export function usePlayer(): PlayerState {
  const context = useContext(PlayerContext)
  if (!context) throw new Error('usePlayer must be used inside PlayerProvider')
  return context
}
