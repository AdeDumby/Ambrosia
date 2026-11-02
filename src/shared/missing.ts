/** What is needed to tell which tracks of a playlist are missing from a folder. */

export type PlaylistEntry = {
  /** Its number in the playlist, from 1. */
  index: number
  id: string
  title: string
  durationSec: number | null
}

export type FolderFile = {
  /** The name of the file, with its extension. */
  name: string
  durationSec: number | null
  /** The video ID Ambrosia wrote in the file when it downloaded it, if any. */
  videoId: string | null
}

export type MatchMethod = 'id' | 'title' | 'length'

export type MissingTrack = PlaylistEntry & {
  /** Deleted or private: it can not be downloaded. */
  unavailable: boolean
}

export type MissingReport = {
  playlistTotal: number
  /** How many playlist tracks have a file in the folder, by the way they were found. */
  matched: Record<MatchMethod, number>
  missing: MissingTrack[]
  /** Files of the folder that match no track of the playlist. */
  extraFiles: string[]
  /** The folder did not exist yet, so everything is missing. */
  folderMissing: boolean
}

/** Two lengths this close (in seconds) are taken as the same recording. */
export const LENGTH_TOLERANCE_SEC = 2
/** yt-dlp cuts the title of a file name at this many characters (see the output template). */
const TITLE_LIMIT = 150

const UNAVAILABLE = /^\[(deleted|private) video\]$/i

export function isUnavailableTitle(title: string): boolean {
  return UNAVAILABLE.test(title.trim())
}

/** Letters and digits only, without accents or case: what stays the same when a name is saved. */
export function foldTitle(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

export function stemOfName(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

function near(a: number | null, b: number | null): boolean {
  return a !== null && b !== null && Math.abs(a - b) <= LENGTH_TOLERANCE_SEC
}

function distance(a: number | null, b: number | null): number {
  return a === null || b === null ? Number.MAX_SAFE_INTEGER : Math.abs(a - b)
}

/**
 * Finds out which tracks of the playlist have a file in the folder. Three steps, from the most
 * to the least sure, and a file is used once:
 *   1. the video ID that was written in the file,
 *   2. the same letters and digits in the title (the closest length wins when several fit),
 *   3. the same length (within a couple of seconds), when only one file and one track fit. This
 *      finds files that were renamed, or whose name has a symbol that could not be saved.
 */
export function compareWithPlaylist(
  entries: PlaylistEntry[],
  files: FolderFile[],
  folderMissing = false
): MissingReport {
  const matched: Record<MatchMethod, number> = { id: 0, title: 0, length: 0 }
  const freeEntries = new Set(entries.map((entry) => entry.index))
  const freeFiles = new Set(files.map((_, position) => position))
  const take = (entry: PlaylistEntry, position: number, method: MatchMethod): void => {
    freeEntries.delete(entry.index)
    freeFiles.delete(position)
    matched[method] += 1
  }

  // 1. The ID written in the file.
  const byId = new Map<string, number[]>()
  files.forEach((file, position) => {
    if (!file.videoId) return
    byId.set(file.videoId, [...(byId.get(file.videoId) ?? []), position])
  })
  for (const entry of entries) {
    const position = (byId.get(entry.id) ?? []).find((candidate) => freeFiles.has(candidate))
    if (position !== undefined) take(entry, position, 'id')
  }

  // 2. The title. When several tracks share a title, the closest lengths are paired first.
  const stems = files.map((file) => foldTitle(stemOfName(file.name)))
  const pairs: { entry: PlaylistEntry; position: number; gap: number }[] = []
  for (const entry of entries) {
    if (!freeEntries.has(entry.index)) continue
    const wanted = foldTitle([...entry.title].slice(0, TITLE_LIMIT).join(''))
    if (wanted === '') continue
    for (const position of freeFiles) {
      // A file of another video has its own ID: it is not this one.
      const other = files[position].videoId
      if (other && other !== entry.id) continue
      if (stems[position] !== wanted) continue
      pairs.push({ entry, position, gap: distance(files[position].durationSec, entry.durationSec) })
    }
  }
  pairs.sort((a, b) => a.gap - b.gap || a.entry.index - b.entry.index || a.position - b.position)
  for (const { entry, position } of pairs) {
    if (freeEntries.has(entry.index) && freeFiles.has(position)) take(entry, position, 'title')
  }

  // 3. The length, when it points to one file and one track only.
  const candidatesOfEntry = new Map<number, number[]>()
  const candidatesOfFile = new Map<number, number[]>()
  for (const entry of entries) {
    if (!freeEntries.has(entry.index)) continue
    for (const position of freeFiles) {
      if (files[position].videoId) continue
      if (!near(files[position].durationSec, entry.durationSec)) continue
      candidatesOfEntry.set(entry.index, [...(candidatesOfEntry.get(entry.index) ?? []), position])
      candidatesOfFile.set(position, [...(candidatesOfFile.get(position) ?? []), entry.index])
    }
  }
  for (const entry of entries) {
    const positions = candidatesOfEntry.get(entry.index)
    if (!positions || positions.length !== 1) continue
    const position = positions[0]
    if (candidatesOfFile.get(position)?.length !== 1) continue
    take(entry, position, 'length')
  }

  const missing = entries
    .filter((entry) => freeEntries.has(entry.index))
    .map((entry) => ({ ...entry, unavailable: isUnavailableTitle(entry.title) }))
  return {
    playlistTotal: entries.length,
    matched,
    missing,
    extraFiles: [...freeFiles].sort((a, b) => a - b).map((position) => files[position].name),
    folderMissing
  }
}

/** A length like 3:07, or 1:02:09. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return ''
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const two = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`
}
