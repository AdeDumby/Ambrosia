import { describe, expect, it } from 'vitest'
import { gainForTarget, measureLoudness } from './loudness'

const SAMPLE_RATE = 48_000

function sine(
  frequency: number,
  amplitude: number,
  seconds: number,
  rate = SAMPLE_RATE
): Float32Array {
  const samples = new Float32Array(Math.round(seconds * rate))
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = amplitude * Math.sin((2 * Math.PI * frequency * index) / rate)
  }
  return samples
}

function scaled(samples: Float32Array, factor: number): Float32Array {
  return samples.map((value) => value * factor)
}

describe('measureLoudness', () => {
  it('reads 0 LUFS for a full-scale 997 Hz sine in both channels', () => {
    const channel = sine(997, 1, 10)
    const { integrated } = measureLoudness([channel, channel], SAMPLE_RATE)
    expect(integrated).toBeCloseTo(0, 1)
  })

  it('reads -3.01 LUFS for a full-scale 997 Hz sine in one channel', () => {
    const channel = sine(997, 1, 10)
    const { integrated } = measureLoudness([channel], SAMPLE_RATE)
    expect(integrated).toBeCloseTo(-3.01, 1)
  })

  it('reads -23 LUFS for a 997 Hz sine at -23 dBFS in both channels', () => {
    const channel = sine(997, 10 ** (-23 / 20), 10)
    const { integrated } = measureLoudness([channel, channel], SAMPLE_RATE)
    expect(integrated).toBeCloseTo(-23, 1)
  })

  it('weighs treble up and deep bass down', () => {
    const level = (frequency: number) => {
      const channel = sine(frequency, 0.1, 10)
      return measureLoudness([channel, channel], SAMPLE_RATE).integrated
    }
    expect(level(8000)).toBeGreaterThan(level(997) + 2)
    expect(level(50)).toBeLessThan(level(997) - 2)
  })

  it('gives the same answer at 44.1 kHz as at 48 kHz', () => {
    const at48 = sine(997, 0.1, 10)
    const at44 = sine(997, 0.1, 10, 44_100)
    const first = measureLoudness([at48, at48], SAMPLE_RATE).integrated
    const second = measureLoudness([at44, at44], 44_100).integrated
    expect(Math.abs(first - second)).toBeLessThan(0.1)
  })

  it('moves by exactly 6.02 dB when the amplitude doubles', () => {
    const quiet = sine(440, 0.1, 10)
    const first = measureLoudness([quiet, quiet], SAMPLE_RATE).integrated
    const louder = scaled(quiet, 2)
    const second = measureLoudness([louder, louder], SAMPLE_RATE).integrated
    expect(second - first).toBeCloseTo(6.02, 1)
  })

  it('counts a mono signal 3 dB quieter than the same signal in two channels', () => {
    const channel = sine(997, 0.1, 10)
    const mono = measureLoudness([channel], SAMPLE_RATE).integrated
    const stereo = measureLoudness([channel, channel], SAMPLE_RATE).integrated
    expect(stereo - mono).toBeCloseTo(3.01, 1)
  })

  it('ignores silence around the music', () => {
    const music = sine(997, 0.1, 8)
    const padded = new Float32Array(SAMPLE_RATE * 20)
    padded.set(music, SAMPLE_RATE * 6)
    const plain = measureLoudness([music, music], SAMPLE_RATE).integrated
    const withSilence = measureLoudness([padded, padded], SAMPLE_RATE).integrated
    expect(Math.abs(plain - withSilence)).toBeLessThan(0.2)
  })

  it('reports silence as minus infinity and does not crash on empty audio', () => {
    expect(measureLoudness([new Float32Array(SAMPLE_RATE * 3)], SAMPLE_RATE).integrated).toBe(
      -Infinity
    )
    expect(measureLoudness([], SAMPLE_RATE).integrated).toBe(-Infinity)
  })

  it('finds the highest sample and one curve value per second', () => {
    const channel = sine(997, 0.5, 5)
    const result = measureLoudness([channel], SAMPLE_RATE)
    expect(result.peak).toBeCloseTo(0.5, 2)
    expect(result.curve).toHaveLength(5)
  })

  it('shows a loud section as a higher value in the curve', () => {
    const quiet = sine(997, 0.01, 5)
    const loud = sine(997, 0.5, 5)
    const joined = new Float32Array(quiet.length + loud.length)
    joined.set(quiet, 0)
    joined.set(loud, quiet.length)
    const { curve } = measureLoudness([joined], SAMPLE_RATE)
    expect(curve[9]).toBeGreaterThan(curve[0] + 20)
  })
})

describe('gainForTarget', () => {
  it('lowers a loud track to the target', () => {
    expect(20 * Math.log10(gainForTarget(-10, 0.5, -14))).toBeCloseTo(-4, 5)
  })

  it('raises a quiet track to the target', () => {
    expect(20 * Math.log10(gainForTarget(-20, 0.1, -14))).toBeCloseTo(6, 5)
  })

  it('stops a boost that would push the peak past the ceiling', () => {
    const gain = gainForTarget(-20, 0.9, -14)
    expect(0.9 * gain).toBeLessThanOrEqual(10 ** (-1 / 20) + 1e-9)
    expect(gain).toBeLessThan(10 ** (6 / 20))
  })

  it('leaves a track alone when it has no measurable loudness', () => {
    expect(gainForTarget(-Infinity, 0, -14)).toBe(1)
    expect(gainForTarget(-30, 0, -14)).toBe(1)
  })
})
