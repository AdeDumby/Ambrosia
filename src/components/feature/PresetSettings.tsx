import { useState } from 'react'
import SettingsSection from '../item/SettingsSection'
import { usePlayer } from '../../store/PlayerContext'
import { useSettings } from '../../store/SettingsContext'
import {
  BUILT_IN_PRESETS,
  MAX_PRESET_NAME,
  MAX_PRESETS,
  presetMatches,
  type Preset
} from '../../shared/settings'

export default function PresetSettings() {
  const { settings, applyPreset, savePreset, deletePreset } = useSettings()
  const { setVolume } = usePlayer()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const saved = settings.presets
  const all = [...BUILT_IN_PRESETS, ...saved]

  function apply(preset: Preset) {
    applyPreset(preset)
    if (preset.defaultVolume !== undefined) setVolume(preset.defaultVolume)
  }

  function save() {
    const trimmed = name.trim()
    const key = trimmed.toLowerCase()
    if (trimmed === '') return setError('Give the preset a name.')
    if (trimmed.length > MAX_PRESET_NAME) {
      return setError(`Use at most ${MAX_PRESET_NAME} characters.`)
    }
    if (BUILT_IN_PRESETS.some((preset) => preset.name.toLowerCase() === key)) {
      return setError('That name belongs to a built-in preset.')
    }
    const replacing = saved.some((preset) => preset.name.toLowerCase() === key)
    if (!replacing && saved.length >= MAX_PRESETS) {
      return setError(`You can keep at most ${MAX_PRESETS} presets.`)
    }

    savePreset(trimmed)
    setName('')
    setError(null)
  }

  return (
    <SettingsSection title="Presets">
      {all.map((preset) => {
        const isActive = preset.name === settings.activePreset
        const builtIn = BUILT_IN_PRESETS.includes(preset)
        const swatches = [
          preset.appearance.pageBackground,
          preset.appearance.panelBackground,
          preset.appearance.borderColor,
          preset.appearance.accentColor
        ]

        return (
          <div className="preset-row" key={preset.name}>
            <span className="preset-swatches" aria-hidden="true">
              {swatches.map((swatch, index) => (
                <span key={index} style={{ backgroundColor: swatch }} />
              ))}
            </span>
            <span className="preset-name">{preset.name}</span>
            {isActive && (
              <span className="preset-badge">
                {presetMatches(settings, preset) ? 'Applied' : 'Applied, modified'}
              </span>
            )}
            <button type="button" className="btn" onClick={() => apply(preset)}>
              Apply
            </button>
            {!builtIn && (
              <button type="button" className="btn" onClick={() => deletePreset(preset.name)}>
                Delete
              </button>
            )}
          </div>
        )
      })}

      <div className="preset-save">
        <input
          type="text"
          value={name}
          maxLength={MAX_PRESET_NAME}
          placeholder="Name for the current settings"
          aria-label="Preset name"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') save()
          }}
        />
        <button type="button" className="btn btn-primary" onClick={save}>
          Save current settings
        </button>
      </div>
      {error && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}
    </SettingsSection>
  )
}
