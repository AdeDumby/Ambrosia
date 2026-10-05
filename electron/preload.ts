import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  listTags: () => ipcRenderer.invoke('tags:list'),
  createTag: (name: string, categoryId: number | null) =>
    ipcRenderer.invoke('tags:create', name, categoryId),
  listCategories: () => ipcRenderer.invoke('categories:list'),
  createCategory: (name: string, color?: string) =>
    ipcRenderer.invoke('categories:create', name, color),
  listTracks: () => ipcRenderer.invoke('tracks:list'),
  tagTrack: (trackId: number, tagId: number) =>
    ipcRenderer.invoke('tags:tag-track', trackId, tagId),
  reorderCategories: (ids: number[]) => ipcRenderer.invoke('categories:reorder', ids),
  getTrack: (id: number) => ipcRenderer.invoke('tracks:get', id),
  untagTrack: (trackId: number, tagId: number) =>
    ipcRenderer.invoke('tags:untag-track', trackId, tagId),
  addTagToTrackByName: (trackId: number, name: string) =>
    ipcRenderer.invoke('tags:add-to-track-by-name', trackId, name),
  setTrackKind: (id: number, kind: 'music' | 'sfx') =>
    ipcRenderer.invoke('tracks:set-kind', id, kind),
  deleteTrack: (id: number) => ipcRenderer.invoke('tracks:delete', id)
})
