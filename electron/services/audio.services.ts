import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'

const AUDIO_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac'
}

export const AUDIO_EXTENSIONS = new Set(Object.keys(AUDIO_TYPES))

function toWebStream(stream: Readable): ReadableStream {
  return Readable.toWeb(stream) as unknown as ReadableStream
}

export async function serveAudio(filePath: string, rangeHeader: string | null): Promise<Response> {
  let size: number
  try {
    size = (await stat(filePath)).size
  } catch {
    return new Response('File not found on disk', { status: 404 })
  }

  const headers = {
    'Content-Type': AUDIO_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes'
  }

  const match = rangeHeader ? /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim()) : null
  if (!match || (match[1] === '' && match[2] === '')) {
    return new Response(toWebStream(createReadStream(filePath)), {
      status: 200,
      headers: { ...headers, 'Content-Length': String(size) }
    })
  }

  let start: number
  let end: number
  if (match[1] === '') {
    start = Math.max(size - Number(match[2]), 0)
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1)
  }

  if (start >= size || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  }

  return new Response(toWebStream(createReadStream(filePath, { start, end })), {
    status: 206,
    headers: {
      ...headers,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1)
    }
  })
}
