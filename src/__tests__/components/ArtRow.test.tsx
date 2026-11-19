import { type AutoPaperTheme, Provider, useAutoPaperTheme } from '@rific/auto-paper'
import { FeedbackPressProvider } from '@rific/feedback-press'
import { act, fireEvent, render as rtlRender } from '@testing-library/react-native'
import { type ReactNode, useEffect } from 'react'
import { StyleSheet } from 'react-native'
import * as RNPaper from 'react-native-paper'
import { Provider as ReduxProvider } from 'react-redux'

import { ArtRow } from '@/components/ArtRow'
import { PuzzleDefaultsProvider } from '@/components/PuzzleDefaultsProvider'
import { usePuzzleDefaults } from '@/hooks/usePuzzleDefaults'
import { useSelectArt } from '@/hooks/useSelectArt'
import { candleMode, classicMode, DEFAULT_MODE, robotMode, VISIBLE_MODES } from '@/modes/registry'
import { fullyDrawnMistakes } from '@/modes/shared/fullyDrawnMistakes'
import { activePlayerActions } from '@/redux/activePlayerSlice'
import { playerSettingsActions } from '@/redux/playerSettingsSlice'
import { roundActions, selectSoloRound } from '@/redux/roundSlice'
import { store } from '@/redux/store'
import { GUEST_PLAYER_KEY } from '@/utils/players'

// A stand-in for each art: what the tile asks it to draw, and a count of every render, so a test can
// tell a still tile from one that keeps redrawing.
const mockArtRenders: string[] = []
jest.mock('@/components/GameVisual', () => {
  const { createElement } = jest.requireActual('react')
  const { View } = jest.requireActual('react-native')
  return {
    GameVisual: ({ mode, mistakes, color, colors }: { mode: { id: string }; mistakes: number; color: string; colors?: string[] }) => {
      mockArtRenders.push(mode.id)
      return createElement(View, { testID: `art-${mode.id}`, mistakes, color, colors })
    }
  }
})

// The theme the row renders with, for the art's colors.
let capturedTheme: AutoPaperTheme | null = null
const ThemeCapture = () => {
  const theme = useAutoPaperTheme()
  useEffect(() => {
    capturedTheme = theme
  }, [theme])
  return null
}

const Wrapper = ({ children }: { children: ReactNode }) => (
  <ReduxProvider store={store}>
    <FeedbackPressProvider paper={RNPaper}>
      <Provider statusBar={false} initialValue={{ appearance: 'light' }}>
        <PuzzleDefaultsProvider>
          <ThemeCapture />
          {children}
        </PuzzleDefaultsProvider>
      </Provider>
    </FeedbackPressProvider>
  </ReduxProvider>
)

// The row as the setup page uses it: the active player's art, picked through useSelectArt.
const Row = ({ paused = false }: { paused?: boolean }) => {
  const { mode } = usePuzzleDefaults()
  const selectArt = useSelectArt()
  return <ArtRow selected={mode} onSelect={selectArt} paused={paused} />
}
const renderRow = () => rtlRender(<Row />, { wrapper: Wrapper })
type Screen = Awaited<ReturnType<typeof renderRow>>

const thumbnail = (screen: Screen, label: string) => screen.getByRole('button', { name: `${label} art` })
const borderColor = (screen: Screen, label: string) => StyleSheet.flatten(thumbnail(screen, label).props.style).borderColor
const playerArt = (playerKey = GUEST_PLAYER_KEY) => store.getState().playerSettings[playerKey]?.modeId
const soloRound = (playerKey = GUEST_PLAYER_KEY) => selectSoloRound(store.getState().round, playerKey)
// A solo round waiting on the board, on the Classic art, with a guess on it.
const seedSoloRound = (playerKey = GUEST_PLAYER_KEY) => {
  store.dispatch(roundActions.startSolo({ playerKey, puzzle: { phrase: 'DOG', modeId: DEFAULT_MODE.id, sourceMode: 'random' } }))
  store.dispatch(roundActions.saveSoloProgress({ playerKey, guessedLetters: ['D', 'Q'], hintRevealed: false }))
}

// Hangman's art on its setup page (Jay, 2026-11-19), tiles after HexFleet's arena picker.
describe('ArtRow', () => {
  beforeEach(() => {
    store.dispatch(activePlayerActions.setActivePlayer(null))
    store.dispatch(playerSettingsActions.reset())
    store.dispatch(roundActions.reset())
    mockArtRenders.length = 0
  })

  it("offers every visible art as a tile named under it, with the player's art selected", async () => {
    const screen = await renderRow()

    for (const mode of VISIBLE_MODES) {
      expect(thumbnail(screen, mode.label)).toBeTruthy()
      expect(screen.getByText(mode.label, { includeHiddenElements: true })).toBeTruthy()
    }
    // Only the picker's arts: a hidden one (reachable through a shared link) isn't offered.
    expect(screen.getAllByRole('button', { name: / art$/ })).toHaveLength(VISIBLE_MODES.length)
    expect(screen.getByRole('button', { name: `${DEFAULT_MODE.label} art`, selected: true })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: / art$/, selected: true })).toHaveLength(1)
  })

  // A player who still has an art since taken out of the picker sees it first, picked.
  it('lists a hidden art first for a player who still has it', async () => {
    store.dispatch(playerSettingsActions.setMode({ playerKey: GUEST_PLAYER_KEY, modeId: 'kite' }))
    const screen = await renderRow()

    expect(screen.getAllByRole('button', { name: / art$/ })).toHaveLength(VISIBLE_MODES.length + 1)
    expect(screen.getByRole('button', { name: 'Kite art', selected: true })).toBeTruthy()
  })

  it("frames the selected art in the theme's primary, and the rest in its outline variant", async () => {
    const screen = await renderRow()
    const { colors } = capturedTheme!

    expect(borderColor(screen, DEFAULT_MODE.label)).toBe(colors.primary)
    expect(borderColor(screen, robotMode.label)).toBe(colors.outlineVariant)
  })

  // A single representative frame per art, the same as the board's art at its fullest, in the
  // player's palette (the triad PuzzleStage gives the board).
  it("draws every thumbnail complete, in the player's colors", async () => {
    const screen = await renderRow()
    const { colors } = capturedTheme!

    for (const mode of VISIBLE_MODES) {
      const art = screen.getByTestId(`art-${mode.id}`)
      expect(art.props.mistakes).toBe(fullyDrawnMistakes(mode))
      expect(art.props.colors).toEqual([colors.primary, colors.secondary, colors.tertiary])
    }
  })

  it("shows the player's saved art as the selected one", async () => {
    store.dispatch(playerSettingsActions.setMode({ playerKey: GUEST_PLAYER_KEY, modeId: robotMode.id }))
    const screen = await renderRow()

    expect(screen.getByRole('button', { name: `${robotMode.label} art`, selected: true })).toBeTruthy()
  })

  it("picks an art on a tap: the player's, selected, with nothing else to confirm", async () => {
    const screen = await renderRow()

    await fireEvent.press(thumbnail(screen, candleMode.label))

    expect(playerArt()).toBe(candleMode.id)
    expect(screen.getByRole('button', { name: `${candleMode.label} art`, selected: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: `${classicMode.label} art`, selected: false })).toBeTruthy()
  })

  // The art is cosmetic, so a pick redraws the round already waiting, guesses and all.
  it("redraws the player's waiting round in the new art, keeping its guesses", async () => {
    seedSoloRound()
    const screen = await renderRow()

    await fireEvent.press(thumbnail(screen, robotMode.label))

    expect(soloRound().puzzle?.modeId).toBe(robotMode.id)
    expect(soloRound().guessedLetters).toEqual(['D', 'Q'])
  })

  it("picks for whoever is playing, leaving every other player's art and round alone", async () => {
    seedSoloRound()
    seedSoloRound('profile-a')
    store.dispatch(activePlayerActions.setActivePlayer('profile-a'))
    const screen = await renderRow()

    await fireEvent.press(thumbnail(screen, robotMode.label))

    expect(playerArt('profile-a')).toBe(robotMode.id)
    expect(soloRound('profile-a').puzzle?.modeId).toBe(robotMode.id)
    expect(playerArt()).toBeUndefined()
    expect(soloRound().puzzle?.modeId).toBe(DEFAULT_MODE.id)
  })

  // Until one is pressed, nothing here runs on a timer, so the art never redraws by itself (the page
  // stays mounted under the game).
  it('never redraws the tiles while the page sits there', async () => {
    jest.useFakeTimers()
    try {
      await renderRow()
      await act(async () => {
        jest.advanceTimersByTime(1000)
      })
      const rendersOnceOpen = mockArtRenders.length

      await act(async () => {
        jest.advanceTimersByTime(20000)
      })

      expect(mockArtRenders.length).toBe(rendersOnceOpen)
    } finally {
      jest.useRealTimers()
    }
  })

  // Like the hero (Jay, 2026-10-18): a press picks the art and acts out a round on its thumbnail,
  // Classic's figure redrawn a guess at a time, then it holds still again.
  it('acts out a round on a pressed thumbnail, then holds it still', async () => {
    jest.useFakeTimers()
    try {
      const screen = await renderRow()
      const art = () => screen.getByTestId(`art-${classicMode.id}`).props.mistakes

      await fireEvent.press(thumbnail(screen, classicMode.label))
      // The figure fades, then is drawn back in one step at a time.
      await act(async () => {
        jest.advanceTimersByTime(200)
      })
      expect(art()).toBe(0)
      await act(async () => {
        jest.advanceTimersByTime(500)
      })
      expect(art()).toBe(1)
      for (let step = 1; step < classicMode.maxMistakes; step++) {
        await act(async () => {
          jest.advanceTimersByTime(500)
        })
      }
      expect(art()).toBe(classicMode.maxMistakes)

      await act(async () => {
        jest.advanceTimersByTime(1000)
      })
      const rendersWhenSettled = mockArtRenders.length
      await act(async () => {
        jest.advanceTimersByTime(20000)
      })
      expect(mockArtRenders.length).toBe(rendersWhenSettled)
      expect(art()).toBe(classicMode.maxMistakes)
    } finally {
      jest.useRealTimers()
    }
  })

  // Out of sight (the page under a game), a round a press started holds still.
  it('holds a round still while paused', async () => {
    jest.useFakeTimers()
    try {
      const screen = await renderRow()
      const art = () => screen.getByTestId(`art-${classicMode.id}`).props.mistakes

      await fireEvent.press(thumbnail(screen, classicMode.label))
      await act(async () => {
        jest.advanceTimersByTime(200)
      })
      const midRound = art()
      await screen.rerender(<Row paused />)
      await act(async () => {
        jest.advanceTimersByTime(5000)
      })

      expect(art()).toBe(midRound)
    } finally {
      jest.useRealTimers()
    }
  })
})
