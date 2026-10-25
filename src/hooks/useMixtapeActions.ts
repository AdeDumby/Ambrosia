import { useCallback } from 'react'
import { useLibrary } from '../store/LibraryContext'

/** Tagging, renaming and deleting mixtapes. Each action reloads the list when it is done. */
export function useMixtapeActions() {
  const { refreshMixtapes, refreshTags } = useLibrary()

  const addTag = useCallback(
    async (id: number, tagId: number) => {
      await window.api.tagMixtape(id, tagId)
      await refreshMixtapes()
    },
    [refreshMixtapes]
  )

  const createTag = useCallback(
    async (id: number, name: string) => {
      const created = await window.api.addTagToMixtapeByName(id, name, null)
      await refreshMixtapes()
      if (created) await refreshTags()
    },
    [refreshMixtapes, refreshTags]
  )

  const removeTag = useCallback(
    async (id: number, tagId: number) => {
      const tagDeleted = await window.api.untagMixtape(id, tagId)
      await refreshMixtapes()
      if (tagDeleted) await refreshTags()
    },
    [refreshMixtapes, refreshTags]
  )

  const rename = useCallback(
    async (id: number, name: string) => {
      await window.api.renameMixtape(id, name)
      await refreshMixtapes()
    },
    [refreshMixtapes]
  )

  const remove = useCallback(
    async (id: number) => {
      await window.api.deleteMixtape(id)
      // A tag that only this mixtape used is gone with it.
      await Promise.all([refreshMixtapes(), refreshTags()])
    },
    [refreshMixtapes, refreshTags]
  )

  return { addTag, createTag, removeTag, rename, remove }
}
