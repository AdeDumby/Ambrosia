import CheckboxField from '../item/CheckboxField'
import SettingsSection from '../item/SettingsSection'
import SliderField from '../item/SliderField'
import { LOUDNESS_MAX, LOUDNESS_MIN, LOUDNESS_PRESETS } from '../../shared/settings'
import { usePlayer } from '../../store/PlayerContext'
import { useSettings } from '../../store/SettingsContext'

export default function PlaybackSettings() {
  const { settings, updatePlayback } = useSettings()
  const { setVolume } = usePlayer()
  const { defaultVolume, normalize, targetLufs } = settings.playback

  function changeDefaultVolume(value: number) {
    updatePlayback({ defaultVolume: value })
    setVolume(value)
  }

  return (
    <SettingsSection title="Playback">
      <SliderField
        label="Default volume"
        value={defaultVolume}
        min={0}
        max={1}
        step={0.01}
        format={(value) => `${Math.round(value * 100)}%`}
        onChange={changeDefaultVolume}
      />

      <CheckboxField
        label="Normalize volume"
        checked={normalize}
        onChange={(checked) => updatePlayback({ normalize: checked })}
      />

      <SliderField
        label="Target loudness"
        value={targetLufs}
        min={LOUDNESS_MIN}
        max={LOUDNESS_MAX}
        step={1}
        ticks={LOUDNESS_PRESETS}
        disabled={!normalize}
        format={(value) => `${value} LUFS`}
        onChange={(value) => updatePlayback({ targetLufs: value })}
      />
    </SettingsSection>
  )
}
