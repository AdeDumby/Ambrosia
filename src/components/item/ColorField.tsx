import './ColorField.css'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
}

export default function ColorField({ label, value, onChange }: Props) {
  return (
    <label className="color-field">
      <span className="color-field-label">{label}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
      <span className="color-field-value">{value}</span>
    </label>
  )
}
