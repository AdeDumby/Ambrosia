import CheckboxField from '../item/CheckboxField'
import SettingsSection from '../item/SettingsSection'
import { useLibrary } from '../../store/LibraryContext'
import { useSettings } from '../../store/SettingsContext'

export default function ReviewSettings() {
  const { categories } = useLibrary()
  const { settings, updateReview } = useSettings()
  const hidden = new Set(settings.review.hiddenFolders.map((name) => name.toLowerCase()))

  function setHidden(name: string, hide: boolean) {
    const others = settings.review.hiddenFolders.filter(
      (existing) => existing.toLowerCase() !== name.toLowerCase()
    )
    updateReview({ hiddenFolders: hide ? [...others, name] : others })
  }

  return (
    <SettingsSection title="Tag folders showed on the Review page">
      {categories.length === 0 && <p>No folders yet.</p>}
      {categories.map((category) => (
        <CheckboxField
          key={category.id}
          label={category.name}
          color={category.color}
          checked={hidden.has(category.name.toLowerCase())}
          onChange={(checked) => setHidden(category.name, checked)}
        />
      ))}
    </SettingsSection>
  )
}
