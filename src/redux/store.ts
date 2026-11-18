import AsyncStorage from '@react-native-async-storage/async-storage'
import type { Action, EnhancedStore, Middleware, Reducer, UnknownAction } from '@reduxjs/toolkit'
import { profilesActions } from '@tastic/profile'
import { createPackStore, type PackStoreSource, type ShellState } from '@tastic/shell'
import { type PersistedState, persistReducer, REHYDRATE } from 'redux-persist'

import { STORAGE_PREFIX } from '@/constants/storage'
import { DEFAULT_THEME, getLiveTheme } from '@/utils/liveTheme'
import { sanitizeRoundState } from '@/utils/roundState'

import achievements from './achievementsSlice'
import activePlayer from './activePlayerSlice'
import playerSettings from './playerSettingsSlice'
import playerTheme from './playerThemeSlice'
import { guestSeatsPruned, isRootRehydrate, pruneLeftGuestSeats, sanitizeProfiles } from './rehydrate'
import round from './roundSlice'

// The round is saved on every guess, so it persists under its own key rather than in the root entry:
// a guess never rewrites the stats. Its migrate runs the sanitizer, so a corrupt slot falls back to an
// empty round.
const roundPersistConfig = {
  key: 'round',
  keyPrefix: STORAGE_PREFIX,
  storage: AsyncStorage,
  version: 3,
  migrate: (state: PersistedState) => Promise.resolve(state ? ({ ...sanitizeRoundState(state), _persist: state._persist } as PersistedState) : state)
}

type PrunedKey = 'activePlayer' | 'playerSettings' | 'playerTheme'

const withPruning =
  <S>(key: PrunedKey, reducer: Reducer<S>): Reducer<S> =>
  (state, action) =>
    guestSeatsPruned.match(action) ? (action.payload[key] as S) : reducer(state, action)

const packReducers = {
  achievements,
  activePlayer: withPruning('activePlayer', activePlayer),
  playerSettings: withPruning('playerSettings', playerSettings),
  playerTheme: withPruning('playerTheme', playerTheme),
  round: persistReducer(roundPersistConfig, round)
}

type PackReducers = typeof packReducers
export type RootState = ShellState & { [K in keyof PackReducers]: ReturnType<PackReducers[K]> }

// What the shell's root reducer can't do for the pack, as the store comes back. The stored roster is
// checked (see sanitizeProfiles). And anything kept for a guest seat the table no longer has goes: the
// root entry and the round come back in no set order, and only together say which seats are left, so
// that runs after each of them (pruneLeftGuestSeats waits for the round).
const tidyOnRehydrate: Middleware = (api) => (next) => (action) => {
  const result = next(action)
  const rehydrate = action as UnknownAction
  if (rehydrate.type !== REHYDRATE) return result
  if (isRootRehydrate(rehydrate)) {
    const profiles = sanitizeProfiles(rehydrate.payload?.profiles)
    if (JSON.stringify(profiles) !== JSON.stringify((api.getState() as RootState).profiles)) api.dispatch(profilesActions.setAll(profiles) as unknown as UnknownAction)
  }
  const state = api.getState() as RootState
  const pruned = pruneLeftGuestSeats(state)
  if (pruned !== state) api.dispatch(guestSeatsPruned({ activePlayer: pruned.activePlayer, playerSettings: pruned.playerSettings, playerTheme: pruned.playerTheme }))
  return result
}

// The part of the pack the store is built from. It lives here rather than in games/pack.ts because the pack
// holds every game's screen and the screens read the store, which would make an import cycle.
export const storeSource = {
  seatColors: { 1: DEFAULT_THEME.color as string, 2: '#2196f3' },
  seatTheme: () => getLiveTheme(),
  reducers: packReducers as unknown as Record<string, Reducer>,
  games: [
    { reducers: {}, resumable: true },
    { reducers: {}, resumable: false }
  ]
} satisfies PackStoreSource

const { store: packStore, persistor } = createPackStore(storeSource, { keyPrefix: STORAGE_PREFIX, blacklist: ['round'], middleware: [tidyOnRehydrate] })

export { packStore, persistor }
export const store = packStore as unknown as EnhancedStore<RootState, Action>
export type AppDispatch = typeof store.dispatch
