import type { DatabaseSync } from 'node:sqlite'
import type { AnalysisInput, PendingAnalysis } from '../../src/shared/types.ts'

export function listPendingAnalysis(db: DatabaseSync): PendingAnalysis[] {
  return db
    .prepare(
      `SELECT id, filename, duration_sec AS durationSec
       FROM track
       WHERE deleted = 0 AND loudness_lufs IS NULL AND analysis_error IS NULL
       ORDER BY id`
    )
    .all() as unknown as PendingAnalysis[]
}

export function saveAnalysis(db: DatabaseSync, id: number, input: AnalysisInput): void {
  if (input.ok && Number.isFinite(input.integrated)) {
    db.prepare(
      `UPDATE track
       SET loudness_lufs = ?, loudness_peak = ?, loudness_curve = ?,
           analysis_error = NULL, analyzed_at = datetime('now')
       WHERE id = ?`
    ).run(input.integrated, input.peak, JSON.stringify(input.curve), id)
    return
  }

  const message = input.ok ? 'Silent: no measurable loudness' : input.message
  db.prepare(
    `UPDATE track
     SET loudness_lufs = NULL, loudness_peak = NULL, loudness_curve = NULL,
         analysis_error = ?, analyzed_at = datetime('now')
     WHERE id = ?`
  ).run(message, id)
}

export function clearAnalysisErrors(db: DatabaseSync): void {
  db.prepare(
    `UPDATE track SET analysis_error = NULL, analyzed_at = NULL
     WHERE analysis_error IS NOT NULL AND loudness_lufs IS NULL`
  ).run()
}
