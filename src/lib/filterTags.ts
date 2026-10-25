import type { MatchMode, TagFilterState } from '../store/FilterContext'

export type TagSelection = { included: number[]; excluded: number[] }

/** Splits the tag filters into the tags to include and to exclude, ignoring unknown tags. */
export function selectTags(
  tagFilters: Record<number, TagFilterState>,
  knownTagIds: ReadonlySet<number>
): TagSelection {
  const included: number[] = []
  const excluded: number[] = []
  for (const [id, state] of Object.entries(tagFilters)) {
    const tagId = Number(id)
    if (!knownTagIds.has(tagId)) continue
    if (state === 'include') included.push(tagId)
    else excluded.push(tagId)
  }
  return { included, excluded }
}

/** True when an item with these tags passes the tag filters. */
export function matchesTags(
  itemTagIds: ReadonlySet<number>,
  selection: TagSelection,
  mode: MatchMode
): boolean {
  if (selection.excluded.some((id) => itemTagIds.has(id))) return false
  if (selection.included.length === 0) return true
  return mode === 'all'
    ? selection.included.every((id) => itemTagIds.has(id))
    : selection.included.some((id) => itemTagIds.has(id))
}

/** True when every word of the search is in the name. `terms` come from normalizeForSearch. */
export function matchesSearch(normalizedName: string, terms: readonly string[]): boolean {
  return terms.every((term) => normalizedName.includes(term))
}
