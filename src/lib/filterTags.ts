import type { MatchMode, TagFilterState } from '../store/FilterContext'

export type TagSelection = { included: number[]; excluded: number[] }

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

export function matchesSearch(normalizedName: string, terms: readonly string[]): boolean {
  return terms.every((term) => normalizedName.includes(term))
}
