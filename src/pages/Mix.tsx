import { useMemo } from 'react'
import MixLayerRow from '../components/feature/MixLayerRow'
import SettingsSection from '../components/item/SettingsSection'
import SliderField from '../components/item/SliderField'
import { isSilent } from '../lib/mix'
import { useLibrary } from '../store/LibraryContext'
import { useMix } from '../store/MixContext'
import './Mix.css'

const percent = (value: number) => `${Math.round(value * 100)}%`

export default function Mix() {
  const { tracks } = useLibrary()
  const {
    layers,
    master,
    setMaster,
    setVolume,
    setLoop,
    togglePlaying,
    remove,
    playAll,
    pauseAll,
    removeSilent,
    clear
  } = useMix()

  const names = useMemo(() => new Map(tracks.map((track) => [track.id, track.filename])), [tracks])
  const playingCount = layers.filter((layer) => layer.playing).length
  const audibleIdle = layers.filter((layer) => layer.volume > 0 && !layer.playing).length
  const silentCount = layers.filter(isSilent).length

  return (
    <div className="settings mix">
      <SettingsSection title="Mixing">
        <SliderField
          label="Master volume"
          value={master}
          min={0}
          max={1}
          step={0.01}
          format={percent}
          onChange={setMaster}
        />

        <div className="settings-actions mix-actions">
          <button type="button" className="btn" disabled={audibleIdle === 0} onClick={playAll}>
            Play all
          </button>
          <button type="button" className="btn" disabled={playingCount === 0} onClick={pauseAll}>
            Pause all
          </button>
          <button type="button" className="btn" disabled={silentCount === 0} onClick={removeSilent}>
            Remove silent
          </button>
          <button type="button" className="btn" disabled={layers.length === 0} onClick={clear}>
            Clear mix
          </button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Layers"
        description="Tracks you play in the Library are added here, silent and paused. Raise the volume of a layer and press play to hear it on top of the player."
      >
        {layers.length === 0 ? (
          <p className="settings-hint">Nothing here yet. Play a track in the Library to add it.</p>
        ) : (
          <ul className="mix-layers">
            {layers.map((layer) => (
              <MixLayerRow
                key={layer.trackId}
                layer={layer}
                name={names.get(layer.trackId) ?? 'Unknown track'}
                onToggle={() => togglePlaying(layer.trackId)}
                onVolume={(volume) => setVolume(layer.trackId, volume)}
                onLoop={(loop) => setLoop(layer.trackId, loop)}
                onRemove={() => remove(layer.trackId)}
              />
            ))}
          </ul>
        )}
      </SettingsSection>
    </div>
  )
}
