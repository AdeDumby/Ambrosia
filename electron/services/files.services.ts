import { copyFile, open, rename, unlink } from 'node:fs/promises'
import path from 'node:path'

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
