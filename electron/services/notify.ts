import { BrowserWindow, Notification } from 'electron'

export const DOWNLOAD_ROUTE = '/download'

function mainWindow(): BrowserWindow | undefined {
  return BrowserWindow.getAllWindows()[0]
}

export function showWindow(): void {
  const window = mainWindow()
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

export function notifyDownloadFinished(count: number, franchise: string): void {
  const window = mainWindow()
  window?.webContents.send('navigate', DOWNLOAD_ROUTE)

  if (window?.isFocused() || !Notification.isSupported()) return

  const notification = new Notification({
    title: 'Downloads finished',
    body: `${count} track${count === 1 ? '' : 's'} downloaded to ${franchise}. Choose how they are renamed.`
  })
  notification.on('click', () => {
    showWindow()
    mainWindow()?.webContents.send('navigate', DOWNLOAD_ROUTE)
  })
  notification.show()
}
