import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  listCategories: () => ipcRenderer.invoke('categories:list')
})