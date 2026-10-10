import { measureLoudness } from '../shared/loudness'

type Request = { channels: Float32Array[]; sampleRate: number }

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null
  postMessage: (message: unknown) => void
}

scope.onmessage = (event) => {
  try {
    const { channels, sampleRate } = event.data
    const input = channels.length === 1 ? [channels[0], channels[0]] : channels
    const started = performance.now()
    const result = measureLoudness(input, sampleRate)
    scope.postMessage({ ok: true, result, measureMs: performance.now() - started })
  } catch (error) {
    scope.postMessage({
      ok: false,
      message: error instanceof Error ? error.message : String(error)
    })
  }
}
