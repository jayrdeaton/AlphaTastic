import { useThemeSettings } from '@rific/auto-paper'
import { ProfilesRoute } from '@tastic/shell'
import { JSX } from 'react'

import { HarmonySwatches } from '@/components/PlayerSwatches'

// The shell's Profiles screen, its color picker drawing each swatch as the palette it gives, in the
// active player's harmony. A deleted profile is forgotten by PlayerRoster (hooks/useProfiles.tsx).
const ProfilesPage = (): JSX.Element => {
  const { settings } = useThemeSettings()
  return (
    <HarmonySwatches harmony={settings.harmony}>
      <ProfilesRoute />
    </HarmonySwatches>
  )
}

export default ProfilesPage
