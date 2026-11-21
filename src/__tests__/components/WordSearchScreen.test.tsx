import { act, fireEvent, render } from '@testing-library/react-native'
import { Portal } from 'react-native-paper'

import { WordSearchScreen } from '@/components/WordSearchScreen'
import { activePlayerActions } from '@/redux/activePlayerSlice'
import { playerSettingsActions } from '@/redux/playerSettingsSlice'
import { store } from '@/redux/store'
import { Providers } from '@/testUtils/Providers'
import { safeBack } from '@/utils/navigation'
import { GUEST_PLAYER_KEY } from '@/utils/players'
import type { GridCell, WordSearchBoard } from '@/utils/wordSearch'

const mockHaptics = { correctGuess: jest.fn(), win: jest.fn() }
const mockSounds = { playCorrect: jest.fn(), playWin: jest.fn() }
jest.mock('@/hooks/useGameHaptics', () => ({ useGameHaptics: () => mockHaptics }))
jest.mock('@/hooks/useSoundEffects', () => ({ useSoundEffects: () => mockSounds }))
jest.mock('@/utils/navigation', () => ({ ...jest.requireActual('@/utils/navigation'), safeBack: jest.fn() }))
jest.mock('@/effects/registry', () => {
  const { createElement } = jest.requireActual('react')
  const { Text } = jest.requireActual('react-native')
  return { DEFAULT_CELEBRATION: { Component: () => createElement(Text, { testID: 'fireworks' }) } }
})

// The drag has its own suite (WordSearchGrid). Here a test reaches the screen's handler directly, with
// the board the screen drew.
let mockGrid: { board: WordSearchBoard; cellSize: number; disabled: boolean; onSelect: (start: GridCell, end: GridCell) => void }
jest.mock('@/components/WordSearchGrid', () => ({
  WordSearchGrid: (props: typeof mockGrid) => {
    mockGrid = props
    return null
  }
}))

const renderScreen = () =>
  render(
    <Providers>
      <Portal.Host>
        <WordSearchScreen />
      </Portal.Host>
    </Providers>
  )

const findWord = async (index: number) => {
  const { start, end } = mockGrid.board.words[index]
  await act(async () => mockGrid.onSelect(start, end))
}
const findAll = async () => {
  for (let i = 0; i < mockGrid.board.words.length; i++) await findWord(i)
}

describe('WordSearchScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    store.dispatch(activePlayerActions.setActivePlayer(null))
    store.dispatch(playerSettingsActions.reset())
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows the pack and its words, none found', async () => {
    const { getByText, getByTestId } = await renderScreen()

    expect(getByText(mockGrid.board.packLabel)).toBeTruthy()
    expect(getByTestId('word-search-progress')).toHaveTextContent(`0 of ${mockGrid.board.words.length} found`)
    for (const word of mockGrid.board.words) expect(getByTestId(`word-search-word-${word.id}`)).toHaveTextContent(word.answer)
  })

  it("builds the grid from the active player's settings", async () => {
    store.dispatch(playerSettingsActions.setPuzzleOption({ playerKey: GUEST_PLAYER_KEY, game: 'wordsearch', key: 'grid', value: 'small' }))

    await renderScreen()

    expect(mockGrid.board.size).toBe(10)
    expect(mockGrid.board.words).toHaveLength(8)
  })

  it("draws only from the active player's packs", async () => {
    store.dispatch(playerSettingsActions.setPackKeys({ playerKey: GUEST_PLAYER_KEY, packKeys: ['geographyUSStates'] }))

    await renderScreen()

    expect(mockGrid.board.packKey).toBe('geographyUSStates')
  })

  it('crosses off a word when it is found', async () => {
    const { getByTestId, getByLabelText } = await renderScreen()
    const word = mockGrid.board.words[0]

    await findWord(0)

    expect(getByTestId('word-search-progress')).toHaveTextContent(`1 of ${mockGrid.board.words.length} found`)
    expect(getByLabelText(`${word.answer}, found`)).toBeTruthy()
    expect(mockHaptics.correctGuess).toHaveBeenCalledTimes(1)
    expect(mockSounds.playCorrect).toHaveBeenCalledTimes(1)
  })

  it('does nothing for letters that spell no word, or a word found already', async () => {
    const { getByTestId } = await renderScreen()
    const { start, end } = mockGrid.board.words[0]
    await findWord(0)

    await act(async () => mockGrid.onSelect(start, end))
    await act(async () => mockGrid.onSelect({ row: 0, col: 0 }, { row: 0, col: 0 }))

    expect(getByTestId('word-search-progress')).toHaveTextContent(`1 of ${mockGrid.board.words.length} found`)
    expect(mockHaptics.correctGuess).toHaveBeenCalledTimes(1)
  })

  it('celebrates the last word, then offers the next puzzle', async () => {
    const { getByTestId, getByText, queryByText, queryByTestId } = await renderScreen()
    const first = mockGrid.board
    jest.useFakeTimers()

    await findAll()

    expect(mockHaptics.win).toHaveBeenCalledTimes(1)
    expect(mockSounds.playWin).toHaveBeenCalledTimes(1)
    expect(mockGrid.disabled).toBe(true)
    expect(getByTestId('fireworks')).toBeTruthy()
    expect(queryByText('Puzzle Solved!')).toBeNull()

    await act(async () => jest.advanceTimersByTime(2000))
    expect(getByText('Puzzle Solved!')).toBeTruthy()
    expect(queryByTestId('fireworks')).toBeNull()

    await fireEvent.press(getByText('Next Puzzle'))
    expect(queryByText('Puzzle Solved!')).toBeNull()
    expect(mockGrid.board).not.toBe(first)
    expect(mockGrid.disabled).toBe(false)
    expect(getByTestId('word-search-progress')).toHaveTextContent(`0 of ${mockGrid.board.words.length} found`)
  })

  // Hangman's corners (Jay, 2026-11-19): Back to the setup screen, whose Ready deals a new grid, and the
  // Settings cog, where a New puzzle button used to be.
  it('leaves from Back and opens Settings from the cog, with no New puzzle button', async () => {
    const { getByLabelText, queryByLabelText, queryByTestId } = await renderScreen()
    expect(queryByLabelText('New puzzle')).toBeNull()

    await fireEvent.press(getByLabelText('Settings'))
    expect(queryByTestId('dialog')).toBeTruthy()

    await fireEvent.press(getByLabelText('Back'))
    expect(safeBack).toHaveBeenCalledTimes(1)
  })

  it('sends a player with no usable pack to choose some', async () => {
    store.dispatch(playerSettingsActions.setPackKeys({ playerKey: GUEST_PLAYER_KEY, packKeys: [] }))
    const { getByText } = await renderScreen()

    await fireEvent.press(getByText('Choose Packs'))

    expect(safeBack).toHaveBeenCalledTimes(1)
  })
})
