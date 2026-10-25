import { app, BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import { UPDATE_EVENT } from '../../src/shared/update.ts'
import { createUpdateManager, type UpdaterLike } from './update-manager.ts'

// electron-updater is a CommonJS package, so it is read through its default export.
const { autoUpdater } = electronUpdater

export const updates = createUpdateManager({
  updater: autoUpdater as unknown as UpdaterLike,
  enabled: app.isPackaged,
  version: app.getVersion(),
  onChange: (state) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(UPDATE_EVENT, state)
    }
  }
})
