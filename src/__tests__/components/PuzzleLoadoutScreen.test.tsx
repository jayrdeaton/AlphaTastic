import { fireEvent, render } from '@testing-library/react-native'
import { router } from 'expo-router'
import { View } from 'react-native'

import { PuzzleLoadoutScreen } from '@/components/PuzzleLoadoutScreen'
import { CRYPTOGRAM_GAME_ID, JUMBLE_GAME_ID, type PuzzleGameId, WORD_SEARCH_GAME_ID } from '@/constants/games'
import { activePlayerActions } from '@/redux/activePlayerSlice'
import { playerSettingsActions } from '@/redux/playerSettingsSlice'
import { store } from '@/redux/store'
import { Providers } from '@/testUtils/Providers'
import { puzzleGameHref } from '@/utils/navigation'
import { GUEST_PLAYER_KEY } from '@/utils/players'

const renderPuzzleGame = (game: PuzzleGameId = WORD_SEARCH_GAME_ID) =>
  render(
    <Providers>
      <PuzzleLoadoutScreen game={game} />
    </Providers>
  )

describe('the setup pages', () => {
  let measureInWindow: jest.SpyInstance
  beforeEach(() => {
    jest.clearAllMocks()
    store.dispatch(activePlayerActions.setActivePlayer(null))
    store.dispatch(playerSettingsActions.reset())
    measureInWindow = jest.spyOn(View.prototype as unknown as { measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void }, 'measureInWindow').mockImplementation((callback) => callback(120, 8, 140, 28))
  })
  afterEach(() => measureInWindow.mockRestore())

  describe('the puzzle games', () => {
    // No title, as Hangman's page has none (Jay, 2026-11-19); each pill captioned with its setting.
    it.each([
      [WORD_SEARCH_GAME_ID, 'Word Search', 'GRID, MEDIUM', 'DIRECTIONS, DIAGONAL', '10 words on a 12 by 12 grid, including diagonals'],
      [JUMBLE_GAME_ID, 'Jumble', 'ROUND, 5 ANSWERS', 'LENGTH, MEDIUM', '5 answers, up to 2 words and 12 letters'],
      [CRYPTOGRAM_GAME_ID, 'Cryptogram', 'LENGTH, MEDIUM', 'HEAD START, 3 LETTERS', 'Answers up to 36 letters, with 3 code letters solved']
    ] as const)('gives %s its own picture, captioned settings and Ready, and no title', async (game, title, first, second, summary) => {
      const screen = await renderPuzzleGame(game)

      expect(screen.queryByRole('header', { name: title })).toBeNull()
      expect(screen.queryByText(title)).toBeNull()
      expect(screen.getByTestId(`${game}-art`, { includeHiddenElements: true })).toBeTruthy()
      expect(screen.getByLabelText(first)).toBeTruthy()
      expect(screen.getByLabelText(second)).toBeTruthy()
      expect(screen.getByTestId('puzzle-summary')).toHaveTextContent(summary)
      expect(screen.queryByText('1 Player')).toBeNull()
      expect(screen.queryByLabelText('Add player')).toBeNull()

      await fireEvent.press(screen.getByText('Ready'))
      expect(router.push).toHaveBeenCalledWith(puzzleGameHref(game))
    })

    it("saves a change as this player's, for this game alone", async () => {
      const screen = await renderPuzzleGame(JUMBLE_GAME_ID)

      await fireEvent.press(screen.getByLabelText('ROUND, 5 ANSWERS'))
      await fireEvent.press(screen.getByText('10 answers'))

      expect(store.getState().playerSettings[GUEST_PLAYER_KEY].puzzles).toEqual({ [JUMBLE_GAME_ID]: { answers: '10' } })
      expect(store.getState().playerSettings[GUEST_PLAYER_KEY].difficulty).toBe('any')
      expect(screen.getByTestId('puzzle-summary')).toHaveTextContent('10 answers, up to 2 words and 12 letters')

      expect(screen.queryByLabelText('Reset settings')).toBeNull()
    })

    it('has nothing to play with no pack selected', async () => {
      store.dispatch(playerSettingsActions.setPackKeys({ playerKey: GUEST_PLAYER_KEY, packKeys: [] }))
      const screen = await renderPuzzleGame()

      await fireEvent.press(screen.getByText('Ready'))
      expect(router.push).not.toHaveBeenCalled()
    })
  })
})
