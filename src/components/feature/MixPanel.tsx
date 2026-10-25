import { useMemo, type ReactNode } from 'react'
import { formatDuration } from '../../lib/formatDuration'
import { DEFAULT_LAYER_SETTINGS, LAYER_LIMITS, type LayerSettings } from '../../shared/mixtape'
import { useLibrary } from '../../store/LibraryContext'
import { useMix } from '../../store/MixContext'
import './MixPanel.css'

type SliderProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  /** Double-clicking the setting puts this value back. */
  reset: number
  onChange: (value: number) => void
}

function Slider({ label, value, min, max, step, format, reset, onChange }: SliderProps) {
  return (
    <label className="mix-panel-field" onDoubleClick={() => onChange(reset)}>
      <span className="mix-panel-label">{label}</span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="mix-panel-value">{format(value)}</span>
    </label>
  )
}

type SecondsProps = {
  label: string
  value: number
  max: number
  hint?: string
  onChange: (value: number) => void
}

/** A number of seconds. It is applied when the field is left or Enter is pressed. */
function Seconds({ label, value, max, hint, onChange }: SecondsProps) {
  const commit = (text: string) => {
    const parsed = Number(text.replace(',', '.'))
    if (text.trim() !== '' && Number.isFinite(parsed)) onChange(parsed)
  }
  return (
    <label className="mix-panel-field">
      <span className="mix-panel-label">{label}</span>
      <span className="mix-panel-number">
        <input
          // A new key shows the cleaned value after the setting was corrected.
          key={value}
          type="text"
          inputMode="decimal"
          aria-label={`${label} in seconds`}
          defaultValue={value}
          maxLength={7}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }}
        />
        <span className="mix-panel-unit">s</span>
      </span>
      <span className="mix-panel-value mix-panel-hint">{hint ?? `max ${max}`}</span>
    </label>
  )
}

function Check({
  label,
  checked,
  title,
  onChange
}: {
  label: string
  checked: boolean
  title?: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="mix-panel-check" title={title}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mix-panel-group">
      <h3 className="mix-panel-group-title">{title}</h3>
      {children}
    </section>
  )
}

const percent = (value: number) => `${Math.round(value * 100)}%`
const decibels = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)} dB`
const secondsLabel = (value: number) => (value === 0 ? 'Off' : `${value.toFixed(1)} s`)
const panLabel = (value: number) =>
  value === 0 ? 'Center' : `${value < 0 ? 'L' : 'R'} ${Math.round(Math.abs(value) * 100)}%`

/** The settings of the selected layer. It takes the place of the player bar on the Mix page. */
export default function MixPanel() {
  const { tracks } = useLibrary()
  const { layers, selectedId, update, resetEffects } = useMix()
  const layer = layers.find((candidate) => candidate.trackId === selectedId) ?? null
  const track = useMemo(
    () => tracks.find((candidate) => candidate.id === selectedId) ?? null,
    [tracks, selectedId]
  )

  if (!layer) {
    return (
      <footer className="mix-panel mix-panel-empty">
        <p>
          {layers.length === 0
            ? 'Add layers to the mix to edit their settings here.'
            : 'Click a layer to edit its settings here.'}
        </p>
      </footer>
    )
  }

  const set = (patch: Partial<LayerSettings>) => update(layer.trackId, patch)
  const defaults = DEFAULT_LAYER_SETTINGS
  const limits = LAYER_LIMITS
  const length = track?.durationSec ?? 0

  return (
    <footer className="mix-panel" aria-label="Layer settings">
      <header className="mix-panel-header">
        <h2 className="mix-panel-title" title={track?.filename}>
          {track?.filename ?? 'Unknown track'}
        </h2>
        {length > 0 && <span className="mix-panel-length">{formatDuration(length)}</span>}
        <span className="mix-panel-tip">Double-click a slider to reset it</span>
        <button type="button" className="btn" onClick={() => resetEffects(layer.trackId)}>
          Reset effects
        </button>
      </header>

      <div className="mix-panel-groups">
        <Group title="Sound">
          <Slider
            label="Volume"
            value={layer.volume}
            min={limits.volume.min}
            max={limits.volume.max}
            step={0.01}
            format={percent}
            reset={defaults.volume}
            onChange={(volume) => set({ volume })}
          />
          <Slider
            label="Pan"
            value={layer.pan}
            min={limits.pan.min}
            max={limits.pan.max}
            step={0.05}
            format={panLabel}
            reset={defaults.pan}
            onChange={(pan) => set({ pan })}
          />
          <Slider
            label="Speed"
            value={layer.speed}
            min={limits.speed.min}
            max={limits.speed.max}
            step={0.05}
            format={(value) => `${value.toFixed(2)}×`}
            reset={defaults.speed}
            onChange={(speed) => set({ speed })}
          />
          <Check
            label="Keep pitch"
            checked={layer.keepPitch}
            title="Keep the same pitch when the speed changes"
            onChange={(keepPitch) => set({ keepPitch })}
          />
        </Group>

        <Group title="Fades">
          <Slider
            label="Fade in"
            value={layer.fadeIn}
            min={limits.fade.min}
            max={limits.fade.max}
            step={0.5}
            format={secondsLabel}
            reset={defaults.fadeIn}
            onChange={(fadeIn) => set({ fadeIn })}
          />
          <Slider
            label="Fade out"
            value={layer.fadeOut}
            min={limits.fade.min}
            max={limits.fade.max}
            step={0.5}
            format={secondsLabel}
            reset={defaults.fadeOut}
            onChange={(fadeOut) => set({ fadeOut })}
          />
        </Group>

        <Group title="Part played">
          <Seconds
            label="Start at"
            value={layer.startAt}
            max={limits.time.max}
            hint={length > 0 ? `of ${formatDuration(length)}` : undefined}
            onChange={(startAt) => set({ startAt })}
          />
          <Seconds
            label="End at"
            value={layer.endAt}
            max={limits.time.max}
            hint={layer.endAt === 0 ? 'to the end' : undefined}
            onChange={(endAt) => set({ endAt })}
          />
          <Check
            label="Random start"
            checked={layer.randomStart}
            title="Start somewhere inside the part each time it plays"
            onChange={(randomStart) => set({ randomStart })}
          />
        </Group>

        <Group title="Loop">
          <Check
            label="Loop"
            checked={layer.loop}
            title="Start again when the part ends"
            onChange={(loop) => set({ loop })}
          />
          <Seconds
            label="Pause min"
            value={layer.gapMin}
            max={limits.gap.max}
            hint="shortest"
            onChange={(gapMin) => set({ gapMin })}
          />
          <Seconds
            label="Pause max"
            value={layer.gapMax}
            max={limits.gap.max}
            hint={layer.gapMax === 0 ? 'no pause' : 'longest'}
            onChange={(gapMax) => set({ gapMax })}
          />
        </Group>

        <Group title="Tone">
          <Slider
            label="Low"
            value={layer.eqLow}
            min={limits.eq.min}
            max={limits.eq.max}
            step={0.5}
            format={decibels}
            reset={defaults.eqLow}
            onChange={(eqLow) => set({ eqLow })}
          />
          <Slider
            label="Mid"
            value={layer.eqMid}
            min={limits.eq.min}
            max={limits.eq.max}
            step={0.5}
            format={decibels}
            reset={defaults.eqMid}
            onChange={(eqMid) => set({ eqMid })}
          />
          <Slider
            label="High"
            value={layer.eqHigh}
            min={limits.eq.min}
            max={limits.eq.max}
            step={0.5}
            format={decibels}
            reset={defaults.eqHigh}
            onChange={(eqHigh) => set({ eqHigh })}
          />
        </Group>

        <Group title="Space">
          <Slider
            label="Reverb"
            value={layer.reverb}
            min={limits.reverb.min}
            max={limits.reverb.max}
            step={0.01}
            format={percent}
            reset={defaults.reverb}
            onChange={(reverb) => set({ reverb })}
          />
        </Group>
      </div>
    </footer>
  )
}
