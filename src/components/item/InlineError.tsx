import './InlineError.css'

type Props = {
  message: string
  onDismiss: () => void
}

export default function InlineError({ message, onDismiss }: Props) {
  return (
    <div className="inline-error" role="alert">
      <span>{message}</span>
      <button type="button" aria-label="Dismiss" onClick={onDismiss}>
        ×
      </button>
    </div>
  )
}
