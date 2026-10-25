import type { Api } from './shared/api'
import type { UpdateState } from './shared/update'

declare global {
  interface Window {
    api: Api
    appEvents: {
      onNavigate: (listener: (route: string) => void) => () => void
      onWindowState: (listener: (state: { maximized: boolean }) => void) => () => void
      onUpdateState: (listener: (state: UpdateState) => void) => () => void
    }
  }
}
