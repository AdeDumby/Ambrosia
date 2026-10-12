import { useEffect, useState } from 'react'
import { formatDuration } from '../../lib/formatDuration'
import { useLibrary } from '../../store/LibraryContext'
import { usePlayer } from '../../store/PlayerContext'
import './PlayerBar.css'

const REPEAT_LABEL = { off: 'Repeat: off', all: 'Repeat: all', one: 'Repeat: one track' }

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d={path} fill="currentColor" />
    </svg>
  )
}

export default function PlayerBar() {
  const {
    audioRef,
    currentTrack,
    isPlaying,
    volume,
    shuffle,
    repeat,
    togglePause,
    next,
    previous,
    toggleShuffle,
    cycleRepeat,
    seek,
    setVolume
  } = usePlayer()
  const { tracks } = useLibrary()
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const title = currentTrack
    ? (tracks.find((track) => track.id === currentTrack.id)?.filename ?? currentTrack.filename)
    : null

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
      <div className="player-controls">
        <button
          type="button"
          className={`player-button ${shuffle ? 'on' : ''}`}
          aria-label="Shuffle"
          aria-pressed={shuffle}
          title={shuffle ? 'Shuffle: on' : 'Shuffle: off'}
          onClick={toggleShuffle}
        >
          <Icon path="M10.6 9.2 4 2.6 2.6 4l6.6 6.6 1.4-1.4zM14.5 4l2.0 2H3v2h13.5l-2 2L16 11.5 21 7l-5-4.5L14.5 4zm1.5 9.6-1.4 1.4 2.4 2.4-2 2H21v-5l-2 2-3-2.8zM3 17h13.5l-2 2L16 20.5l5-4.5-5-4.5-1.5 1.5 2 2H3v2z" />
        </button>
        <button
          type="button"
          className="player-button"
          aria-label="Previous"
          title="Previous"
          disabled={!currentTrack}
          onClick={previous}
        >
          <Icon path="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
        </button>
        <button
          type="button"
          className="player-toggle"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          title={isPlaying ? 'Pause' : 'Play'}
          disabled={!currentTrack}
          onClick={togglePause}
        >
          <Icon path={isPlaying ? 'M6 5h4v14H6zM14 5h4v14h-4z' : 'M8 5v14l11-7z'} />
        </button>
        <button
          type="button"
          className="player-button"
          aria-label="Next"
          title="Next"
          disabled={!currentTrack}
          onClick={next}
        >
          <Icon path="M6 18l8.5-6L6 6zm10-12h2v12h-2z" />
        </button>
        <button
          type="button"
          className={`player-button ${repeat !== 'off' ? 'on' : ''}`}
          aria-label={REPEAT_LABEL[repeat]}
          title={REPEAT_LABEL[repeat]}
          onClick={cycleRepeat}
        >
          <Icon path="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z" />
          {repeat === 'one' && <span className="player-badge">1</span>}
        </button>
      </div>

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
