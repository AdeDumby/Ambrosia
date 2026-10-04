import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Tag, TagCategory } from '../shared/types'

type LibraryState = {
  categories: TagCategory[]
  setCategories: (categories: TagCategory[]) => void
  tags: Tag[]
  refreshTags: () => Promise<void>
}

const LibraryContext = createContext<LibraryState | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<TagCategory[]>([])
  const [tags, setTags] = useState<Tag[]>([])

  const refreshTags = useCallback(async () => {
    setTags(await window.api.listTags())
  }, [])

  useEffect(() => {
    window.api.listCategories().then(setCategories)
    void refreshTags()
  }, [refreshTags])

  return (
    <LibraryContext.Provider value={{ categories, setCategories, tags, refreshTags }}>
      {children}
    </LibraryContext.Provider>
  )
}

export function useLibrary(): LibraryState {
  const context = useContext(LibraryContext)
  if (!context) throw new Error('useLibrary must be used inside LibraryProvider')
  return context
}
