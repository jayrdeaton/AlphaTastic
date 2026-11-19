import { act, fireEvent, render } from '@testing-library/react-native'
import { Portal } from 'react-native-paper'

import { CryptogramScreen } from '@/components/CryptogramScreen'
import { activePlayerActions } from '@/redux/activePlayerSlice'
import { playerSettingsActions } from '@/redux/playerSettingsSlice'
import { store } from '@/redux/store'
import { Providers } from '@/testUtils/Providers'
import { type CryptogramBoard, drawCryptogram } from '@/utils/cryptogram'
import { GUEST_PLAYER_KEY } from '@/utils/players'

const mockHaptics = { correctGuess: jest.fn(), wrongGuess: jest.fn(), win: jest.fn() }
const mockSounds = { playCorrect: jest.fn(), playWrong: jest.fn(), playWin: jest.fn() }
jest.mock('@/hooks/useGameHaptics', () => ({ useGameHaptics: () => mockHaptics }))
jest.mock('@/hooks/useSoundEffects', () => ({ useSoundEffects: () => mockSounds }))
jest.mock('@/effects/registry', () => {
  const { createElement } = jest.requireActual('react')
  const { Text } = jest.requireActual('react-native')
  return { DEFAULT_CELEBRATION: { Component: () => createElement(Text, { testID: 'fireworks' }) } }
})
jest.mock('@/utils/cryptogram', () => ({ ...jest.requireActual('@/utils/cryptogram'), drawCryptogram: jest.fn() }))

// RED FOX in code, with R given.
const BOARD: CryptogramBoard = { id: 'p1', answer: 'Red Fox', hint: 'An animal', packKey: 'test', packLabel: 'Test Pack', words: ['RED', 'FOX'], cipherWords: ['KLM', 'NPQ'], plainByCipher: { K: 'R', L: 'E', M: 'D', N: 'F', P: 'O', Q: 'X' }, cipherLetters: ['K', 'L', 'M', 'N', 'P', 'Q'], given: ['K'] }

const renderScreen = () =>
  render(
    <Providers>
      <Portal.Host>
        <CryptogramScreen />
      </Portal.Host>
    </Providers>
  )
type Screen = Awaited<ReturnType<typeof renderScreen>>
const typeLetters = async (screen: Screen, letters: string) => {
  for (const letter of letters) await fireEvent.press(screen.getByRole('button', { name: letter }))
}

describe('CryptogramScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(drawCryptogram).mockReturnValue(BOARD)
    store.dispatch(activePlayerActions.setActivePlayer(null))
    store.dispatch(playerSettingsActions.reset())
  })
  afterEach(() => jest.useRealTimers())

  it("draws with the active player's settings", async () => {
    store.dispatch(playerSettingsActions.setPuzzleOption({ playerKey: GUEST_PLAYER_KEY, game: 'cryptogram', key: 'headStart', value: '5' }))
    await renderScreen()

    expect(jest.mocked(drawCryptogram).mock.calls[0][1]).toEqual({ length: 'medium', headStart: '5' })
  })

  it('shows the coded answer, the clue and the given letter', async () => {
    const screen = await renderScreen()

    expect(screen.getByText('Test Pack')).toBeTruthy()
    expect(screen.getByTestId('cryptogram-clue')).toHaveTextContent('An animal')
    expect(screen.getByLabelText('Code letter K, written as R')).toBeTruthy()
    expect(screen.getByLabelText('Code letter L, empty')).toBeTruthy()
  })

  it('writes into the selected code letter and moves to the next open one', async () => {
    const screen = await renderScreen()

    await typeLetters(screen, 'E')

    expect(screen.getByLabelText('Code letter L, written as E')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Code letter M, empty', selected: true })).toBeTruthy()
  })

  it('moves a letter written twice, and erases the selected one', async () => {
    const screen = await renderScreen()
    await typeLetters(screen, 'EE')

    expect(screen.getByLabelText('Code letter L, empty')).toBeTruthy()
    expect(screen.getByLabelText('Code letter M, written as E')).toBeTruthy()

    await fireEvent.press(screen.getByLabelText('Code letter M, written as E'))
    await fireEvent.press(screen.getByLabelText('Erase'))
    expect(screen.getByLabelText('Code letter M, empty')).toBeTruthy()
  })

  it('keeps a given letter fixed', async () => {
    const screen = await renderScreen()

    expect(screen.getByRole('button', { name: 'R', disabled: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Code letter K, written as R', disabled: true })).toBeTruthy()
  })

  it('says so when every letter is written but some are wrong', async () => {
    const screen = await renderScreen()

    await typeLetters(screen, 'EDFXO')

    expect(screen.getByTestId('cryptogram-status')).toHaveTextContent('Not quite. Some letters are wrong.')
    expect(mockHaptics.wrongGuess).toHaveBeenCalledTimes(1)
  })

  it('celebrates the solved answer, counting hints, then deals another', async () => {
    const screen = await renderScreen()
    jest.useFakeTimers()

    await fireEvent.press(screen.getByText('Hint'))
    expect(screen.getByLabelText('Code letter L, written as E')).toBeTruthy()
    await typeLetters(screen, 'DFOX')
    expect(mockHaptics.win).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('fireworks')).toBeTruthy()

    await act(async () => jest.advanceTimersByTime(2000))
    expect(screen.getByText(/Red Fox, cracked with 1 hint in/)).toBeTruthy()

    await fireEvent.press(screen.getByText('Next Puzzle'))
    expect(screen.queryByText('Puzzle Solved!')).toBeNull()
    expect(drawCryptogram).toHaveBeenCalledTimes(2)
  })

  it('says when no selected pack can make one', async () => {
    jest.mocked(drawCryptogram).mockReturnValue(null)
    const screen = await renderScreen()

    expect(screen.getByText('None of your selected packs has enough longer answers for a code.')).toBeTruthy()
  })
})
