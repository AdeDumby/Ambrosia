import { createContext, useContext, useState, type ReactNode } from 'react'

export type MatchMode = 'any' | 'all'
export type TypeFilter = 'all' | 'music' | 'sfx'

type FilterState = {
  matchMode: MatchMode
  setMatchMode: (value: MatchMode) => void
  unreviewedOnly: boolean
  setUnreviewedOnly: (value: boolean) => void
  typeFilter: TypeFilter
  setTypeFilter: (value: TypeFilter) => void
  clearFilters: () => void
}

const FilterContext = createContext<FilterState | null>(null)

export function FilterProvider({ children }: { children: ReactNode }) {
  const [matchMode, setMatchMode] = useState<MatchMode>('any')
  const [unreviewedOnly, setUnreviewedOnly] = useState(false)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  function clearFilters() {
    setMatchMode('any')
    setUnreviewedOnly(false)
    setTypeFilter('all')
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
