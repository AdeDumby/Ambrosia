import './SliderField.css'

type Props = {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (value: number) => string
  onChange: (value: number) => void
}

export default function SliderField({ label, value, min, max, step, format, onChange }: Props) {
  return (
    <label className="slider-field">
      <span className="slider-field-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="slider-field-value">{format(value)}</span>
    </label>
  )
}
