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
import { compareNames } from '../shared/tags'
import { useSettings } from './SettingsContext'

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
  deleteFolder: (id: number, withTags: boolean) => Promise<void>
  renameTag: (id: number, name: string) => Promise<void>
}

const LibraryContext = createContext<LibraryState | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { reloadSettings } = useSettings()
  const [categories, setCategories] = useState<TagCategory[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [tracks, setTracks] = useState<Track[]>([])

  const refreshTracks = useCallback(async () => {
    setTracks(await window.api.listTracks())
  }, [])

  const refreshTags = useCallback(async () => {
    const loaded = await window.api.listTags()
    setTags([...loaded].sort((a, b) => compareNames(a.name, b.name)))
  }, [])

  const renameTag = useCallback(
    async (id: number, name: string) => {
      await window.api.renameTag(id, name)
      await Promise.all([refreshTags(), refreshTracks()])
    },
    [refreshTags, refreshTracks]
  )

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

  const renameFolder = useCallback(
    async (id: number, name: string) => {
      await window.api.renameCategory(id, name)
      setCategories(await window.api.listCategories())
      await reloadSettings()
    },
    [reloadSettings]
  )

  const recolorFolder = useCallback(async (id: number, color: string) => {
    await window.api.recolorCategory(id, color)
    setCategories(await window.api.listCategories())
  }, [])

  const deleteFolder = useCallback(
    async (id: number, withTags: boolean) => {
      await window.api.deleteCategory(id, withTags)
      const [folders] = await Promise.all([
        window.api.listCategories(),
        refreshTags(),
        refreshTracks(),
        reloadSettings()
      ])
      setCategories(folders)
    },
    [refreshTags, refreshTracks, reloadSettings]
  )

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
        recolorFolder,
        deleteFolder,
        renameTag
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
