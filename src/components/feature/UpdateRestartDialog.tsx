import ConfirmDialog from '../item/ConfirmDialog'

type Props = {
  open: boolean
  version: string
  onConfirm: () => void
  onCancel: () => void
}

export default function UpdateRestartDialog({ open, version, onConfirm, onCancel }: Props) {
  return (
    <ConfirmDialog
      open={open}
      title="Restart to update?"
      message={`Ambrosia ${version} is ready. Ambrosia will close and open again by itself. A download in progress will stop.`}
      confirmLabel="Restart"
      cancelLabel="Later"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
