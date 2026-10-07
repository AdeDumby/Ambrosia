import type { DeleteMode } from '../shared/settings'

export function deleteDialogText(mode: DeleteMode, filename: string) {
  if (mode === 'permanent') {
    return {
      title: 'Permanently delete this track?',
      message: `${filename} will be erased from the disk. This cannot be undone.`,
      confirmLabel: 'Delete forever'
    }
  }
  return {
    title: 'Delete this track?',
    message: `${filename} will be moved to the _Deleted folder and hidden from the library.`,
    confirmLabel: 'Yes'
  }
}
