import { useEffect, useState } from 'react'
import { formatDuration } from '../../lib/formatDuration'
import { usePlayer } from '../../store/PlayerContext'
import { useLibrary } from '../../store/LibraryContext'
import './PlayerBar.css'

export default function PlayerBar() {
  const { audioRef, currentTrack, isPlaying, volume, togglePause, seek, setVolume } = usePlayer()
  const { tracks } = useLibrary()
  const title = currentTrack
    ? (tracks.find((track) => track.id === currentTrack.id)?.filename ?? currentTrack.filename)
    : null
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    function sync() {
      if (!audio) return
      setTime(audio.currentTime)
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    }

    const events = ['timeupdate', 'durationchange', 'loadedmetadata', 'emptied'] as const
    for (const name of events) audio.addEventListener(name, sync)
    sync()
    return () => {
      for (const name of events) audio.removeEventListener(name, sync)
    }
  }, [audioRef])

  return (
    <div className="player-bar">
      <button
        type="button"
        className="player-toggle"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        title={isPlaying ? 'Pause' : 'Play'}
        disabled={!currentTrack}
        onClick={togglePause}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          {isPlaying ? (
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />
          ) : (
            <path d="M8 5v14l11-7z" fill="currentColor" />
          )}
        </svg>
      </button>

      <div className="player-title" title={title ?? undefined}>
        {title ?? 'Nothing playing'}
      </div>

      <div className="player-seek">
        <span>{formatDuration(time)}</span>
        <input
          type="range"
          aria-label="Seek"
          min={0}
          max={duration || 1}
          step={0.1}
          value={Math.min(time, duration || 1)}
          disabled={!currentTrack || duration === 0}
          onChange={(event) => seek(Number(event.target.value))}
        />
        <span>{formatDuration(duration)}</span>
      </div>

      <label className="player-volume">
        <span>Vol</span>
        <input
          type="range"
          aria-label="Volume"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => setVolume(Number(event.target.value))}
        />
      </label>
    </div>
  )
}
