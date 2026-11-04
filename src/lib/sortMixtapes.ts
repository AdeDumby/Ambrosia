import type { Mixtape } from '../shared/mixtape'
import type { SortKey } from './sortTracks'
import { SORT_OPTIONS } from './sortTracks'

const SORTABLE: SortKey[] = ['name-asc', 'name-desc', 'most-tags', 'fewest-tags']

export const MIXTAPE_SORT_OPTIONS = SORT_OPTIONS.filter((option) => SORTABLE.includes(option.value))

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

const byName = (a: Mixtape, b: Mixtape): number => collator.compare(a.name, b.name) || a.id - b.id

export function sortMixtapes(mixtapes: Mixtape[], key: SortKey): Mixtape[] {
  const compare = (a: Mixtape, b: Mixtape): number => {
    switch (key) {
      case 'name-desc':
        return byName(b, a)
      case 'most-tags':
        return b.tags.length - a.tags.length || byName(a, b)
      case 'fewest-tags':
        return a.tags.length - b.tags.length || byName(a, b)
      default:
        return byName(a, b)
    }
  }
  return [...mixtapes].sort(compare)
}

export function effectiveMixtapeSort(key: SortKey): SortKey {
  return SORTABLE.includes(key) ? key : 'name-asc'
}
