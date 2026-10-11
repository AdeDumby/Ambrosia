import { useId } from 'react'
import './SliderField.css'

type Tick = { value: number; label: string }

type Props = {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  onChange: (value: number) => void
  ticks?: Tick[]
  disabled?: boolean
}

const THUMB_WIDTH = 16

export default function SliderField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  ticks,
  disabled = false
}: Props) {
  const listId = useId()

  return (
    <div className="slider-field">
      <span className="slider-field-label">{label}</span>
      <div className={`slider-field-track ${ticks ? 'has-ticks' : ''}`}>
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          list={ticks ? listId : undefined}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {ticks && (
          <>
            <datalist id={listId}>
              {ticks.map((tick) => (
                <option key={tick.value} value={tick.value} />
              ))}
            </datalist>
            <div className="slider-field-ticks">
              {ticks.map((tick) => {
                const fraction = (tick.value - min) / (max - min)
                return (
                  <button
                    key={tick.value}
                    type="button"
                    className={`slider-field-tick ${tick.value === value ? 'active' : ''}`}
                    style={{
                      left: `calc(${fraction * 100}% + ${(0.5 - fraction) * THUMB_WIDTH}px)`
                    }}
                    disabled={disabled}
                    onClick={() => onChange(tick.value)}
                  >
                    {tick.label}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
      <span className="slider-field-value">{format(value)}</span>
    </div>
  )
}
