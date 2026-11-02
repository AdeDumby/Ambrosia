export type YtDlpEvent =
  | { kind: 'item'; index: number; total: number }
  | { kind: 'destination'; path: string }
  | { kind: 'progress'; percent: number }
  | { kind: 'audio'; path: string }
  | { kind: 'archived' }
  | { kind: 'error'; message: string }

export function parseYtDlpLine(line: string): YtDlpEvent | null {
  const text = line.trim()
  if (text === '') return null

  let match = /^\[download\] Downloading (?:item|video) (\d+) of (\d+)$/.exec(text)
  if (match) return { kind: 'item', index: Number(match[1]), total: Number(match[2]) }

  match = /^\[download\] Destination: (.+)$/.exec(text)
  if (match) return { kind: 'destination', path: match[1] }

  match = /^\[download\]\s+(\d+(?:\.\d+)?)%/.exec(text)
  if (match) return { kind: 'progress', percent: Math.min(Number(match[1]), 100) }

  match = /^\[ExtractAudio\] Destination: (.+)$/.exec(text)
  if (match) return { kind: 'audio', path: match[1] }

  match = /^\[ExtractAudio\] Not converting audio (.+); file is already in target format mp3$/.exec(
    text
  )
  if (match) return { kind: 'audio', path: match[1] }

  match = /^\[download\] (.+\.mp3) has already been downloaded$/.exec(text)
  if (match) return { kind: 'audio', path: match[1] }

  if (/^\[download\] .+: has already been recorded in the archive$/.test(text)) {
    return { kind: 'archived' }
  }

  match = /^ERROR: (.+)$/.exec(text)
  if (match) return { kind: 'error', message: match[1] }

  return null
}
