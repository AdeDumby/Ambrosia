import { execFile } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { DatabaseSync } from 'node:sqlite'
import ffprobe from '@ffprobe-installer/ffprobe'

const run = promisify(execFile)
const args = process.argv.slice(2)
const checkAll = args.includes('--all')
const dbArgument = args.find((argument) => !argument.startsWith('--'))
const dbFile = dbArgument ?? path.join(process.env.APPDATA ?? '', 'ambrosia', 'ambrosia.db')

const SAMPLE_SIZE = 40
const TOLERANCE_SECONDS = 0.5

if (!existsSync(dbFile)) {
  console.error(`Database not found: ${dbFile}`)
  console.error('Pass the path as an argument.')
  process.exit(1)
}

const db = new DatabaseSync(dbFile, { readOnly: true })
const tracks = db
  .prepare(
    `SELECT id, path, filename, duration_sec AS duration, size_bytes AS size
     FROM track WHERE deleted = 0 ORDER BY id`
  )
  .all()

const step = Math.ceil(tracks.length / SAMPLE_SIZE)
const picked = checkAll ? tracks : tracks.filter((_, index) => index % step === 0)

async function probeDuration(file) {
  const { stdout } = await run(ffprobe.path, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'json',
    file
  ])
  const duration = Number(JSON.parse(stdout).format?.duration)
  if (!Number.isFinite(duration)) throw new Error('no duration in the ffprobe output')
  return duration
}

console.log(`Database: ${dbFile}`)
console.log(`ffprobe:  ${ffprobe.path}`)
console.log(`Checking ${picked.length} of ${tracks.length} tracks\n`)
console.log('  stored     ffprobe    diff     size  file')

let errors = 0
let overTolerance = 0
let sizeMismatches = 0
let largestDiff = 0

for (const track of picked) {
  const name = track.filename.slice(0, 55)
  try {
    const duration = await probeDuration(track.path)
    const diff = duration - track.duration
    const sizeOk = statSync(track.path).size === track.size

    largestDiff = Math.max(largestDiff, Math.abs(diff))
    if (Math.abs(diff) > TOLERANCE_SECONDS) overTolerance += 1
    if (!sizeOk) sizeMismatches += 1

    console.log(
      `${track.duration.toFixed(3).padStart(9)}  ${duration.toFixed(3).padStart(9)}  ` +
        `${diff.toFixed(3).padStart(7)}  ${sizeOk ? 'ok  ' : 'DIFF'}  ${name}`
    )
  } catch (error) {
    errors += 1
    console.log(`ERROR  ${name}: ${error.message}`)
  }
}

console.log('')
console.log(`Errors: ${errors}`)
console.log(`Duration difference above ${TOLERANCE_SECONDS}s: ${overTolerance}`)
console.log(`Largest duration difference: ${largestDiff.toFixed(3)}s`)
console.log(`Files whose size differs from the database: ${sizeMismatches}`)
