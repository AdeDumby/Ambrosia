import { useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  HOLD_TICK_MS,
  actionFor,
  createChord,
  volumeStep,
  type ShortcutAction
} from '../lib/shortcuts'
import { sortTracks } from '../lib/sortTracks'
import { useFilters } from '../store/FilterContext'
import { usePlayer } from '../store/PlayerContext'
import { useShortcutsEnabled } from '../store/ShortcutsContext'
import { useVisibleTracks } from './useVisibleTracks'

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

function focusField(pathname: string): void {
  let target: HTMLInputElement | null | undefined = null
  if (pathname === '/') {
    target = document.querySelector<HTMLInputElement>('input[aria-label="Search tracks by name"]')
  } else if (pathname === '/review') {
    target = document.querySelector<HTMLInputElement>('input[aria-label="Add a tag"]')
  } else if (pathname === '/download') {
    const fields = [...document.querySelectorAll<HTMLInputElement>('.download-form input')]
    target = fields.find((field) => field.value === '') ?? fields[0]
  }
  target?.focus()
}

export function useShortcuts(): void {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const player = usePlayer()
  const { enabled, toggle } = useShortcutsEnabled()
  const { sort } = useFilters()
  const filtered = useVisibleTracks()
  const queue = useMemo(() => sortTracks(filtered, sort), [filtered, sort])
  const latest = useRef({ navigate, pathname, player, toggle, queue })

  useEffect(() => {
    latest.current = { navigate, pathname, player, toggle, queue }
  })

  useEffect(() => {
    const chord = createChord()
    let hold: { key: string; timer: number } | null = null

    const stopHold = () => {
      if (hold) window.clearInterval(hold.timer)
      hold = null
    }

    const startHold = (key: string, step: (heldMs: number) => void) => {
      stopHold()
      const startedAt = performance.now()
      step(0)
      hold = {
        key,
        timer: window.setInterval(() => step(performance.now() - startedAt), HOLD_TICK_MS)
      }
    }

    function run(action: ShortcutAction, key: string) {
      const { navigate, pathname, player, queue } = latest.current
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
          startHold(key, () => {
            const audio = latest.current.player.audioRef.current
            if (audio && Number.isFinite(audio.duration)) {
              audio.currentTime = clamp(audio.currentTime + action.seconds, 0, audio.duration)
            }
          })
          break
        case 'volume': {
          let volume = player.volume
          startHold(key, (heldMs) => {
            volume = clamp(
              Math.round((volume + action.direction * volumeStep(heldMs)) * 100) / 100,
              0,
              1
            )
            latest.current.player.setVolume(volume)
          })
          break
        }
        case 'shuffle':
          player.toggleShuffle()
          break
        case 'repeat': {
          const presses = player.repeat === 'all' ? 2 : 1
          for (let press = 0; press < presses; press += 1) player.cycleRepeat()
          break
        }
        case 'random': {
          if (queue.length === 0) break
          const playing = player.currentTrack?.id
          const pool = queue.length > 1 ? queue.filter((track) => track.id !== playing) : queue
          const pick = pool[Math.floor(Math.random() * pool.length)]
          player.playTrack(
            { id: pick.id, filename: pick.filename },
            queue.map((track) => ({ id: track.id, filename: track.filename }))
          )
          break
        }
        case 'go':
          navigate(action.route)
          break
        case 'focus':
          focusField(pathname)
          break
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      chord.down(event)
      if (!enabled || document.querySelector('dialog[open]')) return

      const action = actionFor(event, event.target as HTMLElement | null)
      if (!action) return

      if (event.key === ' ') {
        const active = document.activeElement
        if (active instanceof HTMLElement && active !== document.body) {
          const isButton = active.matches('button, a, summary, [role="button"]')
          if (isButton && active.matches(':focus-visible')) return
          if (isButton) active.blur()
        }
      }

      event.preventDefault()
      if (event.repeat) return
      run(action, event.key)
    }

    function onKeyUp(event: KeyboardEvent) {
      if (chord.up(event)) latest.current.toggle()
      if (hold && event.key === hold.key) stopHold()
    }

    function onBlur() {
      chord.reset()
      stopHold()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      stopHold()
    }
  }, [enabled])
}
