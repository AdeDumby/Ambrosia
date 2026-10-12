export const MAX_TAG_NAME = 120

export function formatTagName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) =>
      word
        .split('-')
        .map((part) => (part === '' ? part : part[0].toUpperCase() + part.slice(1)))
        .join('-')
    )
    .join(' ')
}

export function foldText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const collator = new Intl.Collator('en', { sensitivity: 'variant', numeric: true })
const baseCollator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

export function compareNames(a: string, b: string): number {
  return baseCollator.compare(a, b) || collator.compare(a, b)
}
