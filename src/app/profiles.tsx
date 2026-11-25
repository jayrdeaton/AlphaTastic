import { ProfilesRoute } from '@tastic/shell'

// The shell's Profiles screen: the roster alone, each profile (or New Profile) opening its own Edit
// Profile screen (profile/[id].tsx), where its color is picked. A deleted profile is forgotten by
// PlayerRoster (hooks/useProfiles.tsx).
export default ProfilesRoute
