import { useMemo } from 'react'
import { normalizeForSearch } from '../lib/search'
import type { Track } from '../shared/types'
import { useFilters } from '../store/FilterContext'
import { useLibrary } from '../store/LibraryContext'

export function useVisibleTracks(): Track[] {
  const { tracks, tags } = useLibrary()
  const { typeFilter, unreviewedOnly, matchMode, tagFilters, search } = useFilters()

  return useMemo(() => {
    const knownTagIds = new Set(tags.map((tag) => tag.id))
    const includedIds: number[] = []
    const excludedIds: number[] = []
    for (const [id, state] of Object.entries(tagFilters)) {
      const tagId = Number(id)
      if (!knownTagIds.has(tagId)) continue
      if (state === 'include') includedIds.push(tagId)
      else excludedIds.push(tagId)
    }

    const terms = normalizeForSearch(search).split(/\s+/).filter(Boolean)

    return tracks.filter((track) => {
      if (typeFilter !== 'all' && track.kind !== typeFilter) return false
      if (unreviewedOnly && track.reviewed) return false

      if (terms.length > 0) {
        const name = normalizeForSearch(track.filename)
        if (!terms.every((term) => name.includes(term))) return false
      }

      const trackTagIds = new Set(track.tags.map((tag) => tag.id))
      if (excludedIds.some((id) => trackTagIds.has(id))) return false
      if (includedIds.length === 0) return true

      return matchMode === 'all'
        ? includedIds.every((id) => trackTagIds.has(id))
        : includedIds.some((id) => trackTagIds.has(id))
    })
  }, [tracks, tags, typeFilter, unreviewedOnly, matchMode, tagFilters, search])
}
