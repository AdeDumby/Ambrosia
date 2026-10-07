import type { ReactNode } from 'react'
import type { ScanReport } from '../../shared/types'
import './ScanReportView.css'

const MAX_ROWS = 50

type Props = {
  report: ScanReport
}

function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) {
    return (
      <div className="scan-group empty">
        <span>{title}</span>
        <span>0</span>
      </div>
    )
  }

  return (
    <details className="scan-group">
      <summary>
        <span>{title}</span>
        <span>{count}</span>
      </summary>
      <ul className="scan-list">{children}</ul>
    </details>
  )
}

function More({ total }: { total: number }) {
  if (total <= MAX_ROWS) return null
  return <li className="scan-more">...and {total - MAX_ROWS} more</li>
}

export default function ScanReportView({ report }: Props) {
  return (
    <div className="scan-report">
      <p className="scan-summary">
        Preview only, nothing was changed. {report.filesFound} audio files found in the library
        folder, {report.alreadyKnown} already known.
      </p>

      {!report.libraryFolderExists && (
        <p className="scan-warning" role="alert">
          The library folder does not exist, so no new files were looked for.
        </p>
      )}

      <Group title="New files to add" count={report.toAdd.length}>
        {report.toAdd.slice(0, MAX_ROWS).map((file) => (
          <li key={file.path}>
            {file.filename}
            {file.franchise && <span className="scan-badge">{file.franchise}</span>}
            <span className="scan-path">{file.path}</span>
          </li>
        ))}
        <More total={report.toAdd.length} />
      </Group>

      <Group title="New franchise tags to create" count={report.franchisesToCreate.length}>
        {report.franchisesToCreate.slice(0, MAX_ROWS).map((name) => (
          <li key={name}>{name}</li>
        ))}
        <More total={report.franchisesToCreate.length} />
      </Group>
      {!report.franchiseFolderFound && report.franchisesToCreate.length > 0 && (
        <p className="scan-warning">
          There is no Franchise folder, so these tags would be created without a folder.
        </p>
      )}

      <Group title="Tracks whose file is missing" count={report.missing.length}>
        {report.missing.slice(0, MAX_ROWS).map((track) => (
          <li key={track.id}>
            {track.filename}
            {track.deleted && <span className="scan-badge">deleted</span>}
            <span className="scan-path">{track.path}</span>
          </li>
        ))}
        <More total={report.missing.length} />
      </Group>

      <Group title="Problems" count={report.problems.length}>
        {report.problems.slice(0, MAX_ROWS).map((problem) => (
          <li key={problem.path}>
            {problem.path}
            <span className="scan-path">{problem.message}</span>
          </li>
        ))}
        <More total={report.problems.length} />
      </Group>
    </div>
  )
}
