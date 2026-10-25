import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS } from '../src/shared/channels.ts'
import type { Api } from '../src/shared/api.ts'
import { UPDATE_EVENT, type UpdateState } from '../src/shared/update.ts'

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
  },
  onWindowState: (listener: (state: { maximized: boolean }) => void) => {
    const handler = (_event: unknown, state: unknown) => {
      if (typeof state === 'object' && state !== null && 'maximized' in state) {
        listener({ maximized: state.maximized === true })
      }
    }
    ipcRenderer.on('window-state', handler)
    return () => ipcRenderer.removeListener('window-state', handler)
  },
  onUpdateState: (listener: (state: UpdateState) => void) => {
    const handler = (_event: unknown, state: unknown) => {
      if (typeof state === 'object' && state !== null && 'phase' in state) {
        listener(state as UpdateState)
      }
    }
    ipcRenderer.on(UPDATE_EVENT, handler)
    return () => ipcRenderer.removeListener(UPDATE_EVENT, handler)
  }
})
