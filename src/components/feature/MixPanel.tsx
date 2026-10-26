import { useMemo, type ReactNode } from 'react'
import { formatDuration } from '../../lib/formatDuration'
import {
  DEFAULT_LAYER_SETTINGS,
  LAYER_LIMITS,
  LAYER_PRESETS,
  type LayerSettings
} from '../../shared/mixtape'
import { useLibrary } from '../../store/LibraryContext'
import { useMix } from '../../store/MixContext'
import SelectField from '../item/SelectField'
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
const hertz = (value: number) =>
  value >= 1000
    ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)} kHz`
    : `${Math.round(value)} Hz`
const lowCutLabel = (value: number) => (value === 0 ? 'Off' : hertz(value))
const highCutLabel = (value: number) => (value >= 20000 ? 'Off' : hertz(value))
const offPercent = (value: number) => (value === 0 ? 'Off' : percent(value))
const panLabel = (value: number) =>
  value === 0 ? 'Center' : `${value < 0 ? 'L' : 'R'} ${Math.round(Math.abs(value) * 100)}%`

/** The settings of the selected layer. It takes the place of the player bar on the Mix page. */
export default function MixPanel() {
  const { tracks } = useLibrary()
  const {
    layers,
    selectedId,
    copied,
    update,
    resetEffects,
    applyPreset,
    copyEffects,
    pasteEffects
  } = useMix()
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
        <SelectField
          label="Preset"
          value=""
          options={[
            { value: '', label: 'Preset...' },
            ...LAYER_PRESETS.map((preset) => ({ value: preset.name, label: preset.name }))
          ]}
          onChange={(name) => name && applyPreset(layer.trackId, name)}
        />
        <button
          type="button"
          className="btn"
          title="Copy the sound of this layer, to paste it on another one"
          onClick={() => copyEffects(layer.trackId)}
        >
          Copy
        </button>
        <button
          type="button"
          className="btn"
          disabled={!copied}
          title="Give this layer the copied sound. Volume, loop and part played stay."
          onClick={() => pasteEffects(layer.trackId)}
        >
          Paste
        </button>
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
          <Check
            label="Mono"
            checked={layer.mono}
            title="Play both sides as one, then place it with Pan"
            onChange={(mono) => set({ mono })}
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

        <Group title="Timing">
          <Seconds
            label="Start delay"
            value={layer.startDelay}
            max={limits.startDelay.max}
            hint={layer.startDelay === 0 ? 'right away' : 'wait'}
            onChange={(startDelay) => set({ startDelay })}
          />
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

        <Group title="Filter">
          <Slider
            label="Low cut"
            value={layer.lowCut}
            min={limits.lowCut.min}
            max={limits.lowCut.max}
            step={10}
            format={lowCutLabel}
            reset={defaults.lowCut}
            onChange={(lowCut) => set({ lowCut })}
          />
          <Slider
            label="High cut"
            value={layer.highCut}
            min={limits.highCut.min}
            max={limits.highCut.max}
            step={100}
            format={highCutLabel}
            reset={defaults.highCut}
            onChange={(highCut) => set({ highCut })}
          />
        </Group>

        <Group title="Echo">
          <Slider
            label="Amount"
            value={layer.echoMix}
            min={limits.echoMix.min}
            max={limits.echoMix.max}
            step={0.01}
            format={offPercent}
            reset={defaults.echoMix}
            onChange={(echoMix) => set({ echoMix })}
          />
          <Slider
            label="Time"
            value={layer.echoTime}
            min={limits.echoTime.min}
            max={limits.echoTime.max}
            step={0.05}
            format={(value) => `${value.toFixed(2)} s`}
            reset={defaults.echoTime}
            onChange={(echoTime) => set({ echoTime })}
          />
          <Slider
            label="Repeats"
            value={layer.echoFeedback}
            min={limits.echoFeedback.min}
            max={limits.echoFeedback.max}
            step={0.01}
            format={percent}
            reset={defaults.echoFeedback}
            onChange={(echoFeedback) => set({ echoFeedback })}
          />
        </Group>

        <Group title="Wobble">
          <Slider
            label="Depth"
            value={layer.tremoloDepth}
            min={limits.tremoloDepth.min}
            max={limits.tremoloDepth.max}
            step={0.01}
            format={offPercent}
            reset={defaults.tremoloDepth}
            onChange={(tremoloDepth) => set({ tremoloDepth })}
          />
          <Slider
            label="Rate"
            value={layer.tremoloRate}
            min={limits.tremoloRate.min}
            max={limits.tremoloRate.max}
            step={0.1}
            format={(value) => `${value.toFixed(1)} Hz`}
            reset={defaults.tremoloRate}
            onChange={(tremoloRate) => set({ tremoloRate })}
          />
        </Group>

        <Group title="Variation">
          <Slider
            label="Vary volume"
            value={layer.volumeJitter}
            min={limits.jitter.min}
            max={limits.jitter.max}
            step={0.01}
            format={offPercent}
            reset={defaults.volumeJitter}
            onChange={(volumeJitter) => set({ volumeJitter })}
          />
          <Slider
            label="Vary pan"
            value={layer.panJitter}
            min={limits.jitter.min}
            max={limits.jitter.max}
            step={0.01}
            format={offPercent}
            reset={defaults.panJitter}
            onChange={(panJitter) => set({ panJitter })}
          />
          <Slider
            label="Vary speed"
            value={layer.speedJitter}
            min={limits.speedJitter.min}
            max={limits.speedJitter.max}
            step={0.01}
            format={offPercent}
            reset={defaults.speedJitter}
            onChange={(speedJitter) => set({ speedJitter })}
          />
          <span className="mix-panel-note">A little different each time it plays or loops</span>
        </Group>
      </div>
    </footer>
  )
}
