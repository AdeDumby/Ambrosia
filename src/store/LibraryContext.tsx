import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react'
import type { Tag, TagCategory, Track } from '../shared/types'

type LibraryState = {
  categories: TagCategory[]
  setCategories: (categories: TagCategory[]) => void
  tags: Tag[]
  refreshTags: () => Promise<void>
  tracks: Track[]
  setTracks: Dispatch<SetStateAction<Track[]>>
  refreshTracks: () => Promise<void>
  moveTag: (tagId: number, categoryId: number | null) => Promise<void>
  createFolder: (name: string) => Promise<void>
  renameFolder: (id: number, name: string) => Promise<void>
  recolorFolder: (id: number, color: string) => Promise<void>
}

const LibraryContext = createContext<LibraryState | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<TagCategory[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [tracks, setTracks] = useState<Track[]>([])

  const refreshTags = useCallback(async () => {
    setTags(await window.api.listTags())
  }, [])

  const refreshTracks = useCallback(async () => {
    setTracks(await window.api.listTracks())
  }, [])

  const moveTag = useCallback(
    async (tagId: number, categoryId: number | null) => {
      await window.api.setTagCategory(tagId, categoryId)
      await Promise.all([refreshTags(), refreshTracks()])
    },
    [refreshTags, refreshTracks]
  )

  const createFolder = useCallback(async (name: string) => {
    await window.api.createCategory(name)
    setCategories(await window.api.listCategories())
  }, [])
  const renameFolder = useCallback(async (id: number, name: string) => {
    await window.api.renameCategory(id, name)
    setCategories(await window.api.listCategories())
  }, [])

  const recolorFolder = useCallback(async (id: number, color: string) => {
    await window.api.recolorCategory(id, color)
    setCategories(await window.api.listCategories())
  }, [])

  useEffect(() => {
    window.api.listCategories().then(setCategories)
    void refreshTags()
    void refreshTracks()
  }, [refreshTags, refreshTracks])

  return (
    <LibraryContext.Provider
      value={{
        categories,
        setCategories,
        tags,
        refreshTags,
        tracks,
        setTracks,
        refreshTracks,
        moveTag,
        createFolder,
        renameFolder,
        recolorFolder
      }}
    >
      {children}
    </LibraryContext.Provider>
  )
}

export function useLibrary(): LibraryState {
  const context = useContext(LibraryContext)
  if (!context) throw new Error('useLibrary must be used inside LibraryProvider')
  return context
}
