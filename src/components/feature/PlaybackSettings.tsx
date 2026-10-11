import CheckboxField from '../item/CheckboxField'
import SettingsSection from '../item/SettingsSection'
import SliderField from '../item/SliderField'
import { LOUDNESS_MAX, LOUDNESS_MIN, LOUDNESS_PRESETS } from '../../shared/settings'
import { useLibrary } from '../../store/LibraryContext'
import { usePlayer } from '../../store/PlayerContext'
import { useSettings } from '../../store/SettingsContext'

export default function PlaybackSettings() {
  const { settings, updatePlayback } = useSettings()
  const { setVolume } = usePlayer()
  const { tracks } = useLibrary()
  const { defaultVolume, normalize, targetLufs } = settings.playback
  const unmeasured = tracks.filter((track) => track.loudnessLufs === null).length

  function changeDefaultVolume(value: number) {
    updatePlayback({ defaultVolume: value })
    setVolume(value)
  }

  return (
    <SettingsSection
      title="Playback"
      description="The volume the app starts with, and how loud tracks should play. The slider in the player bar only lasts until you close or reload the app."
    >
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
        label="Normalize volume, so every track plays at about the same loudness"
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

      <p className="settings-hint">
        Louder tracks are turned down and quieter ones are turned up, never past the point where
        they would distort. Changes apply to the track playing right now.
        {unmeasured > 0 &&
          ` ${unmeasured} tracks have no measured loudness yet and play unchanged. Use Analyze loudness in the Library section.`}
      </p>
    </SettingsSection>
  )
}
