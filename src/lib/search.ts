import { foldText } from '../shared/tags'

export function normalizeForSearch(value: string): string {
  return foldText(value)
}
