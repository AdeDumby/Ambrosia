import './TrackItem.css'

type Props = {
  filename: string
  durationSec: number
  peakDb: number | null
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function TrackItem({ filename, durationSec, peakDb }: Props) {
  return (
    <div className="track-item">
      <div className="track-name">{filename}</div>
      <div className="track-meta">
        <span>{formatDuration(durationSec)}</span>
        {peakDb !== null && <span>{peakDb} dB max</span>}
      </div>
    </div>
  )
}
