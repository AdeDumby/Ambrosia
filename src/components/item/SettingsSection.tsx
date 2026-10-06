import type { ReactNode } from 'react'
import './SettingsSection.css'

type Props = {
  title: string
  description?: string
  children: ReactNode
}

export default function SettingsSection({ title, description, children }: Props) {
  return (
    <section className="settings-section">
      <h2 className="settings-section-title">{title}</h2>
      {description && <p className="settings-section-description">{description}</p>}
      <div className="settings-section-body">{children}</div>
    </section>
  )
}
