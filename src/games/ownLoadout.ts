import type { GuidelessGameDefinition } from '@tastic/shell'

// Home opens a game's setup screen when the game has a useLoadout. These games have one, but it's the
// pack's own page (LoadoutScreen, at app/loadout/[game].tsx): each player keeps their own art, packs and
// difficulty, and Pass & Play seats up to eight, which the shell's two-seat loadout doesn't do. So the
// shell's hook is never called.
export const OWN_LOADOUT: NonNullable<GuidelessGameDefinition['useLoadout']> = () => {
  throw new Error('This game has its own setup screen (see app/loadout/[game].tsx)')
}
