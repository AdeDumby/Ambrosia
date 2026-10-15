import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction
} from 'react'
import { compareNames, sortTrackTags } from '../shared/tags'
import type { Tag, TagCategory, Track, TrackTag } from '../shared/types'
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
  renameTag: (id: number, name: string) => Promise<void>
  createFolder: (name: string) => Promise<void>
  renameFolder: (id: number, name: string) => Promise<void>
  recolorFolder: (id: number, color: string) => Promise<void>
  deleteFolder: (id: number, withTags: boolean) => Promise<void>
}

const LibraryContext = createContext<LibraryState | null>(null)

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { reloadSettings } = useSettings()
  const [categories, setCategories] = useState<TagCategory[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [tracks, setTracks] = useState<Track[]>([])
  const tagsRef = useRef<Tag[]>([])

  const refreshTags = useCallback(async () => {
    const loaded = await window.api.listTags()
    const sorted = [...loaded].sort((a, b) => compareNames(a.name, b.name))
    tagsRef.current = sorted
    setTags(sorted)
  }, [])

  const refreshTracks = useCallback(async () => {
    setTracks(await window.api.listTracks())
  }, [])

  const patchTracks = useCallback((tagIds: number[], update: (tag: TrackTag) => TrackTag) => {
    if (tagIds.length === 0) return
    const wanted = new Set(tagIds)
    setTracks((previous) =>
      previous.map((track) =>
        track.tags.some((tag) => wanted.has(tag.id))
          ? {
              ...track,
              tags: sortTrackTags(track.tags.map((tag) => (wanted.has(tag.id) ? update(tag) : tag)))
            }
          : track
      )
    )
  }, [])

  const moveTag = useCallback(
    async (tagId: number, categoryId: number | null) => {
      await window.api.setTagCategory(tagId, categoryId)
      const folders = await window.api.listCategories()
      const folder = folders.find((candidate) => candidate.id === categoryId)
      patchTracks([tagId], (tag) => ({
        ...tag,
        color: folder?.color ?? null,
        folderOrder: folder?.sortOrder ?? 0
      }))
      setCategories(folders)
      await refreshTags()
    },
    [patchTracks, refreshTags]
  )

  const renameTag = useCallback(
    async (id: number, name: string) => {
      const cleaned = await window.api.renameTag(id, name)
      patchTracks([id], (tag) => ({ ...tag, name: cleaned }))
      await refreshTags()
    },
    [patchTracks, refreshTags]
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

  const recolorFolder = useCallback(
    async (id: number, color: string) => {
      await window.api.recolorCategory(id, color)
      const ids = tagsRef.current.filter((tag) => tag.categoryId === id).map((tag) => tag.id)
      patchTracks(ids, (tag) => ({ ...tag, color }))
      setCategories(await window.api.listCategories())
    },
    [patchTracks]
  )

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
        renameTag,
        createFolder,
        renameFolder,
        recolorFolder,
        deleteFolder
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
