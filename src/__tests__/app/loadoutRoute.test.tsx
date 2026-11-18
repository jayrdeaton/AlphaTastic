import { opponentActions } from '@tastic/shell'
import { act, render } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'
import { Provider as ReduxProvider } from 'react-redux'

import GameLoadoutRoute from '@/app/loadout/[game]'
import type { LoadoutScreenProps } from '@/components/LoadoutScreen'
import { HANGMAN_GAME_ID, WORD_SEARCH_GAME_ID } from '@/constants/games'
import { store } from '@/redux/store'

let mockProps: LoadoutScreenProps | null = null
jest.mock('@/components/LoadoutScreen', () => ({
  LoadoutScreen: (props: LoadoutScreenProps) => {
    mockProps = props
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
    mockProps = null
    store.dispatch(opponentActions.setSeatTwo('cpu'))
  })

  it('opens Hangman for one player until Pass & Play is picked, and remembers the pick', async () => {
    await renderRoute(HANGMAN_GAME_ID)
    expect(mockProps).toMatchObject({ mode: 'solo' })

    await act(async () => mockProps?.onModeChange?.('pnp'))

    expect(mockProps).toMatchObject({ mode: 'pnp' })
    expect(store.getState().opponent.seatTwo).toBe('person')

    await act(async () => mockProps?.onModeChange?.('solo'))
    expect(mockProps).toMatchObject({ mode: 'solo' })
    expect(store.getState().opponent.seatTwo).toBe('nobody')
  })

  it('gives Word Search one mode, with no picker', async () => {
    await renderRoute(WORD_SEARCH_GAME_ID)

    expect(mockProps).toMatchObject({ game: WORD_SEARCH_GAME_ID, mode: 'solo' })
    expect(mockProps?.onModeChange).toBeUndefined()
  })

  it('sends an unknown game Home', async () => {
    const screen = await renderRoute('chess')

    expect(mockProps).toBeNull()
    expect(screen.getByTestId('redirect')).toHaveTextContent('/')
  })
})
