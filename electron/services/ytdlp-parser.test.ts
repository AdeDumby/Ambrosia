import { describe, expect, it } from 'vitest'
import { parseYtDlpLine } from './ytdlp-parser.ts'

describe('parseYtDlpLine', () => {
  it('reads the playlist item counter', () => {
    expect(parseYtDlpLine('[download] Downloading item 3 of 40')).toEqual({
      kind: 'item',
      index: 3,
      total: 40
    })
    expect(parseYtDlpLine('[download] Downloading video 1 of 2')).toEqual({
      kind: 'item',
      index: 1,
      total: 2
    })
  })

  it('reads progress, including the final 100% line', () => {
    expect(parseYtDlpLine('[download]  45.2% of    3.45MiB at    1.20MiB/s ETA 00:02')).toEqual({
      kind: 'progress',
      percent: 45.2
    })
    expect(parseYtDlpLine('[download] 100% of    3.45MiB in 00:00:02 at 1.50MiB/s')).toEqual({
      kind: 'progress',
      percent: 100
    })
  })

  it('reads the download destination and the final mp3 path', () => {
    expect(parseYtDlpLine('[download] Destination: C:\\Music\\FTL\\1. Song.webm')).toEqual({
      kind: 'destination',
      path: 'C:\\Music\\FTL\\1. Song.webm'
    })
    expect(parseYtDlpLine('[ExtractAudio] Destination: C:\\Music\\FTL\\1. Song.mp3')).toEqual({
      kind: 'audio',
      path: 'C:\\Music\\FTL\\1. Song.mp3'
    })
  })

  it('reads errors', () => {
    expect(parseYtDlpLine('ERROR: [youtube] abc123: Video unavailable')).toEqual({
      kind: 'error',
      message: '[youtube] abc123: Video unavailable'
    })
  })

  it('ignores everything else', () => {
    for (const line of [
      '',
      '[youtube] abc123: Downloading webpage',
      '[Metadata] Adding metadata to "C:\\Music\\FTL\\Song.mp3"',
      '[download] Downloading playlist: FTL Soundtrack'
    ]) {
      expect(parseYtDlpLine(line)).toBeNull()
    }
  })
})
