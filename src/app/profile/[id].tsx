import { useThemeSettings } from '@rific/auto-paper'
import { EditProfileRoute } from '@tastic/shell'
import { useLocalSearchParams } from 'expo-router'
import { JSX } from 'react'
import { useSelector } from 'react-redux'

import { HarmonySwatches } from '@/components/PlayerSwatches'
import { DEFAULT_HARMONY } from '@/redux/playerThemeSlice'
import type { RootState } from '@/redux/store'

// One profile's Edit Profile screen, the shell's, which Profiles pushes with the profile's id or 'new' and
// Settings' Profile row opens for the active profile. Its Color grid draws each swatch as the palette it
// gives that profile: in their own harmony (the live one while they're playing, the one they last picked
// otherwise, the default for a new profile). A deletion here is forgotten by PlayerRoster
// (hooks/useProfiles.tsx), as one made anywhere.
const EditProfilePage = (): JSX.Element => {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { settings } = useThemeSettings()
  const kept = useSelector((state: RootState) => (state.activePlayer.profileId === id ? null : (state.playerTheme[id]?.harmony ?? DEFAULT_HARMONY)))
  return (
    <HarmonySwatches harmony={kept ?? settings.harmony}>
      <EditProfileRoute />
    </HarmonySwatches>
  )
}

export default EditProfilePage
