import './CheckboxField.css'

type Props = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  color?: string
}

export default function CheckboxField({ label, checked, onChange, color }: Props) {
  return (
    <label className="checkbox-field">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {color && <span className="checkbox-field-dot" style={{ backgroundColor: color }} />}
      <span>{label}</span>
    </label>
  )
}
