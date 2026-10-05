import './TrackActions.css'

type Props = {
  isPlaying: boolean
  onPlay: () => void
}

export default function TrackActions({ isPlaying, onPlay }: Props) {
  return (
    <div className="track-actions">
      <button
        type="button"
        className={`track-action ${isPlaying ? 'active' : ''}`}
        aria-label="Play from the start"
        aria-pressed={isPlaying}
        title="Play from the start"
        onClick={onPlay}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M8 5v14l11-7z" fill="currentColor" />
        </svg>
      </button>
    </div>
  )
}
