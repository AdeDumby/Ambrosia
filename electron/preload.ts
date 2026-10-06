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
