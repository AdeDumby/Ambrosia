import type { Api } from './api'

export const CHANNELS = {
  listCategories: 'categories:list',
  createCategory: 'categories:create',
  reorderCategories: 'categories:reorder',
  listTags: 'tags:list',
  createTag: 'tags:create',
  tagTrack: 'tags:tag-track',
  untagTrack: 'tags:untag-track',
  addTagToTrackByName: 'tags:add-to-track-by-name',
  setTagCategory: 'tags:set-category',
  listTracks: 'tracks:list',
  getTrack: 'tracks:get',
  setTrackKind: 'tracks:set-kind',
  setTrackReviewed: 'tracks:set-reviewed',
  deleteTrack: 'tracks:delete',
  getSettings: 'settings:get',
  saveSettings: 'settings:save',
  getLibraryPaths: 'library:get-paths'
} as const satisfies Record<keyof Api, string>
