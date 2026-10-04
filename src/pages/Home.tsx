import { useEffect, useState } from 'react'
import type { Track } from '../shared/types'
import TrackItem from '../components/item/TrackItem'
import { useFilters } from '../store/FilterContext'
import './Home.css'

export default function Home() {
  const [tracks, setTracks] = useState<Track[]>([])
  const { typeFilter, unreviewedOnly } = useFilters()

  const visibleTracks = tracks.filter(
    (track) =>
      (typeFilter === 'all' || track.kind === typeFilter) && (!unreviewedOnly || !track.reviewed)
  )
  useEffect(() => {
    window.api.listTracks().then(setTracks)
  }, [])

  return (
    <div className="track-list">
      {visibleTracks.length === 0 && <p>No tracks yet.</p>}
      {visibleTracks.map((track) => (
        <TrackItem
          key={track.id}
          filename={track.filename}
          durationSec={track.durationSec}
          peakDb={track.peakDb}
          tags={track.tags.map((tag) => ({
            id: tag.id,
            name: tag.name,
            color: tag.color ?? undefined
          }))}
        />
      ))}
    </div>
  )
}
