import type { Profile } from '@tastic/profile'
import { useProfiles as useShellProfiles } from '@tastic/shell'
import { useEffect, useMemo, useRef } from 'react'
import { useDispatch, useSelector, useStore } from 'react-redux'

import { activePlayerActions } from '@/redux/activePlayerSlice'
import type { AppDispatch, RootState } from '@/redux/store'

import { usePlayerData } from './usePlayerData'

export type ProfilesActions = {
  // Who is playing: a profile, a Pass & Play guest seat's guest, or Single Player's guest.
  selectPlayer: (profileId: string | null, seatId?: string | null) => void
}

// The fleet's shared roster, which the shell keeps in step with the other games (its ProfilesProvider).
export const useProfiles = (): Profile[] => useSelector((state: RootState) => state.profiles)

export const selectProfile = (state: RootState, profileId: string | null): Profile | null => (profileId ? (state.profiles.find((profile) => profile.id === profileId) ?? null) : null)

export const useActiveProfile = (): Profile | null => useSelector((state: RootState) => selectProfile(state, state.activePlayer.profileId))

export const useProfilesActions = (): ProfilesActions => {
  const dispatch = useDispatch<AppDispatch>()
  const { colorGuestSeats } = usePlayerData()
  return useMemo(
    () => ({
      // A guest seat is given its starting colors first, so Theme's PlayerThemeSync never files the
      // colors already on screen as the seat's own.
      selectPlayer: (profileId, seatId = null) => {
        if (!profileId && seatId) colorGuestSeats()
        dispatch(activePlayerActions.setActivePlayer(profileId, seatId))
      }
    }),
    [dispatch, colorGuestSeats]
  )
}

// The shell's seat 1 is whoever is playing here. Its Settings' Profile row (Home's and the setup pages')
// names seat 1's profile and opens their Edit Profile, or Profiles while a guest plays; AlphaTastic keeps
// who's playing in its own activePlayer slice (a profile or one of several guests), so the profile is
// mirrored into the shell's selection, and any guest is its Guest (null). Nothing else of the shell's
// reads it here: Home's seat colors come back through the pack's seatTheme, which keeps what's on screen.
export const ShellSeatOne = (): null => {
  const { lastSelected, selectProfile: selectShellProfile } = useShellProfiles()
  const profileId = useSelector((state: RootState) => state.activePlayer.profileId)
  const seatOne = lastSelected[1]
  useEffect(() => {
    if (seatOne !== profileId) selectShellProfile(1, profileId)
  }, [profileId, seatOne, selectShellProfile])
  return null
}

// Everything kept per player follows the roster. A profile that leaves it, deleted on the Profiles
// screen here or in another game, is forgotten: their settings, colors, waiting round, stats and
// unlocked puzzles go, and any Pass & Play seat they held becomes a guest's. Waits for the shell's
// launch reconcile, so a roster still being read never looks like a deletion.
export const PlayerRoster = (): null => {
  const store = useStore<RootState>()
  const { loaded } = useShellProfiles()
  const roster = useProfiles()
  const { forgetPlayer, clearLeftGuestSeats } = usePlayerData()
  const previousRef = useRef(roster)

  useEffect(() => {
    void clearLeftGuestSeats()
  }, [clearLeftGuestSeats])

  useEffect(() => {
    if (!loaded) return
    const state = store.getState()
    const kept = new Set(roster.map((profile) => profile.id))
    const held = new Set([...previousRef.current.map((profile) => profile.id), state.activePlayer.profileId, ...state.round.pnp.session.players.map((player) => player.profileId)])
    previousRef.current = roster
    for (const profileId of held) if (profileId && !kept.has(profileId)) void forgetPlayer(profileId)
  }, [loaded, roster, store, forgetPlayer])

  return null
}
