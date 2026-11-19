import { Redirect, useLocalSearchParams } from 'expo-router'
import { JSX } from 'react'

import { LoadoutScreen } from '@/components/LoadoutScreen'
import { PuzzleLoadoutScreen } from '@/components/PuzzleLoadoutScreen'
import { HANGMAN_GAME_ID, isPuzzleGameId } from '@/constants/games'

// A game's setup screen, from its card on Home. An id the pack doesn't have goes Home.
const GameLoadoutRoute = (): JSX.Element => {
  const { game } = useLocalSearchParams<{ game: string }>()
  if (game === HANGMAN_GAME_ID) return <LoadoutScreen />
  if (isPuzzleGameId(game)) return <PuzzleLoadoutScreen key={game} game={game} />
  return <Redirect href='/' />
}

export default GameLoadoutRoute
