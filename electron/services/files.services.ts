import { copyFile, open, rename, stat, unlink } from 'node:fs/promises'
import path from 'node:path'

type Move = { from: string; to: string }

const lower = (file: string) => path.resolve(file).toLowerCase()

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return false
    throw error
  }
}

async function reserveName(folder: string, fileName: string): Promise<string> {
  const { name, ext } = path.parse(fileName)
  for (let attempt = 1; attempt < 10_000; attempt += 1) {
    const candidate = path.join(folder, attempt === 1 ? fileName : `${name} (${attempt})${ext}`)
    try {
      const handle = await open(candidate, 'wx')
      await handle.close()
      return candidate
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }
  throw new Error('Could not find a free file name')
}

export async function moveFileUnique(
  source: string,
  folder: string,
  fileName: string = path.basename(source)
): Promise<string> {
  const target = await reserveName(folder, fileName)
  try {
    try {
      await rename(source, target)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error
      await copyFile(source, target)
      await unlink(source)
    }
    return target
  } catch (error) {
    await unlink(target).catch(() => {})
    throw error
  }
}

export async function renameAll(moves: Move[]): Promise<void> {
  const sources = new Set(moves.map((move) => lower(move.from)))
  if (sources.size !== moves.length) throw new Error('Two tracks point at the same file.')

  for (const move of moves) {
    if (!(await exists(move.from))) {
      throw new Error(`A file is missing: ${path.basename(move.from)}`)
    }
    const target = lower(move.to)
    const vacated = target === lower(move.from) || sources.has(target)
    if (!vacated && (await exists(move.to))) {
      throw new Error(`A file named ${path.basename(move.to)} already exists in the folder.`)
    }
  }

  const chained = moves.filter((move) => {
    const target = lower(move.to)
    return target !== lower(move.from) && sources.has(target)
  })
  const direct = moves.filter((move) => !chained.includes(move))

  const performed: Move[] = []
  const step = async (from: string, to: string): Promise<void> => {
    await rename(from, to)
    performed.push({ from, to })
  }

  const temps = new Map<Move, string>()
  try {
    for (const [index, move] of chained.entries()) {
      const temp = path.join(
        path.dirname(move.from),
        `.ambrosia-rename-${process.pid}-${index}.tmp`
      )
      temps.set(move, temp)
      await step(move.from, temp)
    }
    for (const move of direct) await step(move.from, move.to)
    for (const move of chained) await step(temps.get(move) as string, move.to)
  } catch (error) {
    const stuck: string[] = []
    for (const move of [...performed].reverse()) {
      try {
        await rename(move.to, move.from)
      } catch {
        stuck.push(path.basename(move.to))
      }
    }
    if (stuck.length > 0) {
      throw new Error(
        `Renaming failed, and ${stuck.length} file(s) could not be put back: ${stuck.join(', ')}.`
      )
    }
    throw error
  }
}
