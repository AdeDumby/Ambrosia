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
export type RepeatMode = 'off' | 'all' | 'one'

type PlayerState = {
  audioRef: RefObject<HTMLAudioElement | null>
  currentTrack: PlayerTrack | null
  isPlaying: boolean
  volume: number
  shuffle: boolean
  repeat: RepeatMode
  playTrack: (track: PlayerTrack, queue?: PlayerTrack[]) => void
  toggleTrack: (track: PlayerTrack, queue?: PlayerTrack[]) => void
  togglePause: () => void
  next: () => void
  previous: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  seek: (seconds: number) => void
  setVolume: (value: number) => void
  stop: () => void
  stopTrack: (trackId: number) => void
}

type Graph = { context: AudioContext; gain: GainNode }

const PlayerContext = createContext<PlayerState | null>(null)
const RESTART_AFTER_SECONDS = 3
const REPEAT_ORDER: RepeatMode[] = ['off', 'all', 'one']

function shuffled(ids: number[]): number[] {
  const result = [...ids]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[other]] = [result[other], result[index]]
  }
  return result
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const { tracks } = useLibrary()
  const audioRef = useRef<HTMLAudioElement>(null)
  const graphRef = useRef<Graph | null>(null)
  const currentRef = useRef<PlayerTrack | null>(null)
  const queueRef = useRef<PlayerTrack[]>([])
  const shuffleOrderRef = useRef<number[]>([])
  const shuffleRef = useRef(false)
  const repeatRef = useRef<RepeatMode>('off')
  const tracksRef = useRef(tracks)
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(settings.playback.defaultVolume)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const { normalize, targetLufs } = settings.playback

  useEffect(() => {
    tracksRef.current = tracks
  }, [tracks])

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

  const loadTrack = useCallback(
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

  const playTrack = useCallback(
    (track: PlayerTrack, queue?: PlayerTrack[]) => {
      if (queue) {
        queueRef.current = queue
        shuffleOrderRef.current = shuffleRef.current
          ? [track.id, ...shuffled(queue.map((item) => item.id).filter((id) => id !== track.id))]
          : []
      }
      loadTrack(track)
    },
    [loadTrack]
  )

  const sequence = useCallback((): PlayerTrack[] => {
    const alive = new Set(tracksRef.current.map((track) => track.id))
    const byId = new Map(queueRef.current.map((track) => [track.id, track]))
    const ordered = shuffleRef.current
      ? shuffleOrderRef.current.flatMap((id) => byId.get(id) ?? [])
      : queueRef.current
    return ordered.filter((track) => alive.has(track.id))
  }, [])

  const step = useCallback(
    (direction: 1 | -1, auto: boolean) => {
      const audio = audioRef.current
      if (!audio) return

      if (auto && repeatRef.current === 'one') {
        audio.currentTime = 0
        resumePlayback()
        return
      }

      const order = sequence()
      const index = order.findIndex((track) => track.id === currentRef.current?.id)
      if (index === -1 || order.length === 0) return

      if (direction === -1 && audio.currentTime > RESTART_AFTER_SECONDS) {
        audio.currentTime = 0
        return
      }

      const target = index + direction
      if (target >= 0 && target < order.length) {
        loadTrack(order[target])
      } else if (repeatRef.current === 'all') {
        if (direction === 1 && shuffleRef.current) {
          const ids = queueRef.current.map((track) => track.id)
          const first = shuffled(ids)
          shuffleOrderRef.current = first
        }
        const wrapped = sequence()
        loadTrack(direction === 1 ? wrapped[0] : wrapped[wrapped.length - 1])
      } else if (direction === -1) {
        audio.currentTime = 0
      } else if (auto) {
        setIsPlaying(false)
      } else {
        audio.pause()
        audio.currentTime = 0
      }
    },
    [loadTrack, resumePlayback, sequence]
  )

  const next = useCallback(() => step(1, false), [step])
  const previous = useCallback(() => step(-1, false), [step])

  const toggleShuffle = useCallback(() => {
    const turnOn = !shuffleRef.current
    shuffleRef.current = turnOn
    setShuffle(turnOn)
    const current = currentRef.current
    shuffleOrderRef.current =
      turnOn && current
        ? [
            current.id,
            ...shuffled(queueRef.current.map((track) => track.id).filter((id) => id !== current.id))
          ]
        : []
  }, [])

  const cycleRepeat = useCallback(() => {
    const following =
      REPEAT_ORDER[(REPEAT_ORDER.indexOf(repeatRef.current) + 1) % REPEAT_ORDER.length]
    repeatRef.current = following
    setRepeat(following)
  }, [])

  const toggleTrack = useCallback(
    (track: PlayerTrack, queue?: PlayerTrack[]) => {
      const audio = audioRef.current
      if (!audio) return

      const isCurrent = currentRef.current?.id === track.id && audio.src !== '' && !audio.error
      if (isCurrent) {
        if (audio.paused) resumePlayback()
        else audio.pause()
        return
      }

      playTrack(track, queue)
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
      shuffle,
      repeat,
      playTrack,
      toggleTrack,
      togglePause,
      next,
      previous,
      toggleShuffle,
      cycleRepeat,
      seek,
      setVolume,
      stop,
      stopTrack
    }),
    [
      currentTrack,
      isPlaying,
      volume,
      shuffle,
      repeat,
      playTrack,
      toggleTrack,
      togglePause,
      next,
      previous,
      toggleShuffle,
      cycleRepeat,
      seek,
      stop,
      stopTrack
    ]
  )

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => step(1, true)}
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
