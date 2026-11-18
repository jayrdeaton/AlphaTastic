import { configureNavigation, safeBack } from '@rific/core'
import { router } from 'expo-router'

import { type GameId, HANGMAN_GAME_ID, WORD_SEARCH_GAME_ID } from '@/constants/games'
import type { PlayMode } from '@/redux/roundSlice'

// The fleet's back: router.back() when there's somewhere to go back to, otherwise Home. A screen
// reached with nothing beneath it (a resumed game, a share link opened cold, a web reload) would
// otherwise hit expo-router's "GO_BACK was not handled" error. @rific/core keeps expo-router out of
// its own dependencies, so the router is handed in here, once, as every fleet app does.
configureNavigation({ router })

export { safeBack }

// The Home corner (the loadouts'): dismissTo pops back to the Home already beneath, or replaces this
// screen with it when there's none (a loadout reached from a resumed game).
export const goHome = () => router.dismissTo('/')

// A game's setup screen, the shell's route for it (Home's cards open these).
export const loadoutHref = (game: GameId = HANGMAN_GAME_ID) => ({ pathname: '/loadout/[game]' as const, params: { game } })

// The Hangman board, and which of its setup page's modes it goes back to: the game's own unless it's
// said (the Pass & Play table on the packs takes turns playing solo rounds, gameHref('solo', 'pnp'),
// see utils/packTurns.ts).
export const gameHref = (mode: PlayMode, door: PlayMode = mode) => ({ pathname: '/play/[game]' as const, params: door === mode ? { game: HANGMAN_GAME_ID, mode } : { game: HANGMAN_GAME_ID, mode, door } })

export const wordSearchHref = () => ({ pathname: '/play/[game]' as const, params: { game: WORD_SEARCH_GAME_ID } })

export const parsePlayMode = (value: string | string[] | undefined): PlayMode => (value === 'pnp' ? 'pnp' : 'solo')
