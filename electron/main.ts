import { app, BrowserWindow, protocol } from 'electron'
import path from 'node:path'
import { removeEmptyLooseTags } from './services/tag.services.ts'
import { openDatabase } from './db/database.ts'
import { registerIpc } from './ipc/index.ts'
import { serveAudio } from './services/audio.services.ts'
import { getTrackPath } from './services/track.services.ts'
import { ensureLibraryFolders, getLibraryPaths } from './services/library.services.ts'

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
  removeEmptyLooseTags(db)

  const documents = app.getPath('documents')
  try {
    ensureLibraryFolders(getLibraryPaths(db, documents))
  } catch (error) {
    console.error('Could not create the library folders:', error)
  }

  registerIpc(db, documents)

  protocol.handle('ambrosia-audio', (request) => {
    const id = Number(new URL(request.url).pathname.slice(1))
    const filePath = Number.isInteger(id) ? getTrackPath(db, id) : null
    if (!filePath) return new Response('Not found', { status: 404 })
    return serveAudio(filePath, request.headers.get('range'))
  })

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
