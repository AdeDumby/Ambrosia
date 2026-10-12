import type { ScanProgress } from '../../src/shared/types.ts'

export const SCAN_CANCELLED = 'Scan cancelled'

const IDLE: ScanProgress = {
  running: false,
  phase: 'idle',
  found: 0,
  done: 0,
  total: null,
  current: ''
}

let state: ScanProgress = { ...IDLE }
let cancelled = false

export function getScanProgress(): ScanProgress {
  return { ...state }
}

export function updateScan(patch: Partial<ScanProgress>): void {
  state = { ...state, ...patch }
}

export function showScanning(current: string): void {
  state = { ...state, current }
}

export function advanceScan(): void {
  state = { ...state, done: state.done + 1 }
}

export function cancelScan(): void {
  if (state.running) cancelled = true
}

export function throwIfCancelled(): void {
  if (cancelled) throw new Error(SCAN_CANCELLED)
}

export async function withScanRun<T>(work: () => Promise<T>): Promise<T> {
  if (state.running) throw new Error('A scan is already running.')
  cancelled = false
  state = { ...IDLE, running: true, phase: 'walking' }
  try {
    return await work()
  } finally {
    state = { ...state, running: false, phase: 'idle', current: '' }
    cancelled = false
  }
}
