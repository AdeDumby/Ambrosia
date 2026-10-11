export const MAX_FILE_STEM = 150

export function splitFileName(filename: string): { stem: string; ext: string } {
  const dot = filename.lastIndexOf('.')
  return dot > 0
    ? { stem: filename.slice(0, dot), ext: filename.slice(dot) }
    : { stem: filename, ext: '' }
}
