export type Loudness = {
  integrated: number
  peak: number
  curve: number[]
}

type Biquad = { b: [number, number, number]; a: [number, number, number] }

const ABSOLUTE_GATE = -70
const RELATIVE_GATE = 10
const BLOCK_SECONDS = 0.4
const STEP_SECONDS = 0.1
const CURVE_WINDOW_SECONDS = 3
const OFFSET = -0.691

function shelfFilter(sampleRate: number): Biquad {
  const gainDb = 3.999843853973347
  const f0 = 1681.974450955533
  const q = 0.7071752369554196
  const k = Math.tan((Math.PI * f0) / sampleRate)
  const vh = 10 ** (gainDb / 20)
  const vb = vh ** 0.4996667741545416
  const a0 = 1 + k / q + k * k
  return {
    b: [
      (vh + (vb * k) / q + k * k) / a0,
      (2 * (k * k - vh)) / a0,
      (vh - (vb * k) / q + k * k) / a0
    ],
    a: [1, (2 * (k * k - 1)) / a0, (1 - k / q + k * k) / a0]
  }
}

function highPassFilter(sampleRate: number): Biquad {
  const f0 = 38.13547087602444
  const q = 0.5003270373238773
  const k = Math.tan((Math.PI * f0) / sampleRate)
  const a0 = 1 + k / q + k * k
  return {
    b: [1, -2, 1],
    a: [1, (2 * (k * k - 1)) / a0, (1 - k / q + k * k) / a0]
  }
}

function applyBiquad(input: Float32Array | Float64Array, filter: Biquad): Float64Array {
  const output = new Float64Array(input.length)
  const [b0, b1, b2] = filter.b
  const [, a1, a2] = filter.a
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let index = 0; index < input.length; index += 1) {
    const x0 = input[index]
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    output[index] = y0
    x2 = x1
    x1 = x0
    y2 = y1
    y1 = y0
  }
  return output
}

function toLufs(power: number): number {
  return power > 0 ? OFFSET + 10 * Math.log10(power) : -Infinity
}

function meanPower(prefix: Float64Array, start: number, length: number): number {
  const end = Math.min(start + length, prefix.length - 1)
  return end > start ? (prefix[end] - prefix[start]) / (end - start) : 0
}

export function measureLoudness(channels: Float32Array[], sampleRate: number): Loudness {
  const length = channels[0]?.length ?? 0
  if (length === 0) return { integrated: -Infinity, peak: 0, curve: [] }

  let peak = 0
  const prefixes = channels.map((channel) => {
    const weighted = applyBiquad(
      applyBiquad(channel, shelfFilter(sampleRate)),
      highPassFilter(sampleRate)
    )
    const prefix = new Float64Array(length + 1)
    for (let index = 0; index < length; index += 1) {
      prefix[index + 1] = prefix[index] + weighted[index] * weighted[index]
      const magnitude = Math.abs(channel[index])
      if (magnitude > peak) peak = magnitude
    }
    return prefix
  })

  const power = (start: number, windowLength: number): number =>
    prefixes.reduce((sum, prefix) => sum + meanPower(prefix, start, windowLength), 0)

  const blockLength = Math.round(BLOCK_SECONDS * sampleRate)
  const stepLength = Math.round(STEP_SECONDS * sampleRate)
  const blocks: number[] = []
  for (let start = 0; start + blockLength <= length; start += stepLength) {
    blocks.push(power(start, blockLength))
  }

  const aboveAbsolute = blocks.filter((block) => toLufs(block) > ABSOLUTE_GATE)
  let integrated = -Infinity
  if (aboveAbsolute.length > 0) {
    const mean = aboveAbsolute.reduce((sum, block) => sum + block, 0) / aboveAbsolute.length
    const gate = toLufs(mean) - RELATIVE_GATE
    const kept = aboveAbsolute.filter((block) => toLufs(block) > gate)
    if (kept.length > 0) {
      integrated = toLufs(kept.reduce((sum, block) => sum + block, 0) / kept.length)
    }
  }

  const windowLength = Math.round(CURVE_WINDOW_SECONDS * sampleRate)
  const second = Math.round(sampleRate)
  const curve: number[] = []
  for (let start = 0; start < length; start += second) {
    const loudness = toLufs(power(start, Math.min(windowLength, length - start)))
    curve.push(Number.isFinite(loudness) ? Math.round(loudness * 10) / 10 : -100)
  }

  return { integrated, peak, curve }
}

export function gainForTarget(
  integrated: number,
  peak: number,
  target: number,
  ceilingDb = -1
): number {
  if (!Number.isFinite(integrated) || peak <= 0) return 1
  const wanted = 10 ** ((target - integrated) / 20)
  const allowed = 10 ** (ceilingDb / 20) / peak
  return Math.min(wanted, allowed)
}
