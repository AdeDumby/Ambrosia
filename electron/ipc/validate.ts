export function assertId(value: unknown): asserts value is number {
  if (!Number.isInteger(value)) throw new Error('Invalid id')
}

export function assertName(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error('Invalid name')
}
