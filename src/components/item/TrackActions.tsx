import type { TrackKind } from '../../shared/types'
import './TrackActions.css'

type Props = {
  isPlaying: boolean
  onPlay: () => void
  kind?: TrackKind
  onSetKind?: (kind: TrackKind) => void
  onFinish?: () => void
  onDelete?: () => void
}

export default function TrackActions({
  isPlaying,
  onPlay,
  kind,
  onSetKind,
  onFinish,
  onDelete
}: Props) {
  const target: TrackKind = kind === 'music' ? 'sfx' : 'music'
  const kindLabel = target === 'sfx' ? 'Set as SFX' : 'Set as Music'
  const playLabel = isPlaying ? 'Pause' : 'Play'

  return (
    <div className="track-actions">
      <button
        type="button"
        className={`track-action ${isPlaying ? 'active' : ''}`}
        aria-label={playLabel}
        aria-pressed={isPlaying}
        title={playLabel}
        onClick={onPlay}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          {isPlaying ? (
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />
          ) : (
            <path d="M8 5v14l11-7z" fill="currentColor" />
          )}
        </svg>
      </button>

      {onFinish && (
        <button type="button" className="btn btn-primary track-finish" onClick={onFinish}>
          Finish
        </button>
      )}

      {kind && onSetKind && (
        <button
          type="button"
          className="track-action track-action-text"
          aria-label={kindLabel}
          title={kindLabel}
          onClick={() => onSetKind(target)}
        >
          {kind === 'music' ? '♪' : 'FX'}
        </button>
      )}

      {onDelete && (
        <button
          type="button"
          className="track-action track-action-danger"
          aria-label="Delete track"
          title="Delete track"
          onClick={onDelete}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
              fill="currentColor"
            />
          </svg>
        </button>
      )}
    </div>
  )
}
