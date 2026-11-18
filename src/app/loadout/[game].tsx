import { useOpponent } from '@tastic/shell'
import { Redirect, useLocalSearchParams } from 'expo-router'
import { JSX, useCallback } from 'react'

import { LoadoutScreen } from '@/components/LoadoutScreen'
import { HANGMAN_GAME_ID, WORD_SEARCH_GAME_ID } from '@/constants/games'
import type { PlayMode } from '@/redux/roundSlice'

// Hangman's modes live inside the game, kept in the shell's "who's in seat 2" (Solo or a person), the
// choice its other packs make on their setup screens too. Keyed on the mode: each is its own page.
const HangmanLoadout = (): JSX.Element => {
  const { seatTwo, setSeatTwo } = useOpponent()
  const mode: PlayMode = seatTwo === 'person' ? 'pnp' : 'solo'
  const handleModeChange = useCallback((next: PlayMode) => setSeatTwo(next === 'pnp' ? 'person' : 'nobody'), [setSeatTwo])
  return <LoadoutScreen key={mode} mode={mode} onModeChange={handleModeChange} />
}

// A game's setup screen, from its card on Home. An id the pack doesn't have goes Home.
const GameLoadoutRoute = (): JSX.Element => {
  const { game } = useLocalSearchParams<{ game: string }>()
  if (game === HANGMAN_GAME_ID) return <HangmanLoadout />
  if (game === WORD_SEARCH_GAME_ID) return <LoadoutScreen game={WORD_SEARCH_GAME_ID} mode='solo' />
  return <Redirect href='/' />
}

export default GameLoadoutRoute
