import { useEffect, useRef } from 'react'
import { useLibrary } from '../store/LibraryContext'
import { usePlayer } from '../store/PlayerContext'

const DEFAULT_SEEK = 10

export function useMediaSession(): void {
  const player = usePlayer()
  const { tracks } = useLibrary()
  const latest = useRef(player)

  useEffect(() => {
    latest.current = player
  })

  const hasTrack = player.currentTrack !== null
  const id = player.currentTrack?.id
  const title = player.currentTrack
    ? (tracks.find((track) => track.id === id)?.filename ?? player.currentTrack.filename)
    : null

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = title
      ? new MediaMetadata({ title: title.replace(/\.[^.]+$/, ''), artist: 'Ambrosia' })
      : null
  }, [title])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = !hasTrack
      ? 'none'
      : player.isPlaying
        ? 'playing'
        : 'paused'
  }, [hasTrack, player.isPlaying])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const session = navigator.mediaSession

    const seek = (offset: number) => {
      const audio = latest.current.audioRef.current
      if (audio && Number.isFinite(audio.duration)) {
        audio.currentTime = Math.min(Math.max(audio.currentTime + offset, 0), audio.duration)
      }
    }

    const handlers: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
      play: () => {
        if (latest.current.audioRef.current?.paused) latest.current.togglePause()
      },
      pause: () => {
        if (!latest.current.audioRef.current?.paused) latest.current.togglePause()
      },
      previoustrack: () => latest.current.previous(),
      nexttrack: () => latest.current.next(),
      seekbackward: (details) => seek(-(details.seekOffset ?? DEFAULT_SEEK)),
      seekforward: (details) => seek(details.seekOffset ?? DEFAULT_SEEK)
    }

    for (const [action, handler] of Object.entries(handlers)) {
      try {
        session.setActionHandler(action as MediaSessionAction, handler)
      } catch {
        // this action is not supported here
      }
    }
    return () => {
      for (const action of Object.keys(handlers)) {
        try {
          session.setActionHandler(action as MediaSessionAction, null)
        } catch {
          // nothing to clean up
        }
      }
    }
  }, [])
}
