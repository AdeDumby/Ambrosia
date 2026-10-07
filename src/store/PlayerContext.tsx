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

const PlayerContext = createContext<PlayerState | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const audioRef = useRef<HTMLAudioElement>(null)
  const currentRef = useRef<PlayerTrack | null>(null)
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(settings.playback.defaultVolume)

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const playTrack = useCallback((track: PlayerTrack) => {
    const audio = audioRef.current
    if (!audio) return
    audio.src = `ambrosia-audio://track/${track.id}`
    currentRef.current = track
    setCurrentTrack(track)
    void audio.play().catch(() => {})
  }, [])

  const toggleTrack = useCallback(
    (track: PlayerTrack) => {
      const audio = audioRef.current
      if (!audio) return

      const isCurrent = currentRef.current?.id === track.id && audio.src !== '' && !audio.error
      if (isCurrent) {
        if (audio.paused) void audio.play().catch(() => {})
        else audio.pause()
        return
      }

      playTrack(track)
    },
    [playTrack]
  )

  const togglePause = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !currentRef.current) return
    if (audio.paused) void audio.play().catch(() => {})
    else audio.pause()
  }, [])

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
