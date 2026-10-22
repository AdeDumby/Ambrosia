import type { Api } from './shared/api'

declare global {
  interface Window {
    api: Api
    appEvents: {
      onNavigate: (listener: (route: string) => void) => () => void
      onWindowState: (listener: (state: { maximized: boolean }) => void) => () => void
    }
  }
}
