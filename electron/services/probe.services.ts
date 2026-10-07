import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import ffprobe from '@ffprobe-installer/ffprobe'

const run = promisify(execFile)

export async function probeDuration(file: string): Promise<number> {
  try {
    const { stdout } = await run(
      ffprobe.path,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file],
      { timeout: 30_000 }
    )
    const parsed = JSON.parse(stdout) as { format?: { duration?: string } }
    const duration = Number(parsed.format?.duration)
    if (!Number.isFinite(duration)) throw new Error('No duration found in this file')
    return duration
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr
    const firstLine = stderr?.trim().split('\n')[0]
    throw new Error(firstLine || (error instanceof Error ? error.message : String(error)))
  }
}
