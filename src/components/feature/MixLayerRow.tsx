import type { MixLayer } from '../../lib/mix'
import '../item/TrackActions.css'
import './MixLayerRow.css'

type Props = {
  layer: MixLayer
  name: string
  onToggle: () => void
  onVolume: (volume: number) => void
  onLoop: (loop: boolean) => void
  onRemove: () => void
}

const VOLUME_STEP = 0.01

export default function MixLayerRow({ layer, name, onToggle, onVolume, onLoop, onRemove }: Props) {
  const label = layer.playing ? 'Pause' : 'Play'
  const silent = layer.volume === 0

  return (
    <li className={`mix-layer ${layer.playing ? 'playing' : ''}`}>
      <button
        type="button"
        className={`track-action ${layer.playing ? 'active' : ''}`}
        aria-label={`${label} ${name}`}
        aria-pressed={layer.playing}
        title={label}
        onClick={onToggle}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          {layer.playing ? (
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />
          ) : (
            <path d="M8 5v14l11-7z" fill="currentColor" />
          )}
        </svg>
      </button>

      <span className="mix-layer-name" title={name}>
        {name}
      </span>

      <div className="mix-layer-volume">
        <input
          type="range"
          aria-label={`Volume of ${name}`}
          min={0}
          max={1}
          step={VOLUME_STEP}
          value={layer.volume}
          onChange={(event) => onVolume(Number(event.target.value))}
        />
        <span className={`mix-layer-percent ${silent ? 'silent' : ''}`}>
          {silent ? 'Silent' : `${Math.round(layer.volume * 100)}%`}
        </span>
      </div>

      <label className="mix-layer-loop" title="Start again when the track ends">
        <input
          type="checkbox"
          checked={layer.loop}
          onChange={(event) => onLoop(event.target.checked)}
        />
        <span>Loop</span>
      </label>

      <button
        type="button"
        className="track-action"
        aria-label={`Remove ${name} from the mix`}
        title="Remove from the mix"
        onClick={onRemove}
      >
        <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
          <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" fill="none" />
        </svg>
      </button>
    </li>
  )
}
