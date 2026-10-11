import { useEffect, useRef, useState } from 'react'
import ColorField from './ColorField'
import './ColorDialog.css'

type Props = {
  open: boolean
  title: string
  initial: string
  onApply: (color: string) => void
  onCancel: () => void
}

export default function ColorDialog({ open, title, initial, onApply, onCancel }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [color, setColor] = useState(initial)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      setColor(initial)
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, initial])

  return (
    <dialog
      ref={dialogRef}
      className="color-dialog"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <h2 className="color-dialog-title">{title}</h2>
      <ColorField label="Color" value={color} onChange={setColor} />
      <div className="color-dialog-buttons">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={() => onApply(color)}>
          Apply
        </button>
      </div>
    </dialog>
  )
}
