import { fireEvent, render } from '@testing-library/react-native'
import { router } from 'expo-router'
import { View } from 'react-native'

import { LoadoutScreen } from '@/components/LoadoutScreen'
import { WORD_SEARCH_GAME_ID } from '@/constants/games'
import { activePlayerActions } from '@/redux/activePlayerSlice'
import { playerSettingsActions } from '@/redux/playerSettingsSlice'
import { store } from '@/redux/store'
import { Providers } from '@/testUtils/Providers'
import { wordSearchHref } from '@/utils/navigation'
import { GUEST_PLAYER_KEY } from '@/utils/players'

jest.mock('@/components/ArtCarousel', () => ({ ...jest.requireActual('@/components/ArtCarousel'), ArtCarousel: () => null }))

const renderWordSearch = () =>
  render(
    <Providers>
      <LoadoutScreen game={WORD_SEARCH_GAME_ID} mode='solo' />
    </Providers>
  )

describe('the setup pages', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    store.dispatch(activePlayerActions.setActivePlayer(null))
    store.dispatch(playerSettingsActions.reset())
  })

  describe('Word Search', () => {
    it('shows a sample grid and plays from Ready, with no mode picker or Add player', async () => {
      const screen = await renderWordSearch()

      expect(screen.getByTestId('word-search-art', { includeHiddenElements: true })).toBeTruthy()
      expect(screen.queryByLabelText('1 PLAYER')).toBeNull()
      expect(screen.queryByLabelText('Add player')).toBeNull()

      await fireEvent.press(screen.getByText('Ready'))
      expect(router.push).toHaveBeenCalledWith(wordSearchHref())
    })

    it('has nothing to play with no pack selected', async () => {
      store.dispatch(playerSettingsActions.setPackKeys({ playerKey: GUEST_PLAYER_KEY, packKeys: [] }))
      const screen = await renderWordSearch()

      await fireEvent.press(screen.getByText('Ready'))
      expect(router.push).not.toHaveBeenCalled()
    })
  })

  describe("Hangman's mode picker", () => {
    let measureInWindow: jest.SpyInstance
    beforeEach(() => {
      measureInWindow = jest.spyOn(View.prototype as unknown as { measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void }, 'measureInWindow').mockImplementation((callback) => callback(120, 8, 140, 28))
    })
    afterEach(() => measureInWindow.mockRestore())

    it('offers Pass & Play from inside the game', async () => {
      const onModeChange = jest.fn()
      const screen = await render(
        <Providers>
          <LoadoutScreen mode='solo' onModeChange={onModeChange} />
        </Providers>
      )

      await fireEvent.press(screen.getByLabelText('1 PLAYER'))
      await fireEvent.press(screen.getByText('Pass & Play'))

      expect(onModeChange).toHaveBeenCalledWith('pnp')
    })
  })
})
