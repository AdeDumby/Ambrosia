import { createContext, useContext, useState, type ReactNode } from 'react'

export type MatchMode = 'any' | 'all'
export type TypeFilter = 'all' | 'music' | 'sfx'
export type TagFilterState = 'include' | 'exclude'

type FilterState = {
  matchMode: MatchMode
  setMatchMode: (value: MatchMode) => void
  unreviewedOnly: boolean
  setUnreviewedOnly: (value: boolean) => void
  typeFilter: TypeFilter
  setTypeFilter: (value: TypeFilter) => void
  tagFilters: Record<number, TagFilterState>
  cycleTagFilter: (tagId: number) => void
  clearTagFilter: (tagId: number) => void
  clearFilters: () => void
}

const FilterContext = createContext<FilterState | null>(null)

export function FilterProvider({ children }: { children: ReactNode }) {
  const [matchMode, setMatchMode] = useState<MatchMode>('any')
  const [unreviewedOnly, setUnreviewedOnly] = useState(false)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [tagFilters, setTagFilters] = useState<Record<number, TagFilterState>>({})

  function cycleTagFilter(tagId: number) {
    setTagFilters((previous) => {
      const next = { ...previous }
      const current = previous[tagId]
      if (current === undefined) next[tagId] = 'include'
      else if (current === 'include') next[tagId] = 'exclude'
      else delete next[tagId]
      return next
    })
  }

  function clearTagFilter(tagId: number) {
    setTagFilters((previous) => {
      const next = { ...previous }
      delete next[tagId]
      return next
    })
  }

  function clearFilters() {
    setMatchMode('any')
    setUnreviewedOnly(false)
    setTypeFilter('all')
    setTagFilters({})
  }

  return (
    <FilterContext.Provider
      value={{
        matchMode,
        setMatchMode,
        unreviewedOnly,
        setUnreviewedOnly,
        typeFilter,
        setTypeFilter,
        tagFilters,
        cycleTagFilter,
        clearTagFilter,
        clearFilters
      }}
    >
      {children}
    </FilterContext.Provider>
  )
}

export function useFilters(): FilterState {
  const context = useContext(FilterContext)
  if (!context) throw new Error('useFilters must be used inside FilterProvider')
  return context
}
