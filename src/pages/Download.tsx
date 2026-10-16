import { useEffect, useMemo, useState } from 'react'
import RenameList, { type RenameRow } from '../components/feature/RenameList'
import RuleEditor from '../components/feature/RuleEditor'
import InlineError from '../components/item/InlineError'
import { errorMessage } from '../lib/errors'
import { compileRules, matchRanges, runStages, splitByRanges } from '../lib/renameRules'
import {
  checkFranchise,
  checkUrl,
  findNameProblems,
  MAX_FRANCHISE_NAME,
  splitName,
  type FinishResult
} from '../shared/download'
import { useDownload } from '../store/DownloadContext'
import './Download.css'

const STATUS_TEXT = {
  downloading: 'Downloading',
  converting: 'Converting',
  done: 'Done',
  failed: 'Failed'
}

const PHASE_TEXT = {
  downloaded: 'Downloads finished.',
  failed: 'The download failed.',
  cancelled: 'The download was cancelled.'
}

const basename = (file: string) => file.split(/[\\/]/).pop() ?? file

export default function Download() {
  const { state, start, cancel, reset, finish, rules, setRules, manual, setManual } = useDownload()
  const [franchise, setFranchise] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [folderNames, setFolderNames] = useState<Set<string>>(new Set())
  const [activeRuleId, setActiveRuleId] = useState<number | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [finished, setFinished] = useState<FinishResult | null>(null)

  const idle = state.phase === 'idle'
  const running = state.phase === 'downloading'
  const franchiseProblem = franchise.trim() === '' ? null : checkFranchise(franchise)
  const urlProblem = url.trim() === '' ? null : checkUrl(url)
  const canStart =
    idle && franchise.trim() !== '' && url.trim() !== '' && !franchiseProblem && !urlProblem

  const done = state.items.filter((item) => item.status === 'done').length
  const overall = state.total ? Math.round((done / state.total) * 100) : undefined

  useEffect(() => {
    if (!state.renameActive) return
    window.api
      .getDownloadFolderNames()
      .then((names) => setFolderNames(new Set(names.map((name) => name.toLowerCase()))))
      .catch(() => setFolderNames(new Set()))
  }, [state.renameActive])

  const compiled = useMemo(() => compileRules(rules), [rules])

  const staged = useMemo(
    () =>
      state.items
        .filter((item) => item.status === 'done' && item.path)
        .map((item) => {
          const file = basename(item.path ?? '')
          const { stem, ext } = splitName(file)
          return { index: item.index, file, stem, ext, stages: runStages(stem, compiled) }
        }),
    [state.items, compiled]
  )

  const counts = useMemo(
    () =>
      compiled.map((entry, step) =>
        entry.regex
          ? staged.filter((row) => matchRanges(row.stages[step], entry.regex as RegExp).length > 0)
              .length
          : 0
      ),
    [compiled, staged]
  )

  const activeIndex = compiled.findIndex((entry) => entry.rule.id === activeRuleId)
  const activeRegex = activeIndex >= 0 ? compiled[activeIndex].regex : null

  const rows: RenameRow[] = useMemo(() => {
    const own = new Set(staged.map((row) => row.file.toLowerCase()))
    const others = new Set([...folderNames].filter((name) => !own.has(name)))
    const named = staged.map((row) => ({
      row,
      name: manual[row.index] ?? row.stages[row.stages.length - 1]
    }))
    const problems = findNameProblems(
      named.map(({ row, name }) => ({
        index: row.index,
        path: row.file,
        newName: name.trim() === '' ? '' : name.trim() + row.ext
      })),
      others
    )

    return named.map(({ row, name }) => {
      const shown = activeRegex ? row.stages[activeIndex] : row.stem
      return {
        index: row.index,
        original: row.stem,
        segments: activeRegex
          ? splitByRanges(shown, matchRanges(shown, activeRegex))
          : splitByRanges(shown, []),
        name,
        ext: row.ext,
        manual: manual[row.index] !== undefined,
        problem: problems.get(row.index)
      }
    })
  }, [staged, manual, folderNames, activeRegex, activeIndex])

  const problemCount = rows.filter((row) => row.problem).length
  const changing = rows.filter((row) => row.name.trim() !== row.original).length

  function editName(index: number, value: string) {
    const row = staged.find((candidate) => candidate.index === index)
    const computed = row ? row.stages[row.stages.length - 1] : ''
    setManual((previous) => {
      const next = { ...previous }
      if (value === computed) delete next[index]
      else next[index] = value
      return next
    })
  }

  function resetName(index: number) {
    setManual((previous) => {
      const next = { ...previous }
      delete next[index]
      return next
    })
  }

  async function begin() {
    setError(null)
    setFinished(null)
    try {
      await start(franchise, url)
    } catch (failure) {
      setError(errorMessage(failure))
    }
  }

  async function run(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
    } catch (failure) {
      setError(errorMessage(failure))
    }
  }

  async function complete() {
    setError(null)
    setFinishing(true)
    try {
      setFinished(await finish(rows.map((row) => ({ index: row.index, name: row.name.trim() }))))
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setFinishing(false)
    }
  }

  return (
    <div className="download">
      {idle ? (
        <form
          className="download-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (canStart) void begin()
          }}
        >
          <label>
            <span>Franchise folder</span>
            <input
              type="text"
              value={franchise}
              maxLength={MAX_FRANCHISE_NAME}
              placeholder="FTL"
              onChange={(event) => setFranchise(event.target.value)}
            />
            {franchiseProblem && <small className="download-problem">{franchiseProblem}</small>}
          </label>
          <label>
            <span>YouTube playlist or video link</span>
            <input
              type="text"
              value={url}
              placeholder="https://www.youtube.com/playlist?list=..."
              onChange={(event) => setUrl(event.target.value)}
            />
            {urlProblem && <small className="download-problem">{urlProblem}</small>}
          </label>
          <button type="submit" className="btn btn-primary" disabled={!canStart}>
            Start download
          </button>
        </form>
      ) : (
        <div className="download-summary">
          <div>
            <strong>{state.franchise}</strong>
            <span className="download-folder">{state.folder}</span>
          </div>
          {running ? (
            <button type="button" className="btn" onClick={() => void run(cancel)}>
              Cancel
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => void run(reset)}>
              Start over
            </button>
          )}
        </div>
      )}

      {error && <InlineError message={error} onDismiss={() => setError(null)} />}

      {idle && finished && (
        <p className="settings-success" role="status">
          {finished.renamed} of {finished.total} tracks renamed in {finished.folder}. They are not
          in the library yet: use Scan library, then Apply changes in Settings.
        </p>
      )}

      {running && (
        <div className="download-overall">
          <progress max={100} value={overall} />
          <span>{state.total ? `${done} of ${state.total} tracks` : 'Starting...'}</span>
        </div>
      )}

      {!idle && !running && (
        <p
          className={
            state.phase === 'downloaded' && !state.error ? 'settings-success' : 'settings-error'
          }
        >
          {PHASE_TEXT[state.phase as keyof typeof PHASE_TEXT]} {state.error}
        </p>
      )}

      {state.renameActive ? (
        <>
          <section className="download-section">
            <h2>Rename rules</h2>
            <p className="download-hint">
              Each rule finds text with a regular expression and replaces it. Leave the right side
              empty to delete what it finds, and use $1 to reuse the first captured group. Rules run
              in order on the name without .mp3.
            </p>
            <RuleEditor
              rules={rules}
              compiled={compiled}
              counts={counts}
              total={staged.length}
              activeId={activeRuleId}
              onActivate={setActiveRuleId}
              onChange={setRules}
            />
          </section>

          <section className="download-section">
            <h2>Names</h2>
            <p className="download-hint">
              {activeIndex >= 0
                ? `Highlighted: what rule ${activeIndex + 1} captures, in the name as it reaches that rule.`
                : 'Click into a rule to see what it captures. Names you type yourself are left alone by the rules.'}
            </p>
            <RenameList rows={rows} onEdit={editName} onReset={resetName} />
          </section>

          <div className="download-finish">
            <button
              type="button"
              className="btn btn-primary"
              disabled={rows.length === 0 || problemCount > 0 || finishing}
              onClick={() => void complete()}
            >
              {finishing ? 'Renaming...' : 'Finish'}
            </button>
            <span className={problemCount > 0 ? 'download-problem' : 'download-hint'}>
              {problemCount > 0
                ? 'Fix the highlighted names first.'
                : `${changing} of ${rows.length} names will change.`}
            </span>
          </div>
        </>
      ) : (
        state.items.length > 0 && (
          <ul className="download-list">
            {state.items.map((item) => (
              <li key={item.index} className={`download-item ${item.status}`}>
                <span className="download-index">{item.index}</span>
                <span className="download-title" title={item.error ?? item.title}>
                  {item.title || 'Waiting for the title...'}
                  {item.error && <small className="download-problem"> {item.error}</small>}
                </span>
                {item.status === 'downloading' ? (
                  <progress max={100} value={item.percent} />
                ) : (
                  <span className="download-status">{STATUS_TEXT[item.status]}</span>
                )}
              </li>
            ))}
          </ul>
        )
      )}

      {state.log.length > 0 && (
        <details className="download-details">
          <summary>Details</summary>
          <pre>{state.log.join('\n')}</pre>
        </details>
      )}
    </div>
  )
}
