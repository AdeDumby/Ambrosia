import type { DatabaseSync } from 'node:sqlite'
import type { Api } from '../../src/shared/api.ts'
import { CHANNELS } from '../../src/shared/channels.ts'
import { assertId, assertName, parseAnalysisInput } from './validate.ts'
import { BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron'
import * as tags from '../services/tag.services.ts'
import * as scan from '../services/scan.services.ts'
import * as tracks from '../services/track.services.ts'
import * as scanState from '../services/scan-progress.ts'
import * as deletion from '../services/delete.services.ts'
import * as renaming from '../services/rename.services.ts'
import * as library from '../services/library.services.ts'
import * as restore from '../services/restore.services.ts'
import * as apply from '../services/apply-scan.services.ts'
import * as downloads from '../services/download.service.ts'
import * as settings from '../services/settings.services.ts'
import * as analysis from '../services/analysis.services.ts'
import * as categories from '../services/category.services.ts'
import * as backup from '../services/backup.services.ts'
import * as mixtapes from '../services/mixtape.services.ts'
import { parseMixtapeLayers } from '../../src/shared/mixtape.ts'
import { updates } from '../services/update.services.ts'
import path from 'node:path'
import { mkdirSync } from 'node:fs'
import { app } from 'electron/main'

type Handlers = {
  [K in keyof Api]: (
    ...args: Parameters<Api[K]>
  ) => ReturnType<Api[K]> | Awaited<ReturnType<Api[K]>>
}

export function registerIpc(db: DatabaseSync, documentsFolder: string, dbPath: string): void {
  const backupFolder = path.join(path.dirname(dbPath), 'backups')
  const manualFolder = app.getPath('downloads')
  let pendingFile: string | null = null

  const guard = <T>(action: () => T): T => {
    try {
      return action()
    } catch (error) {
      throw new Error(
        `The safety backup could not be made, so nothing was changed. ${error instanceof Error ? error.message : ''}`.trim()
      )
    }
  }
  const handlers: Handlers = {
    listCategories: () => categories.listCategories(db),
    createCategory: (name, color) => {
      assertName(name)
      return categories.createCategory(
        db,
        name.trim(),
        typeof color === 'string' ? color : undefined
      )
    },
    reorderCategories: (ids) => {
      if (!Array.isArray(ids) || !ids.every((id) => Number.isInteger(id))) {
        throw new Error('Invalid ids')
      }
      categories.reorderCategories(db, ids)
    },
    renameCategory: (id, name) => {
      assertId(id)
      assertName(name)
      categories.renameCategory(db, id, name)
    },
    recolorCategory: (id, color) => {
      assertId(id)
      if (typeof color !== 'string') throw new Error('Invalid color.')
      categories.recolorCategory(db, id, color)
    },

    listTags: () => tags.listTags(db),
    createTag: (name, categoryId) => {
      assertName(name)
      if (categoryId !== null) assertId(categoryId)
      return tags.createTag(db, name.trim(), categoryId)
    },
    tagTrack: (trackId, tagId) => {
      assertId(trackId)
      assertId(tagId)
      tags.tagTrack(db, trackId, tagId)
    },
    untagTrack: (trackId, tagId) => {
      assertId(trackId)
      assertId(tagId)
      return tags.untagTrack(db, trackId, tagId)
    },
    addTagToTrackByName: (trackId, name, categoryId) => {
      assertId(trackId)
      assertName(name)
      const folder = categoryId ?? null
      if (folder !== null) assertId(folder)
      return tags.addTagToTrackByName(db, trackId, name.trim(), folder)
    },
    setTagCategory: (tagId, categoryId) => {
      assertId(tagId)
      if (categoryId !== null) assertId(categoryId)
      tags.setTagCategory(db, tagId, categoryId)
    },

    listTracks: () => tracks.listTracks(db),
    getTrack: (id) => {
      assertId(id)
      return tracks.getTrack(db, id)
    },
    setTrackKind: (id, kind) => {
      assertId(id)
      if (kind !== 'music' && kind !== 'sfx') throw new Error('Invalid kind')
      tracks.setTrackKind(db, id, kind)
    },
    setTrackReviewed: (id, reviewed) => {
      assertId(id)
      tracks.setTrackReviewed(db, id, reviewed === true)
    },
    deleteTrack: (id) => {
      assertId(id)
      return deletion.deleteTrackWithFile(db, library.getLibraryPaths(db, documentsFolder), id)
    },
    emptyDeletedFolder: () => {
      guard(() => backup.backupBefore(db, backupFolder, 'before-empty-deleted'))
      return deletion.emptyDeletedFolder(db)
    },
    getSettings: () => settings.getSettings(db),
    saveSettings: (value) => {
      settings.saveSettings(db, value)
    },
    getLibraryPaths: () => library.getLibraryPaths(db, documentsFolder),
    chooseLibraryFolder: async () => {
      const current = library.getLibraryPaths(db, documentsFolder)
      const options: OpenDialogOptions = {
        title: 'Choose the library folder',
        defaultPath: current.folder,
        properties: ['openDirectory', 'createDirectory']
      }
      const parent = BrowserWindow.getFocusedWindow()
      const result = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options)
      if (result.canceled || result.filePaths.length === 0) return null
      return library.setLibraryFolder(db, result.filePaths[0])
    },
    openLibraryFolder: async () => {
      const { folder } = library.getLibraryPaths(db, documentsFolder)
      const problem = await shell.openPath(folder)
      if (problem) throw new Error(problem)
    },
    scanLibrary: () =>
      scanState.withScanRun(() =>
        scan.scanLibrary(db, library.getLibraryPaths(db, documentsFolder))
      ),
    applyScan: () =>
      scanState.withScanRun(() => {
        guard(() => backup.backupBefore(db, backupFolder, 'before-apply'))
        return apply.applyScan(db, library.getLibraryPaths(db, documentsFolder))
      }),
    getScanProgress: () => scanState.getScanProgress(),
    cancelScan: () => {
      scanState.cancelScan()
    },
    listPendingAnalysis: () => analysis.listPendingAnalysis(db),
    saveAnalysis: (id, input) => {
      assertId(id)
      analysis.saveAnalysis(db, id, parseAnalysisInput(input))
    },
    clearAnalysisErrors: () => {
      analysis.clearAnalysisErrors(db)
    },
    countDeletedTracks: () => restore.countDeletedTracks(db),
    restoreDeletedTracks: () => restore.restoreDeletedTracks(db),
    deleteCategory: (id, withTags) => {
      assertId(id)
      if (withTags === true) {
        guard(() => backup.backupBefore(db, backupFolder, 'before-folder-delete'))
      }
      categories.deleteCategory(db, id, withTags === true)
    },
    renameTrack: (id, name) => {
      assertId(id)
      if (typeof name !== 'string') throw new Error('Invalid name')
      return renaming.renameTrack(db, id, name)
    },
    renameTag: (id, name) => {
      assertId(id)
      if (typeof name !== 'string') throw new Error('Invalid name')
      return tags.renameTag(db, id, name)
    },
    mergeTags: (keepId, removeId, name) => {
      assertId(keepId)
      assertId(removeId)
      if (typeof name !== 'string') throw new Error('Invalid name')
      return tags.mergeTags(db, keepId, removeId, name, () =>
        guard(() => backup.backupBefore(db, backupFolder, 'before-tag-merge'))
      )
    },
    listMixtapes: () => mixtapes.listMixtapes(db),
    createMixtape: (name, master, layers) => {
      if (typeof name !== 'string' || typeof master !== 'number') throw new Error('Invalid input')
      return mixtapes.createMixtape(db, name, master, parseMixtapeLayers(layers))
    },
    replaceMixtape: (id, master, layers) => {
      assertId(id)
      if (typeof master !== 'number') throw new Error('Invalid input')
      mixtapes.replaceMixtape(db, id, master, parseMixtapeLayers(layers))
    },
    renameMixtape: (id, name) => {
      assertId(id)
      if (typeof name !== 'string') throw new Error('Invalid name')
      return mixtapes.renameMixtape(db, id, name)
    },
    deleteMixtape: (id) => {
      assertId(id)
      mixtapes.deleteMixtape(db, id)
    },
    tagMixtape: (id, tagId) => {
      assertId(id)
      assertId(tagId)
      tags.tagMixtape(db, id, tagId)
    },
    untagMixtape: (id, tagId) => {
      assertId(id)
      assertId(tagId)
      return tags.untagMixtape(db, id, tagId)
    },
    addTagToMixtapeByName: (id, name, categoryId) => {
      assertId(id)
      assertName(name)
      const folder = categoryId ?? null
      if (folder !== null) assertId(folder)
      return tags.addTagToMixtapeByName(db, id, name.trim(), folder)
    },
    getUpdateInfo: () => updates.getInfo(),
    checkForUpdates: () => updates.check(),
    installUpdate: () => updates.install(),
    getDownloadState: () => downloads.getDownloadState(),
    startDownload: (franchise, url) => {
      if (typeof franchise !== 'string' || typeof url !== 'string') throw new Error('Invalid input')
      return downloads.startDownload(
        library.getLibraryPaths(db, documentsFolder).folder,
        franchise,
        url
      )
    },
    cancelDownload: () => {
      downloads.cancelDownload()
    },
    resetDownload: () => {
      downloads.resetDownload()
    },
    getDownloadFolderNames: () => downloads.listFolderNames(),
    finishDownload: (entries) => {
      if (!Array.isArray(entries) || entries.length > 2000) throw new Error('Invalid names')
      const parsed = entries.map((entry) => {
        const source = typeof entry === 'object' && entry !== null ? entry : null
        if (
          !source ||
          !Number.isInteger(source.index) ||
          typeof source.name !== 'string' ||
          source.name.length > 400
        ) {
          throw new Error('Invalid names')
        }
        return { index: source.index, name: source.name }
      })
      return downloads.finishDownload(parsed)
    },
    applyDownloads: () =>
      scanState.withScanRun(() =>
        apply.applyScan(db, library.getLibraryPaths(db, documentsFolder), { dropMissing: false })
      ),
    listBackups: () => backup.listBackups(backupFolder, manualFolder),
    backupNow: () => backup.backupNow(db, backupFolder, manualFolder),
    openBackupFolder: async () => {
      mkdirSync(backupFolder, { recursive: true })
      const problem = await shell.openPath(backupFolder)
      if (problem) throw new Error(problem)
    },
    chooseBackupFile: async () => {
      const options: OpenDialogOptions = {
        title: 'Choose a backup to restore',
        defaultPath: manualFolder,
        filters: [{ name: 'Ambrosia library', extensions: ['db'] }],
        properties: ['openFile']
      }
      const parent = BrowserWindow.getFocusedWindow()
      const result = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options)
      pendingFile = null
      if (result.canceled || result.filePaths.length === 0) return null

      const file = result.filePaths[0]
      if (backup.samePath(file, dbPath)) {
        throw new Error('That is the library you are already using.')
      }
      const preview = backup.inspectDatabase(file)
      pendingFile = file
      return preview
    },
    restoreBackup: (file) => {
      if (scanState.getScanProgress().running) {
        throw new Error('A scan is running. Wait for it to finish.')
      }
      const chosen = typeof file === 'string' ? file : pendingFile
      pendingFile = null
      if (!chosen) throw new Error('Choose a backup first.')
      if (backup.samePath(chosen, dbPath)) {
        throw new Error('That is the library you are already using.')
      }
      const known = backup.listBackups(backupFolder, manualFolder)
      if (typeof file === 'string' && !known.some((entry) => backup.samePath(entry.path, chosen))) {
        throw new Error('That backup is not in the list.')
      }
      backup.inspectDatabase(chosen)
      guard(() => backup.backupBefore(db, backupFolder, 'before-restore'))
      backup.importDatabase(db, chosen)
    },
    controlWindow: (action) => {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      if (!win) return
      if (action === 'minimize') win.minimize()
      else if (action === 'maximize') {
        if (win.isMaximized()) win.unmaximize()
        else win.maximize()
      } else if (action === 'close') win.close()
      else throw new Error('Invalid action')
    },
    getWindowState: () => ({
      maximized: BrowserWindow.getAllWindows()[0]?.isMaximized() ?? false
    })
  }

  for (const name of Object.keys(CHANNELS) as (keyof Api)[]) {
    const handler = handlers[name] as unknown as (...args: unknown[]) => unknown
    ipcMain.handle(CHANNELS[name], (_event, ...args: unknown[]) => handler(...args))
  }
}
