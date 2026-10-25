import { useMemo } from 'react'
import { matchesSearch, matchesTags, selectTags } from '../lib/filterTags'
import { normalizeForSearch } from '../lib/search'
import type { Track } from '../shared/types'
import { useFilters } from '../store/FilterContext'
import { useLibrary } from '../store/LibraryContext'

export function useVisibleTracks(): Track[] {
  const { tracks, tags } = useLibrary()
  const { typeFilter, unreviewedOnly, matchMode, tagFilters, search } = useFilters()

  return useMemo(() => {
    // Mixtapes are a list of their own: no track is shown with them.
    if (typeFilter === 'mixtape') return []

    const selection = selectTags(tagFilters, new Set(tags.map((tag) => tag.id)))
    const terms = normalizeForSearch(search).split(/\s+/).filter(Boolean)

    return tracks.filter((track) => {
      if (typeFilter !== 'all' && track.kind !== typeFilter) return false
      if (unreviewedOnly && track.reviewed) return false
      if (!matchesSearch(normalizeForSearch(track.filename), terms)) return false
      return matchesTags(new Set(track.tags.map((tag) => tag.id)), selection, matchMode)
    })
  }, [tracks, tags, typeFilter, unreviewedOnly, matchMode, tagFilters, search])
}
