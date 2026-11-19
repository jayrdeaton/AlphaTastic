import { useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import type { PuzzleGameId } from '@/constants/games'
import { playerSettingsActions } from '@/redux/playerSettingsSlice'
import type { RootState } from '@/redux/store'
import { type PuzzleOptionsByGame, puzzleOptionsFor } from '@/utils/puzzleOptions'

import { useActivePlayer } from './useActivePlayer'

export type PuzzleOptionsControls<G extends PuzzleGameId> = {
  options: PuzzleOptionsByGame[G]
  setOption: (key: string, value: string) => void
}

// The active player's settings for one puzzle game.
export const usePuzzleOptions = <G extends PuzzleGameId>(game: G): PuzzleOptionsControls<G> => {
  const dispatch = useDispatch()
  const { key: playerKey } = useActivePlayer()
  const stored = useSelector((state: RootState) => state.playerSettings[playerKey]?.puzzles?.[game])
  const options = useMemo(() => puzzleOptionsFor(game, stored), [game, stored])
  const setOption = useCallback((key: string, value: string) => dispatch(playerSettingsActions.setPuzzleOption({ playerKey, game, key, value })), [dispatch, playerKey, game])
  return { options, setOption }
}
