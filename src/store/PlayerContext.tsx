import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject
} from 'react'

export type PlayerTrack = { id: number; filename: string }

type PlayerState = {
  audioRef: RefObject<HTMLAudioElement | null>
  currentTrack: PlayerTrack | null
  isPlaying: boolean
  volume: number
  toggleTrack: (track: PlayerTrack) => void
  togglePause: () => void
  seek: (seconds: number) => void
  setVolume: (value: number) => void
  stop: () => void
}

const VOLUME_KEY = 'ambrosia.volume'

function loadVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY)
    const value = raw === null ? Number.NaN : Number(raw)
    return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0.5
  } catch {
    return 0.5
  }
}

const PlayerContext = createContext<PlayerState | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(loadVolume)

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
    try {
      localStorage.setItem(VOLUME_KEY, String(volume))
    } catch {
      // storage unavailable: the volume simply resets next time
    }
  }, [volume])

  function playFromStart(track: PlayerTrack) {
    const audio = audioRef.current
    if (!audio) return
    audio.src = `ambrosia-audio://track/${track.id}`
    setCurrentTrack(track)
    void audio.play().catch(() => {})
  }

  function toggleTrack(track: PlayerTrack) {
    const audio = audioRef.current
    if (!audio) return

    const isCurrent = currentTrack?.id === track.id && audio.src !== '' && !audio.error
    if (isCurrent) {
      if (audio.paused) void audio.play().catch(() => {})
      else audio.pause()
      return
    }

    playFromStart(track)
  }

  function togglePause() {
    const audio = audioRef.current
    if (!audio || !currentTrack) return
    if (audio.paused) void audio.play().catch(() => {})
    else audio.pause()
  }

  function seek(seconds: number) {
    const audio = audioRef.current
    if (audio) audio.currentTime = seconds
  }

  function stop() {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    setCurrentTrack(null)
  }

  return (
    <PlayerContext.Provider
      value={{
        audioRef,
        currentTrack,
        isPlaying,
        volume,
        toggleTrack,
        togglePause,
        seek,
        setVolume,
        stop
      }}
    >
      {children}
      <audio
        ref={audioRef}
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
