import { useEffect, useRef } from 'react'
import './ConfirmDialog.css'

type Props = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  onConfirm,
  onCancel
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      confirmRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <h2 className="confirm-dialog-title">{title}</h2>
      <p className="confirm-dialog-message">{message}</p>
      <div className="confirm-dialog-buttons">
        <button type="button" className="btn" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button ref={confirmRef} type="button" className="btn btn-primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
