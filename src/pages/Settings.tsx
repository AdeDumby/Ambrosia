import ColorField from '../components/item/ColorField'
import SegmentedControl from '../components/item/SegmentedControl'
import SettingsSection from '../components/item/SettingsSection'
import { useSettings } from '../store/SettingsContext'
import type { Density } from '../shared/settings'
import './Settings.css'

const densityOptions: { value: Density; label: string }[] = [
  { value: 'spacey', label: 'Spacey' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' }
]

export default function Settings() {
  const { settings, updateAppearance, resetAppearance } = useSettings()
  const { appearance } = settings

  return (
    <div className="settings">
      <SettingsSection
        title="Appearance"
        description="Changes apply immediately and are saved automatically."
      >
        <ColorField
          label="Accent color"
          value={appearance.accentColor}
          onChange={(accentColor) => updateAppearance({ accentColor })}
        />

        <div className="settings-row">
          <span>Layout density</span>
          <SegmentedControl<Density>
            label="Layout density"
            value={appearance.density}
            onChange={(density) => updateAppearance({ density })}
            options={densityOptions}
          />
        </div>

        <ColorField
          label="Page background"
          value={appearance.pageBackground}
          onChange={(pageBackground) => updateAppearance({ pageBackground })}
        />
        <ColorField
          label="Panels"
          value={appearance.panelBackground}
          onChange={(panelBackground) => updateAppearance({ panelBackground })}
        />
        <ColorField
          label="Raised and hover panels"
          value={appearance.raisedBackground}
          onChange={(raisedBackground) => updateAppearance({ raisedBackground })}
        />
        <ColorField
          label="Borders"
          value={appearance.borderColor}
          onChange={(borderColor) => updateAppearance({ borderColor })}
        />

        <button type="button" className="btn settings-reset" onClick={resetAppearance}>
          Reset to default
        </button>
      </SettingsSection>
    </div>
  )
}
