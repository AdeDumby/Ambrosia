import type { Segment } from '../../lib/renameRules'
import type { NameProblem } from '../../shared/download'
import './RenameList.css'

export type RenameRow = {
  index: number
  original: string
  segments: Segment[]
  name: string
  ext: string
  manual: boolean
  problem: NameProblem | undefined
}

type Props = {
  rows: RenameRow[]
  onEdit: (index: number, value: string) => void
  onReset: (index: number) => void
}

const PROBLEM_TEXT: Record<NameProblem, string> = {
  empty: 'The name cannot be empty.',
  invalid: 'That name has characters Windows does not allow.',
  duplicate: 'Another track has the same name.',
  exists: 'A file with that name is already in the folder.'
}

export default function RenameList({ rows, onEdit, onReset }: Props) {
  return (
    <ul className="rename-list">
      {rows.map((row) => (
        <li key={row.index} className={`rename-row ${row.problem ? 'problem' : ''}`}>
          <span className="rename-original" title={row.original}>
            {row.segments.map((segment, position) =>
              segment.hit ? (
                <mark key={position}>{segment.text}</mark>
              ) : (
                <span key={position}>{segment.text}</span>
              )
            )}
          </span>
          <div className={`rename-edit ${row.manual ? 'manual' : ''}`}>
            <input
              type="text"
              value={row.name}
              aria-label={`New name for ${row.original}`}
              aria-invalid={row.problem !== undefined}
              onChange={(event) => onEdit(row.index, event.target.value)}
            />
            <span className="rename-ext">{row.ext}</span>
            {row.manual && (
              <button
                type="button"
                className="rename-reset"
                title="Give control back to the rules"
                aria-label={`Give control back to the rules for ${row.original}`}
                onClick={() => onReset(row.index)}
              >
                ↺
              </button>
            )}
          </div>
          {row.problem && (
            <span className="rename-problem" role="alert">
              {PROBLEM_TEXT[row.problem]}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}
