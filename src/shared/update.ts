export type UpdateState =
  | { phase: 'idle' }
  | { phase: 'unavailable' }
  | { phase: 'checking' }
  | { phase: 'up-to-date' }
  | { phase: 'downloading'; version: string; percent: number }
  | { phase: 'ready'; version: string }
  | { phase: 'error'; message: string }

export type UpdateInfo = {
  version: string
  state: UpdateState
}

export const UPDATE_EVENT = 'update-state'
