import type { Loudness } from '../shared/loudness'

export const MAX_ANALYZE_SECONDS = 15 * 60
const DECODE_SAMPLE_RATE = 44_100

export type TrackAnalysis = {
  loudness: Loudness
  channels: number
  sampleRate: number
  timings: { readMs: number; decodeMs: number; measureMs: number }
}

type WorkerReply =
  { ok: true; result: Loudness; measureMs: number } | { ok: false; message: string }

function measureInWorker(
  channels: Float32Array[],
  sampleRate: number
): Promise<{ result: Loudness; measureMs: number }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/loudness.worker.ts', import.meta.url), {
      type: 'module'
    })
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      worker.terminate()
      if (event.data.ok) {
        resolve({ result: event.data.result, measureMs: event.data.measureMs })
      } else {
        reject(new Error(event.data.message))
      }
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || 'The loudness worker failed to run'))
    }
    worker.postMessage(
      { channels, sampleRate },
      channels.map((channel) => channel.buffer as ArrayBuffer)
    )
  })
}

export async function analyzeTrack(trackId: number, durationSec: number): Promise<TrackAnalysis> {
  if (durationSec > MAX_ANALYZE_SECONDS) {
    throw new Error(
      `The track is longer than ${MAX_ANALYZE_SECONDS / 60} minutes, so it was skipped`
    )
  }

  const readStart = performance.now()
  const response = await fetch(`ambrosia-audio://track/${trackId}`)
  if (!response.ok) throw new Error(`Could not read the file (${response.status})`)
  const encoded = await response.arrayBuffer()
  const readMs = performance.now() - readStart

  const decodeStart = performance.now()
  let decoded: AudioBuffer
  try {
    decoded = await new OfflineAudioContext(1, 1, DECODE_SAMPLE_RATE).decodeAudioData(encoded)
  } catch {
    throw new Error('The audio could not be decoded')
  }
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => {
    const samples = new Float32Array(decoded.length)
    decoded.copyFromChannel(samples, index)
    return samples
  })
  const decodeMs = performance.now() - decodeStart

  const { result, measureMs } = await measureInWorker(channels, decoded.sampleRate)

  return {
    loudness: result,
    channels: decoded.numberOfChannels,
    sampleRate: decoded.sampleRate,
    timings: {
      readMs: Math.round(readMs),
      decodeMs: Math.round(decodeMs),
      measureMs: Math.round(measureMs)
    }
  }
}

if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).analyzeTrack = analyzeTrack
}
