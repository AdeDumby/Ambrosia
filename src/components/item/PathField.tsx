import type { ReactNode } from 'react'
import './PathField.css'

type Props = {
  label: string
  path: string | null
  children?: ReactNode
}

export default function PathField({ label, path, children }: Props) {
  return (
    <div className="path-field">
      <span className="path-field-label">{label}</span>
      <code className="path-field-value" title={path ?? undefined}>
        {path ?? '...'}
      </code>
      {children && <div className="path-field-actions">{children}</div>}
    </div>
  )
}
