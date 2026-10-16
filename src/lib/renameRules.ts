export type RenameRule = { id: number; find: string; replace: string; ignoreCase: boolean }
export type CompiledRule = { rule: RenameRule; regex: RegExp | null; error: string | null }
export type Segment = { text: string; hit: boolean }

export const MAX_RULES = 20
export const MAX_PATTERN = 200

export const RULE_PRESETS = [
  {
    label: 'Leading track number',
    find: '^\\s*\\d+\\s*[.\\-–:)]+\\s*',
    replace: '',
    ignoreCase: false
  },
  { label: 'Text in brackets', find: '\\s*[\\[(][^\\])]*[\\])]', replace: '', ignoreCase: false },
  { label: 'Everything before a dash', find: '^.*?\\s[-–]\\s', replace: '', ignoreCase: false },
  {
    label: 'Words like Official or Lyrics',
    find: '\\b(official|lyrics?|hd|hq|audio|video)\\b',
    replace: '',
    ignoreCase: true
  },
  { label: 'Trailing dashes or underscores', find: '[\\s\\-_–]+$', replace: '', ignoreCase: false }
]

export function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function compileRules(rules: RenameRule[]): CompiledRule[] {
  return rules.map((rule) => {
    if (rule.find === '') return { rule, regex: null, error: null }
    if (rule.find.length > MAX_PATTERN) {
      return { rule, regex: null, error: `Use at most ${MAX_PATTERN} characters.` }
    }
    try {
      return { rule, regex: new RegExp(rule.find, rule.ignoreCase ? 'gi' : 'g'), error: null }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.replace(/^Invalid regular expression: /, '')
          : 'This pattern is not valid.'
      return { rule, regex: null, error: message }
    }
  })
}

export function runStages(stem: string, compiled: CompiledRule[]): string[] {
  const stages = [stem]
  for (const { rule, regex } of compiled) {
    const previous = stages[stages.length - 1]
    stages.push(regex ? tidy(previous.replace(regex, rule.replace)) : previous)
  }
  return stages
}

export function finalName(stem: string, compiled: CompiledRule[]): string {
  const stages = runStages(stem, compiled)
  return stages[stages.length - 1]
}

export function matchRanges(text: string, regex: RegExp): [number, number][] {
  const ranges: [number, number][] = []
  for (const match of text.matchAll(regex)) {
    if (match[0].length > 0 && match.index !== undefined) {
      ranges.push([match.index, match.index + match[0].length])
    }
  }
  return ranges
}

export function splitByRanges(text: string, ranges: [number, number][]): Segment[] {
  const segments: Segment[] = []
  let position = 0
  for (const [start, end] of ranges) {
    if (start > position) segments.push({ text: text.slice(position, start), hit: false })
    segments.push({ text: text.slice(start, end), hit: true })
    position = end
  }
  if (position < text.length) segments.push({ text: text.slice(position), hit: false })
  return segments
}
