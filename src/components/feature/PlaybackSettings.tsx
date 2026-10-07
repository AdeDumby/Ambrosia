import SettingsSection from '../item/SettingsSection'
import SliderField from '../item/SliderField'
import { usePlayer } from '../../store/PlayerContext'
import { useSettings } from '../../store/SettingsContext'

export default function PlaybackSettings() {
  const { settings, updatePlayback } = useSettings()
  const { setVolume } = usePlayer()

  function changeDefaultVolume(value: number) {
    updatePlayback({ defaultVolume: value })
    setVolume(value)
  }

  return (
    <SettingsSection
      title="Playback"
      description="The volume the app starts with. The slider in the player bar only lasts until you close or reload the app."
    >
      <SliderField
        label="Default volume"
        value={settings.playback.defaultVolume}
        min={0}
        max={1}
        step={0.01}
        format={(value) => `${Math.round(value * 100)}%`}
        onChange={changeDefaultVolume}
      />
    </SettingsSection>
  )
}
