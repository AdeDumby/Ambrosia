import './SegmentedControl.css'

type Option<T extends string> = { value: T; label: string }

type Props<T extends string> = {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  fullWidth?: boolean
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  fullWidth = false
}: Props<T>) {
  return (
    <div className={`segmented ${fullWidth ? 'segmented-full' : ''}`} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`segmented-item ${option.value === value ? 'active' : ''}`}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}