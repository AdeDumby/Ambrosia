import { app, BrowserWindow, ipcMain, net, protocol } from 'electron'

import { createCategory, reorderCategories, listCategories } from './services/category.services.ts'
import {
  addTagToTrackByName,
  createTag,
  listTags,
  setTagCategory,
  tagTrack,
  untagTrack
} from './services/tag.services.ts'
import {
  getTrack,
  getTrackPath,
  listTracks,
  setTrackKind,
  deleteTrack,
  setTrackReviewed
} from './services/track.services.ts'
import { serveAudio } from './services/audio.services.ts'
import { openDatabase } from './db/database.ts'
import path from 'node:path'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'ambrosia-audio',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    icon: path.join(app.getAppPath(), 'assets', 'icon.ico'),
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

  protocol.handle('ambrosia-audio', (request) => {
    const id = Number(new URL(request.url).pathname.slice(1))
    const filePath = Number.isInteger(id) ? getTrackPath(db, id) : null
    if (!filePath) return new Response('Not found', { status: 404 })
    return serveAudio(filePath, request.headers.get('range'))
  })

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

  ipcMain.handle('categories:reorder', (_event, ids: unknown) => {
    if (!Array.isArray(ids) || !ids.every((id) => Number.isInteger(id))) {
      throw new Error('Invalid ids')
    }
    reorderCategories(db, ids as number[])
  })

  ipcMain.handle('tracks:list', () => listTracks(db))
  ipcMain.handle('tags:tag-track', (_event, trackId: unknown, tagId: unknown) => {
    if (!Number.isInteger(trackId) || !Number.isInteger(tagId)) {
      throw new Error('Invalid id')
    }
    tagTrack(db, trackId as number, tagId as number)
  })

  ipcMain.handle('tracks:get', (_event, id: unknown) => {
    if (!Number.isInteger(id)) throw new Error('Invalid id')
    return getTrack(db, id as number)
  })

  ipcMain.handle('tracks:delete', (_event, id: unknown) => {
    if (!Number.isInteger(id)) throw new Error('Invalid id')
    deleteTrack(db, id as number)
  })

  ipcMain.handle('tags:untag-track', (_event, trackId: unknown, tagId: unknown) => {
    if (!Number.isInteger(trackId) || !Number.isInteger(tagId)) {
      throw new Error('Invalid id')
    }
    return untagTrack(db, trackId as number, tagId as number)
  })

  ipcMain.handle('tags:add-to-track-by-name', (_event, trackId: unknown, name: unknown) => {
    if (!Number.isInteger(trackId)) throw new Error('Invalid id')
    if (typeof name !== 'string' || name.trim() === '') throw new Error('Invalid tag name')
    return addTagToTrackByName(db, trackId as number, name.trim())
  })

  ipcMain.handle('tracks:set-kind', (_event, id: unknown, kind: unknown) => {
    if (!Number.isInteger(id)) throw new Error('Invalid id')
    if (kind !== 'music' && kind !== 'sfx') throw new Error('Invalid kind')
    setTrackKind(db, id as number, kind)
  })

  ipcMain.handle('tags:set-category', (_event, tagId: unknown, categoryId: unknown) => {
    if (!Number.isInteger(tagId)) throw new Error('Invalid tag id')
    if (categoryId !== null && !Number.isInteger(categoryId)) {
      throw new Error('Invalid category id')
    }
    setTagCategory(db, tagId as number, categoryId as number | null)
  })

  ipcMain.handle('tracks:set-reviewed', (_event, id: unknown, reviewed: unknown) => {
    if (!Number.isInteger(id)) throw new Error('Invalid id')
    setTrackReviewed(db, id as number, reviewed === true)
  })

  createWindow()
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
