import { describe, expect, it } from 'vitest'
import {
  compareWithPlaylist,
  formatDuration,
  foldTitle,
  isUnavailableTitle,
  type FolderFile,
  type PlaylistEntry
} from './missing.ts'

const entry = (index: number, title: string, durationSec: number | null, id = `id${index}`) =>
  ({ index, id, title, durationSec }) satisfies PlaylistEntry
const file = (name: string, durationSec: number | null, videoId: string | null = null) =>
  ({ name, durationSec, videoId }) satisfies FolderFile

describe('compareWithPlaylist', () => {
  it('finds a track by the video ID, whatever the file is called', () => {
    const report = compareWithPlaylist(
      [entry(1, 'Song A', 100), entry(2, 'Song B', 200)],
      [file('renamed.mp3', 100, 'id1'), file('Song B.mp3', 200)]
    )
    expect(report.matched).toEqual({ id: 1, title: 1, length: 0 })
    expect(report.missing).toEqual([])
    expect(report.extraFiles).toEqual([])
  })

  it('finds a track by its title, ignoring case, accents and symbols', () => {
    const report = compareWithPlaylist(
      [entry(1, 'Café del Mar - "Live" ★', 300)],
      [file('cafe del mar  live .mp3', 301)]
    )
    expect(report.matched.title).toBe(1)
    expect(report.missing).toEqual([])
  })

  it('cuts the title like the file name is cut', () => {
    const long = 'x'.repeat(200)
    const report = compareWithPlaylist([entry(1, long, 10)], [file(`${'x'.repeat(150)}.mp3`, 10)])
    expect(report.matched.title).toBe(1)
  })

  it('uses the length to tell two tracks with the same title apart', () => {
    const report = compareWithPlaylist(
      [entry(1, 'Intro', 30), entry(2, 'Intro', 90)],
      [file('Intro.mp3', 90)]
    )
    expect(report.matched.title).toBe(1)
    expect(report.missing.map((track) => track.index)).toEqual([1])
  })

  it('finds a renamed track by its length when it is the only one that fits', () => {
    const report = compareWithPlaylist(
      [entry(1, 'Song A', 100), entry(2, 'Song B', 200)],
      [file('Song A.mp3', 100), file('something else.mp3', 199.2)]
    )
    expect(report.matched).toEqual({ id: 0, title: 1, length: 1 })
    expect(report.missing).toEqual([])
  })

  it('does not guess by length when two tracks have almost the same length', () => {
    const report = compareWithPlaylist(
      [entry(1, 'A', 100), entry(2, 'B', 101)],
      [file('unknown.mp3', 100.5)]
    )
    expect(report.matched.length).toBe(0)
    expect(report.missing).toHaveLength(2)
    expect(report.extraFiles).toEqual(['unknown.mp3'])
  })

  it('does not take a file of another video, even with the same title or length', () => {
    const report = compareWithPlaylist(
      [entry(1, 'Song A', 100)],
      [file('Song A.mp3', 100, 'other'), file('Other.mp3', 100, 'other2')]
    )
    expect(report.matched).toEqual({ id: 0, title: 0, length: 0 })
    expect(report.missing.map((track) => track.index)).toEqual([1])
    expect(report.extraFiles).toHaveLength(2)
  })

  it('lists the missing tracks, the deleted ones apart, and the extra files', () => {
    const report = compareWithPlaylist(
      [entry(1, 'Song A', 100), entry(2, '[Deleted video]', null), entry(3, 'Song C', 300)],
      [file('Song A.mp3', 100), file('Not in list.mp3', 10)],
      false
    )
    expect(report.playlistTotal).toBe(3)
    expect(report.missing.map((track) => [track.index, track.unavailable])).toEqual([
      [2, true],
      [3, false]
    ])
    expect(report.extraFiles).toEqual(['Not in list.mp3'])
  })

  it('uses a file only once', () => {
    const report = compareWithPlaylist(
      [entry(1, 'Same', 100), entry(2, 'Same', 100)],
      [file('Same.mp3', 100)]
    )
    expect(report.matched.title).toBe(1)
    expect(report.missing).toHaveLength(1)
  })

  it('reports everything missing for a folder that does not exist', () => {
    const report = compareWithPlaylist([entry(1, 'A', 1)], [], true)
    expect(report.folderMissing).toBe(true)
    expect(report.missing).toHaveLength(1)
  })
})

describe('helpers', () => {
  it('folds titles', () => {
    expect(foldTitle('Ça va? (Remix)')).toBe('cavaremix')
  })
  it('spots deleted and private videos', () => {
    expect(isUnavailableTitle('[Deleted video]')).toBe(true)
    expect(isUnavailableTitle(' [private video] ')).toBe(true)
    expect(isUnavailableTitle('Deleted video')).toBe(false)
  })
  it('formats lengths', () => {
    expect(formatDuration(187)).toBe('3:07')
    expect(formatDuration(3729)).toBe('1:02:09')
    expect(formatDuration(null)).toBe('')
  })
})
