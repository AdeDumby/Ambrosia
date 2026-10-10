import type { AnalysisInput } from '../../src/shared/types.ts'

const MAX_CURVE_LENGTH = 2000
const MAX_MESSAGE_LENGTH = 300

export function assertId(value: unknown): asserts value is number {
  if (!Number.isInteger(value)) throw new Error('Invalid id')
}

export function assertName(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error('Invalid name')
}

export function parseAnalysisInput(value: unknown): AnalysisInput {
  const source =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}

  if (source.ok === true) {
    const { integrated, peak, curve } = source
    if (typeof integrated !== 'number' || Number.isNaN(integrated)) {
      throw new Error('Invalid loudness')
    }
    if (typeof peak !== 'number' || !Number.isFinite(peak) || peak < 0) {
      throw new Error('Invalid peak')
    }
    if (
      !Array.isArray(curve) ||
      curve.length > MAX_CURVE_LENGTH ||
      !curve.every((item) => typeof item === 'number' && Number.isFinite(item))
    ) {
      throw new Error('Invalid curve')
    }
    return { ok: true, integrated, peak, curve }
  }

  const message =
    typeof source.message === 'string' && source.message.trim() !== ''
      ? source.message.slice(0, MAX_MESSAGE_LENGTH)
      : 'Analysis failed'
  return { ok: false, message }
}
