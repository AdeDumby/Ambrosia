import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  listTags: () => ipcRenderer.invoke('tags:list'),
  createTag: (name: string, categoryId: number | null) =>
    ipcRenderer.invoke('tags:create', name, categoryId),
  listCategories: () => ipcRenderer.invoke('categories:list'),
  createCategory: (name: string, color?: string) =>
    ipcRenderer.invoke('categories:create', name, color)
})
