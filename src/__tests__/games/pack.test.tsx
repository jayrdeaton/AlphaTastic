import { render } from '@testing-library/react-native'
import type { Href } from 'expo-router'
import { Provider as PaperProvider } from 'react-native-paper'

import { HANGMAN_GAME_ID, WORD_SEARCH_GAME_ID } from '@/constants/games'
import { games, pack } from '@/games/pack'
import { roundActions } from '@/redux/roundSlice'
import { store } from '@/redux/store'
import { DEFAULT_THEME, getLiveTheme, setLiveTheme } from '@/utils/liveTheme'
import { gameHref, loadoutHref } from '@/utils/navigation'

const resumeHref = (id: string): Href | null | undefined => pack.resumeHref?.(id)

describe('the pack', () => {
  beforeEach(() => {
    store.dispatch(roundActions.reset())
    setLiveTheme(DEFAULT_THEME)
  })

  it('is AlphaTastic, with no player picker on Home', () => {
    expect(pack).toMatchObject({ name: 'AlphaTastic', wordmark: ['Alpha', 'Tastic'], colorCaption: 'AlphaTastic only', homePlayerPicker: false, edgeGuard: false })
  })

  it('solves its wordmark on Home, one word to a line', async () => {
    const { HeroTitle } = pack
    const screen = await render(
      <PaperProvider>
        <HeroTitle words={pack.wordmark} color='#000000' p1Color='#f44336' p2Color='#2196f3' active={false} />
      </PaperProvider>
    )

    expect(screen.getByLabelText('AlphaTastic')).toBeTruthy()
  })

  it('has a card for Hangman, then Word Search, each opening a setup page', () => {
    expect(games.map((game) => game.id)).toEqual([HANGMAN_GAME_ID, WORD_SEARCH_GAME_ID])
    for (const game of games) {
      expect(game.Preview).toEqual(expect.any(Function))
      expect(game.useLoadout).toEqual(expect.any(Function))
      expect(game.keepStatusBar).toBe(true)
    }
  })

  // Word Search's rounds aren't saved yet, so there's nothing to come back to.
  it('comes back to Hangman after a cold launch, and only Hangman', () => {
    expect(games.map((game) => Boolean(game.resumable))).toEqual([true, false])
    expect(resumeHref(WORD_SEARCH_GAME_ID)).toBeNull()
  })

  it('goes back to the Hangman board left open, in the mode it was played from', () => {
    store.dispatch(roundActions.setActiveMode('solo', 'pnp'))

    expect(resumeHref(HANGMAN_GAME_ID)).toEqual(gameHref('solo', 'pnp'))
  })

  it("goes to Hangman's setup page with no board marked open", () => {
    expect(resumeHref(HANGMAN_GAME_ID)).toEqual(loadoutHref())
  })

  // Home would otherwise put its seat colors on screen over the active player's.
  it("answers the shell's seat theme with the colors on screen", () => {
    setLiveTheme({ color: '#123456', harmony: 'triadic' })

    expect(pack.seatTheme?.({ 1: '#f44336', 2: '#2196f3' }, false)).toEqual(getLiveTheme())
  })
})
