import { MAX_RULES, RULE_PRESETS, type CompiledRule, type RenameRule } from '../../lib/renameRules'
import './RuleEditor.css'

type Props = {
  rules: RenameRule[]
  compiled: CompiledRule[]
  counts: number[]
  total: number
  activeId: number | null
  onActivate: (id: number | null) => void
  onChange: (rules: RenameRule[]) => void
}

export default function RuleEditor({
  rules,
  compiled,
  counts,
  total,
  activeId,
  onActivate,
  onChange
}: Props) {
  const nextId = rules.reduce((max, rule) => Math.max(max, rule.id), 0) + 1
  const full = rules.length >= MAX_RULES

  function update(id: number, patch: Partial<RenameRule>) {
    onChange(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)))
  }

  function add(rule: Omit<RenameRule, 'id'>) {
    if (!full) onChange([...rules, { ...rule, id: nextId }])
  }

  return (
    <div className="rule-editor">
      <ul className="rule-list">
        {rules.map((rule, index) => {
          const { error } = compiled[index]
          return (
            <li key={rule.id} className={`rule ${activeId === rule.id ? 'active' : ''}`}>
              <span className="rule-number">{index + 1}</span>
              <input
                type="text"
                value={rule.find}
                placeholder="Find (regex)"
                aria-label={`Rule ${index + 1}: find`}
                spellCheck={false}
                onFocus={() => onActivate(rule.id)}
                onChange={(event) => update(rule.id, { find: event.target.value })}
              />
              <span aria-hidden="true">→</span>
              <input
                type="text"
                value={rule.replace}
                placeholder="(delete)"
                aria-label={`Rule ${index + 1}: replace with`}
                spellCheck={false}
                onFocus={() => onActivate(rule.id)}
                onChange={(event) => update(rule.id, { replace: event.target.value })}
              />
              <label className="rule-case" title="Ignore upper and lower case">
                <input
                  type="checkbox"
                  checked={rule.ignoreCase}
                  onChange={(event) => update(rule.id, { ignoreCase: event.target.checked })}
                />
                Aa
              </label>
              <button
                type="button"
                className="rule-remove"
                aria-label={`Remove rule ${index + 1}`}
                onClick={() => onChange(rules.filter((other) => other.id !== rule.id))}
              >
                ×
              </button>
              <span className={`rule-note ${error ? 'error' : ''}`}>
                {error ??
                  (rule.find === ''
                    ? 'Type a pattern to see what it captures.'
                    : `Matches ${counts[index]} of ${total} names.`)}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="rule-presets">
        <button
          type="button"
          className="rule-preset"
          disabled={full}
          onClick={() => add({ find: '', replace: '', ignoreCase: false })}
        >
          + Empty rule
        </button>
        {RULE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="rule-preset"
            disabled={full}
            onClick={() => add(preset)}
          >
            + {preset.label}
          </button>
        ))}
      </div>
    </div>
  )
}
