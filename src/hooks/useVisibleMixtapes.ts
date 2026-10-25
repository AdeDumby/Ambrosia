import { useMemo } from 'react'
import { matchesSearch, matchesTags, selectTags } from '../lib/filterTags'
import { normalizeForSearch } from '../lib/search'
import type { Mixtape } from '../shared/mixtape'
import { useFilters } from '../store/FilterContext'
import { useLibrary } from '../store/LibraryContext'

/** The mixtapes that pass the search and the tag filters. Empty unless Mixtapes is chosen. */
export function useVisibleMixtapes(): Mixtape[] {
  const { mixtapes, tags } = useLibrary()
  const { typeFilter, matchMode, tagFilters, search } = useFilters()

  return useMemo(() => {
    if (typeFilter !== 'mixtape') return []
    const selection = selectTags(tagFilters, new Set(tags.map((tag) => tag.id)))
    const terms = normalizeForSearch(search).split(/\s+/).filter(Boolean)

    return mixtapes.filter(
      (mixtape) =>
        matchesSearch(normalizeForSearch(mixtape.name), terms) &&
        matchesTags(new Set(mixtape.tags.map((tag) => tag.id)), selection, matchMode)
    )
  }, [mixtapes, tags, typeFilter, matchMode, tagFilters, search])
}
