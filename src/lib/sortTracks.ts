import type { Track } from '../shared/types'

export type SortKey =
  | 'name-asc'
  | 'name-desc'
  | 'loudest'
  | 'quietest'
  | 'shortest'
  | 'longest'
  | 'most-tags'
  | 'fewest-tags'

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name-asc', label: 'Name (A → Z)' },
  { value: 'name-desc', label: 'Name (Z → A)' },
  { value: 'loudest', label: 'Loudest first' },
  { value: 'quietest', label: 'Quietest first' },
  { value: 'shortest', label: 'Shortest first' },
  { value: 'longest', label: 'Longest first' },
  { value: 'most-tags', label: 'Most tags first' },
  { value: 'fewest-tags', label: 'Fewest tags first' }
]

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function byName(a: Track, b: Track): number {
  return collator.compare(a.filename, b.filename) || a.id - b.id
}

function byNumber(value: (track: Track) => number | null, direction: 'asc' | 'desc') {
  return (a: Track, b: Track): number => {
    const left = value(a)
    const right = value(b)
    if (left === null && right === null) return byName(a, b)
    if (left === null) return 1
    if (right === null) return -1
    const difference = direction === 'asc' ? left - right : right - left
    return difference || byName(a, b)
  }
}

const COMPARATORS: Record<SortKey, (a: Track, b: Track) => number> = {
  'name-asc': byName,
  'name-desc': (a, b) => byName(b, a),
  loudest: byNumber((track) => track.peakDb, 'desc'),
  quietest: byNumber((track) => track.peakDb, 'asc'),
  shortest: byNumber((track) => track.durationSec, 'asc'),
  longest: byNumber((track) => track.durationSec, 'desc'),
  'most-tags': byNumber((track) => track.tags.length, 'desc'),
  'fewest-tags': byNumber((track) => track.tags.length, 'asc')
}

export function sortTracks(tracks: Track[], key: SortKey): Track[] {
  return [...tracks].sort(COMPARATORS[key])
}
