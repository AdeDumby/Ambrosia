import type { DatabaseSync } from 'node:sqlite'
import type { Api } from '../../src/shared/api.ts'
import { CHANNELS } from '../../src/shared/channels.ts'
import { assertId, assertName, parseAnalysisInput } from './validate.ts'
import { BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron'
import * as tags from '../services/tag.services.ts'
import * as scan from '../services/scan.services.ts'
import * as purge from '../services/purge.services.ts'
import * as tracks from '../services/track.services.ts'
import * as deletion from '../services/delete.services.ts'
import * as library from '../services/library.services.ts'
import * as restore from '../services/restore.services.ts'
import * as apply from '../services/apply-scan.services.ts'
import * as settings from '../services/settings.services.ts'
import * as analysis from '../services/analysis.services.ts'
import * as categories from '../services/category.services.ts'

type Handlers = {
  [K in keyof Api]: (
    ...args: Parameters<Api[K]>
  ) => ReturnType<Api[K]> | Awaited<ReturnType<Api[K]>>
}

export function registerIpc(db: DatabaseSync, documentsFolder: string): void {
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
      return deletion.deleteTrackWithFile(
        db,
        library.getLibraryPaths(db, documentsFolder),
        settings.getSettings(db).library.deleteMode,
        id
      )
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
    scanLibrary: () => scan.scanLibrary(db, library.getLibraryPaths(db, documentsFolder)),
    applyScan: () => apply.applyScan(db, library.getLibraryPaths(db, documentsFolder)),
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
    purgeGoneDeletedTracks: () => purge.purgeGoneDeletedTracks(db)
  }

  for (const name of Object.keys(CHANNELS) as (keyof Api)[]) {
    const handler = handlers[name] as unknown as (...args: unknown[]) => unknown
    ipcMain.handle(CHANNELS[name], (_event, ...args: unknown[]) => handler(...args))
  }
}
