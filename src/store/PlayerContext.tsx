import { createContext, useContext, useRef, useState, type ReactNode } from 'react'

type PlayerState = {
  currentTrackId: number | null
  isPlaying: boolean
  playTrack: (trackId: number) => void
  stop: () => void
}

const PlayerContext = createContext<PlayerState | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentTrackId, setCurrentTrackId] = useState<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  function playTrack(trackId: number) {
    const audio = audioRef.current
    if (!audio) return
    audio.src = `ambrosia-audio://track/${trackId}`
    setCurrentTrackId(trackId)
    void audio.play().catch(() => {})
  }

  function stop() {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    setCurrentTrackId(null)
  }

  return (
    <PlayerContext.Provider value={{ currentTrackId, isPlaying, playTrack, stop }}>
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
