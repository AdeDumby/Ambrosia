import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import type { UpdateState } from '../../src/shared/update.ts'
import { createUpdateManager, describeUpdateError, type UpdaterLike } from './update-manager.ts'

function setup(enabled = true) {
  const emitter = new EventEmitter()
  const updater = Object.assign(emitter, {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    checkForUpdates: vi.fn(async () => {}),
    quitAndInstall: vi.fn()
  }) as unknown as UpdaterLike & {
    checkForUpdates: ReturnType<typeof vi.fn>
    quitAndInstall: ReturnType<typeof vi.fn>
  }
  const states: UpdateState[] = []
  const manager = createUpdateManager({
    updater,
    enabled,
    version: '1.1.0',
    onChange: (state) => states.push(state)
  })
  return { updater, manager, states }
}

describe('update manager', () => {
  it('is unavailable and does nothing when running from source', async () => {
    const { manager, updater } = setup(false)
    await manager.check()
    manager.install()
    expect(manager.getInfo()).toEqual({ version: '1.1.0', state: { phase: 'unavailable' } })
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
  })

  it('downloads automatically and installs on quit', () => {
    const { updater } = setup()
    expect(updater.autoDownload).toBe(true)
    expect(updater.autoInstallOnAppQuit).toBe(true)
  })

  it('goes from checking to up to date', async () => {
    const { manager, updater, states } = setup()
    updater.checkForUpdates.mockImplementation(async () => {
      updater.emit('checking-for-update')
      updater.emit('update-not-available', { version: '1.1.0' })
    })
    await manager.check()
    expect(states).toEqual([{ phase: 'checking' }, { phase: 'up-to-date' }])
  })

  it('follows a download until the update is ready, then installs silently', () => {
    const { manager, updater, states } = setup()
    updater.emit('checking-for-update')
    updater.emit('update-available', { version: '1.2.0' })
    updater.emit('download-progress', { percent: 41.6 })
    updater.emit('download-progress', { percent: 41.9 })
    updater.emit('download-progress', { percent: 120 })
    updater.emit('update-downloaded', { version: '1.2.0' })

    expect(states).toEqual([
      { phase: 'checking' },
      { phase: 'downloading', version: '1.2.0', percent: 0 },
      { phase: 'downloading', version: '1.2.0', percent: 42 },
      { phase: 'downloading', version: '1.2.0', percent: 100 },
      { phase: 'ready', version: '1.2.0' }
    ])

    manager.install()
    expect(updater.quitAndInstall).toHaveBeenCalledWith(true, true)
  })

  it('does not install before an update is ready', () => {
    const { manager, updater } = setup()
    updater.emit('update-available', { version: '1.2.0' })
    manager.install()
    expect(updater.quitAndInstall).not.toHaveBeenCalled()
  })

  it('ignores progress that arrives outside a download', () => {
    const { updater, states } = setup()
    updater.emit('download-progress', { percent: 50 })
    expect(states).toEqual([])
  })

  it('does not start a second check while one is running or an update is waiting', async () => {
    const { manager, updater } = setup()
    updater.emit('checking-for-update')
    await manager.check()
    updater.emit('update-downloaded', { version: '1.2.0' })
    await manager.check()
    expect(updater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('can check again after an error or an up-to-date result', async () => {
    const { manager, updater } = setup()
    updater.emit('error', new Error('boom'))
    await manager.check()
    updater.emit('update-not-available', {})
    await manager.check()
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2)
  })

  it('reports a failed check as an error state', async () => {
    const { manager, updater } = setup()
    updater.checkForUpdates.mockRejectedValue(new Error('getaddrinfo ENOTFOUND github.com'))
    await manager.check()
    expect(manager.getInfo().state).toEqual({
      phase: 'error',
      message: 'Could not reach the update server. Check your internet connection.'
    })
  })
})

describe('describeUpdateError', () => {
  it('explains network problems and missing release files in plain words', () => {
    expect(describeUpdateError(new Error('net::ERR_INTERNET_DISCONNECTED'))).toMatch(/internet/)
    expect(describeUpdateError(new Error('Cannot find latest.yml in the latest release'))).toMatch(
      /No update information/
    )
  })

  it('keeps only the first line and limits the length', () => {
    expect(describeUpdateError(new Error('first\nsecond'))).toBe('first')
    expect(describeUpdateError(new Error('x'.repeat(500))).length).toBeLessThanOrEqual(160)
    expect(describeUpdateError(new Error('   '))).toBe('Could not check for updates.')
  })
})
