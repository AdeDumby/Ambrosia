import { app, BrowserWindow, ipcMain } from 'electron'

import { createCategory, listCategories } from './services/category.services.ts'
import { createTag, listTags } from './services/tag.services.ts'
import { openDatabase } from './db/database.ts'
import path from 'node:path'

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(app.getAppPath(), 'dist-electron', 'preload.mjs')
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(app.getAppPath(), 'dist/index.html'))
  }
}

app.whenReady().then(() => {
  const dbPath = path.join(app.getPath('userData'), 'ambrosia.db')
  const db = openDatabase(dbPath)

  ipcMain.handle('tags:list', () => listTags(db))

  ipcMain.handle('tags:create', (_event, name: unknown, categoryId: unknown) => {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error('Invalid tag name')
    }
    if (categoryId !== null && !Number.isInteger(categoryId)) {
      throw new Error('Invalid category id')
    }
    return createTag(db, name.trim(), categoryId as number | null)
  })

  ipcMain.handle('categories:list', () => listCategories(db))

  ipcMain.handle('categories:create', (_event, name: unknown, color: unknown) => {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error('Invalid category name')
    }
    return createCategory(db, name.trim(), typeof color === 'string' ? color : undefined)
  })

  createWindow()
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
