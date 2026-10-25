import { useCallback, useEffect, useRef, useState } from 'react'
import type { UpdateInfo } from '../shared/update'

const INITIAL: UpdateInfo = { version: '', state: { phase: 'idle' } }

export function useUpdates() {
  const [info, setInfo] = useState<UpdateInfo>(INITIAL)
  const gotEvent = useRef(false)

  useEffect(() => {
    let active = true
    window.api
      .getUpdateInfo()
      .then((loaded) => {
        // A newer state may already have arrived as an event while this was loading.
        if (active)
          setInfo((previous) => (gotEvent.current ? { ...loaded, state: previous.state } : loaded))
      })
      .catch(() => {})
    const stop = window.appEvents.onUpdateState((state) => {
      gotEvent.current = true
      setInfo((previous) => ({ ...previous, state }))
    })
    return () => {
      active = false
      stop()
    }
  }, [])

  const check = useCallback(() => window.api.checkForUpdates().catch(() => {}), [])
  const install = useCallback(() => window.api.installUpdate().catch(() => {}), [])

  return { version: info.version, state: info.state, check, install }
}
