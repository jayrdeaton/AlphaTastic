import { createAction, type UnknownAction } from '@reduxjs/toolkit'
import { isValidProfile, type Profile } from '@tastic/profile'
import { REHYDRATE } from 'redux-persist'

import { guestSeatKey, isGuestSeatKey, isProfileId, type PlayerKey, type PlayerRef } from '@/utils/players'

// redux-persist's REHYDRATE for the root blob (store.ts's persistConfig, key 'root'), carrying every
// whitelisted slice's stored state by slice name. The round slice rehydrates under its own key, with
// its own sanitizer (its migrate), so that one is left alone here.
export type RootRehydrateAction = UnknownAction & { type: typeof REHYDRATE; key: 'root'; payload?: Record<string, unknown> }

// For the per-player slices' extraReducers: each sanitizes its own stored entry on this and returns a
// fresh object, which redux-persist's default reconciler (autoMergeLevel1) then keeps over the raw
// stored value, because the slice changed it. That is how a corrupt or older stored shape falls back to
// defaults instead of reaching a screen.
export const isRootRehydrate = (action: UnknownAction): action is RootRehydrateAction => action.type === REHYDRATE && (action as { key?: unknown }).key === 'root'

// What pruneLeftGuestSeats reads and trims: the root blob's per-player slices, and the round (which
// holds the table) as the root reducer sees it, with its own _persist once redux-persist has it.
type GuestSeatHolder = {
  activePlayer: PlayerRef
  playerSettings: Record<PlayerKey, unknown>
  playerTheme: Record<PlayerKey, unknown>
  round: { pnp: { session: { players: { id: string }[] } }; _persist?: { rehydrated: boolean } }
}

const withoutLeftSeats = <T>(entries: Record<PlayerKey, T>, seated: Set<PlayerKey>): Record<PlayerKey, T> => {
  if (!Object.keys(entries).some((key) => isGuestSeatKey(key) && !seated.has(key))) return entries
  return Object.fromEntries(Object.entries(entries).filter(([key]) => !isGuestSeatKey(key) || seated.has(key)))
}

// A guest seat's data lives as long as its seat (utils/players.ts' guestSeatKey): removing the seat
// forgets it (usePlayerData's forgetGuestSeat), and so does this, for anything stored under a guest
// seat the table no longer has (a table that came back from storage as a fresh one, an app closed
// between a seat leaving and its data going), so nothing a leaver kept is ever found by a new seat
// that gets their id. The store's root reducer runs it on every REHYDRATE: the table comes back with
// the round, under its own key, in no set order with the root blob, so it does nothing until the round
// is in (a round that isn't persisted at all, as under Jest, counts as in), and the root blob's slices
// coming back after it are trimmed as they arrive. The round's own guest seat slots are its sanitizer's
// (sanitizeRoundState). Hands back the same state when there's nothing to trim.
export const pruneLeftGuestSeats = <S extends GuestSeatHolder>(state: S): S => {
  if (state.round._persist?.rehydrated === false) return state
  const { players } = state.round.pnp.session
  const seated = new Set(players.map((player) => guestSeatKey(player.id)))
  const playerSettings = withoutLeftSeats(state.playerSettings, seated)
  const playerTheme = withoutLeftSeats(state.playerTheme, seated)
  const { seatId } = state.activePlayer
  const seatLeft = seatId !== null && !players.some((player) => player.id === seatId)
  if (playerSettings === state.playerSettings && playerTheme === state.playerTheme && !seatLeft) return state
  return { ...state, playerSettings, playerTheme, activePlayer: seatLeft ? { profileId: null, seatId: null } : state.activePlayer }
}

// What pruneLeftGuestSeats leaves, for the store's middleware to put back (see store.ts): the shell
// builds the root reducer, so these three keys are replaced by an action rather than from above.
export const guestSeatsPruned = createAction<{ activePlayer: PlayerRef; playerSettings: Record<PlayerKey, unknown>; playerTheme: Record<PlayerKey, unknown> }>('hangman/guestSeatsPruned')

// The stored roster, each valid profile once. An id that could be a guest's key would make that profile
// and the guest one player, so it never comes back.
export const sanitizeProfiles = (value: unknown): Profile[] => {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const next: Profile[] = []
  for (const item of value) {
    if (!isValidProfile(item) || !isProfileId(item.id) || seen.has(item.id)) continue
    seen.add(item.id)
    next.push({ id: item.id, name: item.name, color: item.color, tag: item.tag, createdAt: item.createdAt, updatedAt: item.updatedAt })
  }
  return next
}
