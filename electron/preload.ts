import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS } from '../src/shared/channels.ts'
import type { Api } from '../src/shared/api.ts'

const api = Object.fromEntries(
  Object.entries(CHANNELS).map(([name, channel]) => [
    name,
    (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
  ])
) as unknown as Api

contextBridge.exposeInMainWorld('api', api)

contextBridge.exposeInMainWorld('appEvents', {
  onNavigate: (listener: (route: string) => void) => {
    const handler = (_event: unknown, route: unknown) => {
      if (typeof route === 'string') listener(route)
    }
    ipcRenderer.on('navigate', handler)
    return () => ipcRenderer.removeListener('navigate', handler)
  }
})
