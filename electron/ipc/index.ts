import { ipcMain } from 'electron'
import type { DatabaseSync } from 'node:sqlite'
import type { Api } from '../../src/shared/api.ts'
import { CHANNELS } from '../../src/shared/channels.ts'
import * as categories from '../services/category.services.ts'
import * as tags from '../services/tag.services.ts'
import * as tracks from '../services/track.services.ts'
import * as settings from '../services/settings.services.ts'
import { assertId, assertName } from './validate.ts'
import type { LibraryPaths } from '../../src/shared/types.ts'

type Handlers = {
  [K in keyof Api]: (
    ...args: Parameters<Api[K]>
  ) => ReturnType<Api[K]> | Awaited<ReturnType<Api[K]>>
}

export function registerIpc(db: DatabaseSync, library: LibraryPaths): void {
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
      tracks.deleteTrack(db, id)
    },
    getSettings: () => settings.getSettings(db),
    saveSettings: (value) => {
      settings.saveSettings(db, value)
    },
    getLibraryPaths: () => library
  }

  for (const name of Object.keys(CHANNELS) as (keyof Api)[]) {
    const handler = handlers[name] as unknown as (...args: unknown[]) => unknown
    ipcMain.handle(CHANNELS[name], (_event, ...args: unknown[]) => handler(...args))
  }
}
