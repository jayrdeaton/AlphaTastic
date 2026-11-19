import { act, fireEvent, render } from '@testing-library/react-native'
import { Portal } from 'react-native-paper'

import { JumbleScreen } from '@/components/JumbleScreen'
import { activePlayerActions } from '@/redux/activePlayerSlice'
import { playerSettingsActions } from '@/redux/playerSettingsSlice'
import { store } from '@/redux/store'
import { Providers } from '@/testUtils/Providers'
import { drawJumbleRound, type JumblePuzzle, type JumbleRound } from '@/utils/jumble'
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
jest.mock('@/utils/jumble', () => ({ ...jest.requireActual('@/utils/jumble'), drawJumbleRound: jest.fn() }))

const puzzle = (answer: string): JumblePuzzle => {
  const letters = answer.replace(/ /g, '')
  return { id: answer, answer, hint: `About ${answer}`, words: answer.split(' '), letters, tiles: [...letters].map((letter, id) => ({ id, letter })) }
}
const ROUND: JumbleRound = { packKey: 'test', packLabel: 'Test Pack', puzzles: ['CAT', 'DOG', 'OWL', 'HEN', 'RED FOX'].map(puzzle) }

type Screen = Awaited<ReturnType<typeof renderScreen>>
const renderScreen = () =>
  render(
    <Providers>
      <Portal.Host>
        <JumbleScreen />
      </Portal.Host>
    </Providers>
  )
const pressTiles = async (screen: Screen, ids: number[]) => {
  for (const id of ids) await fireEvent.press(screen.getByTestId(`jumble-tile-${id}`))
}
const nextWord = () => act(async () => jest.advanceTimersByTime(800))

describe('JumbleScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(drawJumbleRound).mockReturnValue(ROUND)
    store.dispatch(activePlayerActions.setActivePlayer(null))
    store.dispatch(playerSettingsActions.reset())
  })
  afterEach(() => jest.useRealTimers())

  it('draws from the active player’s packs and settings, and shows the pack and clue', async () => {
    store.dispatch(playerSettingsActions.setPuzzleOption({ playerKey: GUEST_PLAYER_KEY, game: 'jumble', key: 'length', value: 'long' }))
    store.dispatch(playerSettingsActions.setPackKeys({ playerKey: GUEST_PLAYER_KEY, packKeys: ['animals'] }))
    const screen = await renderScreen()

    expect(drawJumbleRound).toHaveBeenCalledWith(['animals'], { answers: '5', length: 'long' })
    expect(screen.getByText('Test Pack')).toBeTruthy()
    expect(screen.getByTestId('jumble-progress')).toHaveTextContent('Answer 1 of 5')
    expect(screen.getByTestId('jumble-clue')).toHaveTextContent('About CAT')
  })

  it('moves tiles into the answer and back to the pool', async () => {
    const screen = await renderScreen()

    await pressTiles(screen, [2])
    expect(screen.queryByTestId('jumble-tile-2')).toBeNull()
    expect(screen.getByLabelText('Answer letter 1, T')).toBeTruthy()

    await fireEvent.press(screen.getByTestId('jumble-slot-0'))
    expect(screen.getByTestId('jumble-tile-2')).toBeTruthy()
  })

  it('says so when the letters are all placed wrong, and lets them be cleared', async () => {
    const screen = await renderScreen()

    await pressTiles(screen, [2, 1, 0])
    expect(screen.getByTestId('jumble-status')).toHaveTextContent('Not quite. Tap a letter to take it back.')
    expect(mockHaptics.wrongGuess).toHaveBeenCalledTimes(1)
    expect(mockSounds.playWrong).toHaveBeenCalledTimes(1)

    await fireEvent.press(screen.getByText('Clear'))
    for (const id of [0, 1, 2]) expect(screen.getByTestId(`jumble-tile-${id}`)).toBeTruthy()
  })

  it('moves to the next answer after a solved one', async () => {
    const screen = await renderScreen()
    jest.useFakeTimers()

    await pressTiles(screen, [0, 1, 2])
    expect(mockHaptics.correctGuess).toHaveBeenCalledTimes(1)
    await nextWord()

    expect(screen.getByTestId('jumble-progress')).toHaveTextContent('Answer 2 of 5')
    expect(screen.getByTestId('jumble-clue')).toHaveTextContent('About DOG')
  })

  it('fixes a hinted letter so it stays through Clear', async () => {
    const screen = await renderScreen()

    await fireEvent.press(screen.getByText('Hint'))
    await pressTiles(screen, [2])
    await fireEvent.press(screen.getByText('Clear'))

    expect(screen.getByLabelText('Answer letter 1, C')).toBeTruthy()
    expect(screen.getByTestId('jumble-tile-2')).toBeTruthy()
  })

  it('celebrates the fifth answer, counting hints, then offers another round', async () => {
    const screen = await renderScreen()
    jest.useFakeTimers()
    for (let word = 0; word < 4; word++) {
      await pressTiles(screen, [0, 1, 2])
      await nextWord()
    }

    await fireEvent.press(screen.getByText('Hint'))
    await pressTiles(screen, [1, 2, 3, 4, 5])
    expect(mockHaptics.win).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('fireworks')).toBeTruthy()

    await act(async () => jest.advanceTimersByTime(2000))
    expect(screen.getByText(/You unscrambled all 5 with 1 hint in/)).toBeTruthy()

    await fireEvent.press(screen.getByText('Next Puzzle'))
    expect(screen.queryByText('Puzzle Solved!')).toBeNull()
    expect(screen.getByTestId('jumble-progress')).toHaveTextContent('Answer 1 of 5')
    expect(drawJumbleRound).toHaveBeenCalledTimes(2)
  })

  it('says when no selected pack can make a round', async () => {
    jest.mocked(drawJumbleRound).mockReturnValue(null)
    const screen = await renderScreen()

    expect(screen.getByText('None of your selected packs has enough answers of the right length.')).toBeTruthy()
  })
})
