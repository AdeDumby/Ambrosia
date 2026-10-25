import type { EventEmitter } from 'node:events'
import type { UpdateInfo, UpdateState } from '../../src/shared/update.ts'

/** The part of electron-updater's autoUpdater that the manager uses. */
export type UpdaterLike = EventEmitter & {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  checkForUpdates(): Promise<unknown>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
}

type Options = {
  updater: UpdaterLike
  /** False when running from source: there is no installed app to update. */
  enabled: boolean
  version: string
  onChange: (state: UpdateState) => void
}

const MAX_MESSAGE = 160

export function describeUpdateError(error: unknown): string {
  const text = (error instanceof Error ? error.message : String(error)).trim()
  if (
    /ENOTFOUND|EAI_AGAIN|ECONN|ETIMEDOUT|ENETUNREACH|ERR_INTERNET|ERR_NETWORK|net::/i.test(text)
  ) {
    return 'Could not reach the update server. Check your internet connection.'
  }
  if (/404|latest\.yml|Cannot find/i.test(text)) {
    return 'No update information was found for this version.'
  }
  const firstLine = text.split('\n')[0].trim()
  if (firstLine === '') return 'Could not check for updates.'
  return firstLine.length > MAX_MESSAGE ? `${firstLine.slice(0, MAX_MESSAGE - 1)}…` : firstLine
}

export function createUpdateManager({ updater, enabled, version, onChange }: Options) {
  let state: UpdateState = enabled ? { phase: 'idle' } : { phase: 'unavailable' }

  const set = (next: UpdateState) => {
    state = next
    onChange(next)
  }

  if (enabled) {
    // The update downloads by itself once found, and is installed when the app closes
    // (or right away from the "Restart to update" button).
    updater.autoDownload = true
    updater.autoInstallOnAppQuit = true

    updater.on('checking-for-update', () => set({ phase: 'checking' }))
    updater.on('update-available', (info: { version: string }) =>
      set({ phase: 'downloading', version: info.version, percent: 0 })
    )
    updater.on('update-not-available', () => set({ phase: 'up-to-date' }))
    updater.on('download-progress', (progress: { percent: number }) => {
      if (state.phase !== 'downloading') return
      const percent = Math.min(100, Math.max(0, Math.round(progress.percent)))
      if (percent !== state.percent) set({ ...state, percent })
    })
    updater.on('update-downloaded', (info: { version: string }) =>
      set({ phase: 'ready', version: info.version })
    )
    updater.on('error', (error: unknown) =>
      set({ phase: 'error', message: describeUpdateError(error) })
    )
  }

  return {
    getInfo(): UpdateInfo {
      return { version, state }
    },

    async check(): Promise<void> {
      if (!enabled) return
      if (state.phase === 'checking' || state.phase === 'downloading' || state.phase === 'ready') {
        return
      }
      try {
        await updater.checkForUpdates()
      } catch (error) {
        set({ phase: 'error', message: describeUpdateError(error) })
      }
    },

    install(): void {
      if (state.phase !== 'ready') return
      updater.quitAndInstall(true, true)
    }
  }
}
