import { useEffect, useState } from 'react'
import type { Track } from '../shared/types'
import TrackItem from '../components/item/TrackItem'
import './Home.css'

export default function Home() {
  const [tracks, setTracks] = useState<Track[]>([])

  useEffect(() => {
    window.api.listTracks().then(setTracks)
  }, [])

  return (
    <div className="track-list">
      {tracks.length === 0 && <p>No tracks yet.</p>}
      {tracks.map((track) => (
        <TrackItem
          key={track.id}
          filename={track.filename}
          durationSec={track.durationSec}
          peakDb={track.peakDb}
        />
      ))}
    </div>
  )
}
