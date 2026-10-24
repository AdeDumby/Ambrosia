import type { DeleteMode } from '../shared/settings'

export function deleteDialogText(filename: string) {
  return {
    title: 'Delete this track?',
    message: `${filename} will be moved to the _Deleted folder.`,
    confirmLabel: 'Yes'
  }
}
