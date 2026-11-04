import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import ffprobe from '@ffprobe-installer/ffprobe'

const run = promisify(execFile)
const ffprobePath = ffprobe.path.replace('app.asar', 'app.asar.unpacked')

export async function probeDuration(file: string): Promise<number> {
  try {
    const { stdout } = await run(
      ffprobePath,
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

export type FileInfo = { durationSec: number | null; videoId: string | null }

export async function probeFileInfo(file: string): Promise<FileInfo> {
  try {
    const { stdout } = await run(
      ffprobePath,
      ['-v', 'error', '-show_entries', 'format=duration:format_tags', '-of', 'json', file],
      { timeout: 30_000 }
    )
    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string; tags?: Record<string, string> }
    }
    const duration = Number(parsed.format?.duration)
    const tags = parsed.format?.tags ?? {}
    const key = Object.keys(tags).find((name) => name.toLowerCase().endsWith('ambrosia_id'))
    const id = key ? tags[key].trim() : ''
    return {
      durationSec: Number.isFinite(duration) ? duration : null,
      videoId: id === '' ? null : id
    }
  } catch {
    return { durationSec: null, videoId: null }
  }
}
