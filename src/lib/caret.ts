type CaretPosition = { offsetNode: Node; offset: number }
type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => CaretPosition | null
  caretRangeFromPoint?: (x: number, y: number) => Range | null
}

export function textOffsetAt(element: HTMLElement, x: number, y: number): number {
  const doc = document as CaretDocument
  let node: Node | null = null
  let offset = 0

  const position = doc.caretPositionFromPoint?.(x, y)
  if (position) {
    node = position.offsetNode
    offset = position.offset
  } else {
    const range = doc.caretRangeFromPoint?.(x, y)
    if (range) {
      node = range.startContainer
      offset = range.startOffset
    }
  }

  const length = element.textContent?.length ?? 0
  if (!node || !element.contains(node)) return length
  if (node === element) return offset === 0 ? 0 : length
  return Math.min(offset, length)
}
