import { useEffect, useMemo, useState } from 'react'
import MixLayerRow from '../components/feature/MixLayerRow'
import SaveMixtapeDialog from '../components/feature/SaveMixtapeDialog'
import SelectField from '../components/item/SelectField'
import SettingsSection from '../components/item/SettingsSection'
import SliderField from '../components/item/SliderField'
import { errorMessage } from '../lib/errors'
import { isSilent } from '../lib/mix'
import { useLibrary } from '../store/LibraryContext'
import { useMix } from '../store/MixContext'
import './Mix.css'

const FADE_OPTIONS = [5, 10, 30, 60].map((seconds) => ({
  value: String(seconds),
  label: `${seconds} seconds`
}))
const SLEEP_OPTIONS = [15, 30, 45, 60, 90, 120].map((minutes) => ({
  value: String(minutes),
  label: `${minutes} minutes`
}))

/** Shows how long is left on the sleep timer. It starts when the timer does. */
function SleepCountdown({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(timer)
  }, [])
  const minutes = Math.max(1, Math.ceil((endsAt - now) / 60000))
  return <>{`Fading out and pausing in about ${minutes} min`}</>
}

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
    saveAsMixtape,
    limiter,
    fading,
    sleepEndsAt,
    setLimiter,
    fadeOutAndPause,
    startSleepTimer,
    cancelSleep
  } = useMix()
  const [fadeSeconds, setFadeSeconds] = useState('10')
  const [sleepMinutes, setSleepMinutes] = useState('30')
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

        <label className="mix-limiter">
          <input
            type="checkbox"
            checked={limiter}
            onChange={(event) => setLimiter(event.target.checked)}
          />
          <span>Limiter: stops a loud mix from clipping</span>
        </label>

        <div className="settings-actions mix-actions">
          <SelectField
            label="Fade length"
            value={fadeSeconds}
            options={FADE_OPTIONS}
            onChange={setFadeSeconds}
          />
          <button
            type="button"
            className="btn"
            disabled={playingCount === 0 || fading}
            onClick={() => fadeOutAndPause(Number(fadeSeconds))}
          >
            Fade out and pause
          </button>
        </div>

        <div className="settings-actions mix-actions">
          <SelectField
            label="Sleep timer"
            value={sleepMinutes}
            options={SLEEP_OPTIONS}
            onChange={setSleepMinutes}
          />
          {sleepEndsAt === null ? (
            <button
              type="button"
              className="btn"
              disabled={playingCount === 0}
              onClick={() => startSleepTimer(Number(sleepMinutes))}
            >
              Start sleep timer
            </button>
          ) : (
            <>
              <span className="settings-hint">
                <SleepCountdown endsAt={sleepEndsAt} />
              </span>
              <button type="button" className="btn" onClick={cancelSleep}>
                Cancel
              </button>
            </>
          )}
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
