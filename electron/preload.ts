import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  listCategories: () => ipcRenderer.invoke('categories:list'),
  createCategory: (name: string, color?: string) =>
    ipcRenderer.invoke('categories:create', name, color)
})