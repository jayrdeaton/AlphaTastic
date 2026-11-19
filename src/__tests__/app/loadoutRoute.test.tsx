import { render } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'
import { Provider as ReduxProvider } from 'react-redux'

import GameLoadoutRoute from '@/app/loadout/[game]'
import { HANGMAN_GAME_ID, PUZZLE_GAME_IDS } from '@/constants/games'
import { store } from '@/redux/store'

let mockHangman = false
let mockPuzzleGame: string | null = null
jest.mock('@/components/PuzzleLoadoutScreen', () => ({
  PuzzleLoadoutScreen: ({ game }: { game: string }) => {
    mockPuzzleGame = game
    return null
  }
}))
jest.mock('@/components/LoadoutScreen', () => ({
  LoadoutScreen: () => {
    mockHangman = true
    return null
  }
}))

const renderRoute = (game: string) => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ game })
  return render(
    <ReduxProvider store={store}>
      <GameLoadoutRoute />
    </ReduxProvider>
  )
}

describe('the setup route', () => {
  beforeEach(() => {
    mockHangman = false
    mockPuzzleGame = null
  })

  // One page for any number of players (Jay, 2026-11-19): no mode to read or remember.
  it("opens Hangman's own setup page", async () => {
    await renderRoute(HANGMAN_GAME_ID)

    expect(mockHangman).toBe(true)
    expect(mockPuzzleGame).toBeNull()
  })

  it.each(PUZZLE_GAME_IDS)('gives %s its own setup screen', async (game) => {
    await renderRoute(game)

    expect(mockPuzzleGame).toBe(game)
    expect(mockHangman).toBe(false)
  })

  it('sends an unknown game Home', async () => {
    const screen = await renderRoute('chess')

    expect(mockHangman).toBe(false)
    expect(mockPuzzleGame).toBeNull()
    expect(screen.getByTestId('redirect')).toHaveTextContent('/')
  })
})
