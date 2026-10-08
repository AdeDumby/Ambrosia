import SettingsSection from '../item/SettingsSection'
import SliderField from '../item/SliderField'
import { useSettings } from '../../store/SettingsContext'
import { BATCH_SIZE_MAX, BATCH_SIZE_MIN, BATCH_SIZE_STEP } from '../../shared/settings'

export default function TrackListSettings() {
  const { settings, updateList } = useSettings()

  return (
    <SettingsSection
      title="Track list"
      description="How many tracks the Library page draws at first, and adds each time you scroll near the end. A higher number means fewer pauses while scrolling, but sorting and searching take longer."
    >
      <SliderField
        label="Tracks at a time"
        value={settings.list.batchSize}
        min={BATCH_SIZE_MIN}
        max={BATCH_SIZE_MAX}
        step={BATCH_SIZE_STEP}
        format={(value) => String(value)}
        onChange={(batchSize) => updateList({ batchSize })}
      />
    </SettingsSection>
  )
}
