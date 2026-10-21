import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { actionFor, type ShortcutAction } from '../lib/shortcuts'
import { usePlayer } from '../store/PlayerContext'

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export function useShortcuts(): void {
  const navigate = useNavigate()
  const player = usePlayer()
  const latest = useRef({ player, navigate })

  useEffect(() => {
    latest.current = { player, navigate }
  })

  useEffect(() => {
    function run(action: ShortcutAction) {
      const { player, navigate } = latest.current
      const audio = player.audioRef.current
      switch (action.type) {
        case 'play-pause':
          player.togglePause()
          break
        case 'next':
          player.next()
          break
        case 'previous':
          player.previous()
          break
        case 'seek':
          if (audio && Number.isFinite(audio.duration)) {
            audio.currentTime = clamp(audio.currentTime + action.seconds, 0, audio.duration)
          }
          break
        case 'volume':
          player.setVolume(clamp(Math.round((player.volume + action.delta) * 100) / 100, 0, 1))
          break
        case 'shuffle':
          player.toggleShuffle()
          break
        case 'repeat':
          player.cycleRepeat()
          break
        case 'go':
          navigate(action.route)
          break
        case 'search':
          document
            .querySelector<HTMLInputElement>('input[aria-label="Search tracks by name"]')
            ?.focus()
          break
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (document.querySelector('dialog[open]')) return
      const action = actionFor(event, event.target as HTMLElement | null)
      if (!action) return

      const active = document.activeElement
      if (event.key === ' ' && active instanceof HTMLElement && active !== document.body) {
        const isButton = active.matches('button, a, summary, [role="button"]')
        if (isButton && active.matches(':focus-visible')) return
        if (isButton) active.blur()
      }

      event.preventDefault()
      run(action)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
