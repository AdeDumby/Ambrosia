import { app, BrowserWindow, protocol, Menu } from 'electron'
import path from 'node:path'
import { removeEmptyLooseTags } from './services/tag.services.ts'
import { backupIfDue } from './services/backup.services.ts'
import { openDatabase } from './db/database.ts'
import { registerIpc } from './ipc/index.ts'
import { serveAudio } from './services/audio.services.ts'
import { getTrackPath } from './services/track.services.ts'
import { ensureLibraryFolders, getLibraryPaths } from './services/library.services.ts'
import { cancelDownload } from './services/download.service.ts'
import { setupZoom } from './services/zoom.services.ts'
import type { DatabaseSync } from 'node:sqlite'
import { purgeGoneDeletedTracks } from './services/purge.services.ts'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'ambrosia-audio',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    }
  }
])

if (process.platform === 'win32') {
  app.setAppUserModelId('com.yourcompany.yourappname')
}

function createWindow(db: DatabaseSync) {
  const win = new BrowserWindow({
    titleBarStyle: 'hidden',
    width: 1000,
    height: 700,
    icon: path.join(app.getAppPath(), 'assets', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(app.getAppPath(), 'dist-electron', 'preload.mjs')
    }
  })

  setupZoom(win, db)

  const sendWindowState = () =>
    win.webContents.send('window-state', { maximized: win.isMaximized() })
  win.on('maximize', sendWindowState)
  win.on('unmaximize', sendWindowState)

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(app.getAppPath(), 'dist/index.html'))
  }
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const key = input.key.toLowerCase()
    if (input.control && input.shift && key === 'i') {
      win.webContents.toggleDevTools()
      event.preventDefault()
    } else if ((input.control && key === 'r') || key === 'f5') {
      win.webContents.reload()
      event.preventDefault()
    }
  })
}

// app.setAppUserModelId('com.ambrosia.app')

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)
  const dbPath = path.join(app.getPath('userData'), 'ambrosia.db')
  const db = openDatabase(dbPath)
  removeEmptyLooseTags(db)
  try {
    backupIfDue(db, path.join(path.dirname(dbPath), 'backups'))
  } catch (error) {
    console.error('Startup backup failed:', error)
  }

  const documents = app.getPath('documents')
  try {
    ensureLibraryFolders(getLibraryPaths(db, documents))
  } catch (error) {
    console.error('Could not create the library folders:', error)
  }
  await purgeGoneDeletedTracks(db).catch(() => {})
  registerIpc(db, documents, dbPath)

  protocol.handle('ambrosia-audio', (request) => {
    const id = Number(new URL(request.url).pathname.slice(1))
    const filePath = Number.isInteger(id) ? getTrackPath(db, id) : null
    if (!filePath) return new Response('Not found', { status: 404 })
    return serveAudio(filePath, request.headers.get('range'))
  })

  createWindow(db)
})

app.on('before-quit', cancelDownload)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
