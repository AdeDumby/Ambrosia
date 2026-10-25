import { useMemo, useState } from 'react'
import MixLayerRow from '../components/feature/MixLayerRow'
import SaveMixtapeDialog from '../components/feature/SaveMixtapeDialog'
import SettingsSection from '../components/item/SettingsSection'
import SliderField from '../components/item/SliderField'
import { errorMessage } from '../lib/errors'
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
    anySolo,
    selectedId,
    loadedMixtape,
    select,
    setMaster,
    update,
    togglePlaying,
    remove,
    playAll,
    pauseAll,
    unsoloAll,
    removeSilent,
    clear,
    updateMixtape,
    saveAsMixtape
  } = useMix()
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  const names = useMemo(() => new Map(tracks.map((track) => [track.id, track.filename])), [tracks])
  const playingCount = layers.filter((layer) => layer.playing).length
  const audibleIdle = layers.filter((layer) => layer.volume > 0 && !layer.playing).length
  const silentCount = layers.filter(isSilent).length

  async function updateLoaded() {
    if (!loadedMixtape) return
    setNote(null)
    try {
      await updateMixtape()
      setNote({ ok: true, text: `Mixtape "${loadedMixtape.name}" updated.` })
    } catch (failure) {
      setNote({ ok: false, text: errorMessage(failure) })
    }
  }

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
          <button type="button" className="btn" disabled={!anySolo} onClick={unsoloAll}>
            Unsolo all
          </button>
          <button type="button" className="btn" disabled={silentCount === 0} onClick={removeSilent}>
            Remove silent
          </button>
          <button type="button" className="btn" disabled={layers.length === 0} onClick={clear}>
            Clear mix
          </button>
        </div>

        <div className="settings-actions mix-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={layers.length === 0}
            onClick={() => {
              setNote(null)
              setSaving(true)
            }}
          >
            Save as mixtape...
          </button>
          {loadedMixtape && (
            <button
              type="button"
              className="btn"
              disabled={layers.length === 0}
              title="Replace the components of this mixtape with the current layers"
              onClick={() => void updateLoaded()}
            >
              {`Update "${loadedMixtape.name}"`}
            </button>
          )}
        </div>

        {note && (
          <p className={note.ok ? 'settings-success' : 'settings-error'} role="status">
            {note.text}
          </p>
        )}
      </SettingsSection>

      <SettingsSection
        title="Layers"
        description="Tracks you play in the Library are added here, silent and paused. Raise the volume of a layer and press play to hear it on top of the player. Click a layer to edit all its settings below."
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
                selected={layer.trackId === selectedId}
                anySolo={anySolo}
                onSelect={() => select(layer.trackId)}
                onToggle={() => togglePlaying(layer.trackId)}
                onUpdate={(patch) => update(layer.trackId, patch)}
                onRemove={() => remove(layer.trackId)}
              />
            ))}
          </ul>
        )}
      </SettingsSection>

      {saving && (
        <SaveMixtapeDialog
          layerCount={layers.length}
          onSave={async (name) => {
            await saveAsMixtape(name)
            setNote({ ok: true, text: `Saved as mixtape "${name.trim()}".` })
          }}
          onClose={() => setSaving(false)}
        />
      )}
    </div>
  )
}
