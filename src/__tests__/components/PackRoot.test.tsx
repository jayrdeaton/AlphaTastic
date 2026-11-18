import '@tastic/core'

import { Provider as AutoPaperProvider, themeActions, type ThemeSettings, useAutoPaperTheme, useThemeSettings } from '@rific/auto-paper'
import { type Profile, profilesActions } from '@tastic/profile'
import { act, render, renderHook, waitFor } from '@testing-library/react-native'
import { setBackgroundColorAsync } from 'expo-system-ui'
import { type ReactNode, useCallback, useEffect } from 'react'
import { Provider as ReduxProvider, shallowEqual, useDispatch, useSelector } from 'react-redux'

import { boardColor } from '@/components/BoardBackground'
import { CARD_BLUR_TINT, DARK_BACKDROP, PackTheme, toastStackFrame, useScreenOptions } from '@/components/PackRoot'
import { activePlayerActions } from '@/redux/activePlayerSlice'
import { DEFAULT_HARMONY, playerThemeActions } from '@/redux/playerThemeSlice'
import { type RootState, store } from '@/redux/store'
import { getLiveTheme } from '@/utils/liveTheme'
import { GUEST_PLAYER_KEY } from '@/utils/players'

// Stubbed so the calls can be read back. The bare '@tastic/core' import above stands in for the app
// loading it through the shell.
jest.mock('expo-system-ui', () => ({
  setBackgroundColorAsync: jest.fn().mockResolvedValue(undefined)
}))

const mockSetBackgroundColorAsync = jest.mocked(setBackgroundColorAsync)

// Reads the board color for the theme Theme's Provider actually computed (what BoardBackground paints
// behind every screen), and hands out its settings setter.
let paintedBoard: string | null = null
let setThemeSettings: ((patch: Partial<ThemeSettings>) => void) | null = null
let liveSettings: ThemeSettings | null = null
let liveBackdrop: string | null = null
const ThemeProbe = () => {
  const { colors, dark } = useAutoPaperTheme()
  const { settings, set } = useThemeSettings()
  useEffect(() => {
    paintedBoard = boardColor(dark, colors.surface)
    setThemeSettings = set
    liveSettings = settings
    liveBackdrop = colors.backdrop
  }, [colors.surface, colors.backdrop, dark, set, settings])
  return null
}

// The shell's Theme, as far as these need it: auto-paper's Provider over the store's theme.
const StoreTheme = ({ children }: { children: ReactNode }) => {
  const settings = useSelector((state: RootState) => state.theme, shallowEqual)
  const dispatch = useDispatch()
  const onChange = useCallback((next: ThemeSettings) => dispatch(themeActions.initialize(next)), [dispatch])
  return (
    <AutoPaperProvider initialValue={settings} onChange={onChange} statusBar={false}>
      {children}
    </AutoPaperProvider>
  )
}

const Wrapper = ({ children }: { children: ReactNode }) => (
  <ReduxProvider store={store}>
    <StoreTheme>{children}</StoreTheme>
  </ReduxProvider>
)

const renderTheme = () =>
  render(
    <Wrapper>
      <PackTheme>
        <ThemeProbe />
      </PackTheme>
    </Wrapper>
  )

describe('PackTheme', () => {
  it("paints the OS window with the board's color", async () => {
    await renderTheme()
    await waitFor(() => expect(paintedBoard).not.toBeNull())

    expect(mockSetBackgroundColorAsync).toHaveBeenLastCalledWith(paintedBoard)
  })

  it('repaints it again when the appearance changes', async () => {
    await renderTheme()
    await waitFor(() => expect(setThemeSettings).not.toBeNull())
    await act(async () => {
      setThemeSettings?.({ appearance: 'light' })
    })
    const light = paintedBoard

    await act(async () => {
      setThemeSettings?.({ appearance: 'dark' })
    })

    expect(paintedBoard).not.toBe(light)
    expect(mockSetBackgroundColorAsync).toHaveBeenLastCalledWith(paintedBoard)
  })

  // Jay, 2026-10-19: the board's art read through every card at auto-paper's 0.2.
  it("frosts every card and sheet with Hangman's own tint, whatever is stored", async () => {
    await renderTheme()
    await waitFor(() => expect(liveSettings).not.toBeNull())

    expect(liveSettings?.blurTint).toBe(CARD_BLUR_TINT)
  })

  // Jay, 2026-10-19: MD3's grey scrim lifted the dark chalkboard to the cards' own color.
  it('puts a black scrim behind every card in dark appearance, and keeps MD3s in light', async () => {
    await renderTheme()
    await waitFor(() => expect(setThemeSettings).not.toBeNull())
    await act(async () => {
      setThemeSettings?.({ appearance: 'dark' })
    })
    expect(liveBackdrop).toBe(DARK_BACKDROP)

    await act(async () => {
      setThemeSettings?.({ appearance: 'light' })
    })
    expect(liveBackdrop).not.toBe(DARK_BACKDROP)
  })
})

// Each player's colors (the palette and its harmony): the live theme always holds the active player's.
describe("PackTheme's per-player colors", () => {
  const OTHER = 'profile-a'
  const live = () => ({ color: liveSettings?.color, harmony: liveSettings?.harmony })
  const saved = (playerKey = GUEST_PLAYER_KEY) => store.getState().playerTheme[playerKey]
  const setActivePlayer = (profileId: string | null) =>
    act(async () => {
      store.dispatch(activePlayerActions.setActivePlayer(profileId))
    })

  beforeEach(() => {
    store.dispatch(activePlayerActions.setActivePlayer(null))
    store.dispatch(playerThemeActions.reset())
    store.dispatch(profilesActions.setAll([]))
    liveSettings = null
  })

  it("saves the colors on screen as the guest's when the guest has none", async () => {
    await renderTheme()
    await waitFor(() => expect(liveSettings).not.toBeNull())

    expect(saved()).toEqual(live())
  })

  // The shell's Home keeps the theme on its seat colors, through the pack's seatTheme, which answers with
  // this: so Home always finds the theme already right.
  it('keeps the colors on screen where the pack can read them', async () => {
    await renderTheme()
    await waitFor(() => expect(setThemeSettings).not.toBeNull())

    await act(async () => {
      setThemeSettings?.({ color: '#2196f3', harmony: 'triadic' })
    })

    expect(getLiveTheme()).toEqual({ color: '#2196f3', harmony: 'triadic' })
  })

  it("saves a palette change as the active player's", async () => {
    await renderTheme()
    await waitFor(() => expect(setThemeSettings).not.toBeNull())

    await act(async () => {
      setThemeSettings?.({ color: '#2196f3', harmony: 'triadic' })
    })

    expect(saved()).toEqual({ color: '#2196f3', harmony: 'triadic' })
  })

  // Appearance and Blur stay the device's.
  it('leaves the saved colors alone when only the appearance changes', async () => {
    await renderTheme()
    await waitFor(() => expect(setThemeSettings).not.toBeNull())
    const before = store.getState().playerTheme

    await act(async () => {
      setThemeSettings?.({ appearance: 'dark' })
    })

    expect(store.getState().playerTheme).toBe(before)
  })

  it("puts a player's saved colors on screen when they become the active player, and the guest's back after", async () => {
    store.dispatch(playerThemeActions.setPlayerTheme({ playerKey: OTHER, theme: { color: '#4caf50', harmony: 'analogous' } }))
    await renderTheme()
    await waitFor(() => expect(liveSettings).not.toBeNull())
    const guestColors = live()

    await setActivePlayer(OTHER)
    expect(live()).toEqual({ color: '#4caf50', harmony: 'analogous' })
    // Putting them on screen writes nothing: they already match.
    expect(saved(OTHER)).toEqual({ color: '#4caf50', harmony: 'analogous' })

    await setActivePlayer(null)
    expect(live()).toEqual(guestColors)
  })

  // A profile the roster doesn't have (yet) has no color of its own to go on.
  it('keeps the colors on screen for a player with none saved and no profile color, and saves them as theirs', async () => {
    await renderTheme()
    await waitFor(() => expect(liveSettings).not.toBeNull())
    const onScreen = live()

    await setActivePlayer(OTHER)

    expect(live()).toEqual(onScreen)
    expect(saved(OTHER)).toEqual(onScreen)
  })
})

// A profile's colors: their Hangman pick while the profile keeps the color it was picked against, else
// the profile's own color (with the harmony they picked, or the default).
describe("PackTheme's profile colors", () => {
  const ALICE: Profile = { id: 'profile-a', name: 'Alice', color: '#9c27b0', tag: 'A', createdAt: 1, updatedAt: 1 }
  const live = () => ({ color: liveSettings?.color, harmony: liveSettings?.harmony })
  const saved = (playerKey: string = ALICE.id) => store.getState().playerTheme[playerKey]
  const act$ = (run: () => void) => act(async () => run())

  beforeEach(() => {
    store.dispatch(activePlayerActions.setActivePlayer(null))
    store.dispatch(playerThemeActions.reset())
    store.dispatch(profilesActions.setAll([ALICE]))
    liveSettings = null
  })

  it("plays a profile with nothing picked in the profile's own color and the default harmony, saved against that color", async () => {
    await renderTheme()
    await waitFor(() => expect(liveSettings).not.toBeNull())

    await act$(() => store.dispatch(activePlayerActions.setActivePlayer(ALICE.id)))

    expect(live()).toEqual({ color: ALICE.color, harmony: DEFAULT_HARMONY })
    expect(saved()).toEqual({ color: ALICE.color, harmony: DEFAULT_HARMONY, profileColor: ALICE.color })
  })

  it("saves a palette or harmony change as the profile's pick, against the profile's color", async () => {
    store.dispatch(activePlayerActions.setActivePlayer(ALICE.id))
    await renderTheme()
    await waitFor(() => expect(setThemeSettings).not.toBeNull())

    await act$(() => setThemeSettings?.({ color: '#2196f3' }))
    await act$(() => setThemeSettings?.({ harmony: 'triadic' }))

    expect(saved()).toEqual({ color: '#2196f3', harmony: 'triadic', profileColor: ALICE.color })
  })

  it('puts a pick on screen while the profile still has the color it was picked against, in any case', async () => {
    store.dispatch(playerThemeActions.setPlayerTheme({ playerKey: ALICE.id, theme: { color: '#2196f3', harmony: 'square', profileColor: ALICE.color.toUpperCase() } }))
    await renderTheme()

    await act$(() => store.dispatch(activePlayerActions.setActivePlayer(ALICE.id)))

    expect(live()).toEqual({ color: '#2196f3', harmony: 'square' })
  })

  it("lets the pick lapse once the profile's own color changes, at once for the active player, keeping their harmony", async () => {
    store.dispatch(playerThemeActions.setPlayerTheme({ playerKey: ALICE.id, theme: { color: '#2196f3', harmony: 'square', profileColor: ALICE.color } }))
    store.dispatch(activePlayerActions.setActivePlayer(ALICE.id))
    await renderTheme()
    await waitFor(() => expect(live()).toEqual({ color: '#2196f3', harmony: 'square' }))

    await act$(() => store.dispatch(profilesActions.update({ id: ALICE.id, patch: { color: '#ff9800' } })))

    expect(live()).toEqual({ color: '#ff9800', harmony: 'square' })
    // Rewritten against the new color, so a change back to the old one can't bring the old pick back.
    expect(saved()).toEqual({ color: '#ff9800', harmony: 'square', profileColor: '#ff9800' })
  })

  it('lets the pick lapse for a profile recolored while someone else was playing, once they play again', async () => {
    store.dispatch(playerThemeActions.setPlayerTheme({ playerKey: ALICE.id, theme: { color: '#2196f3', harmony: 'square', profileColor: '#000000' } }))
    await renderTheme()
    await waitFor(() => expect(liveSettings).not.toBeNull())

    await act$(() => store.dispatch(activePlayerActions.setActivePlayer(ALICE.id)))

    expect(live()).toEqual({ color: ALICE.color, harmony: 'square' })
  })

  it('leaves a rename alone: the pick holds and nothing is written', async () => {
    store.dispatch(playerThemeActions.setPlayerTheme({ playerKey: ALICE.id, theme: { color: '#2196f3', harmony: 'square', profileColor: ALICE.color } }))
    store.dispatch(activePlayerActions.setActivePlayer(ALICE.id))
    await renderTheme()
    await waitFor(() => expect(live()).toEqual({ color: '#2196f3', harmony: 'square' }))
    const before = store.getState().playerTheme

    await act$(() => store.dispatch(profilesActions.update({ id: ALICE.id, patch: { name: 'Ali' } })))

    expect(live()).toEqual({ color: '#2196f3', harmony: 'square' })
    expect(store.getState().playerTheme).toBe(before)
  })

  it("puts the guest's colors back when the profile stops playing", async () => {
    store.dispatch(playerThemeActions.setPlayerTheme({ playerKey: GUEST_PLAYER_KEY, theme: { color: '#4caf50', harmony: 'analogous' } }))
    await renderTheme()
    await waitFor(() => expect(live()).toEqual({ color: '#4caf50', harmony: 'analogous' }))

    await act$(() => store.dispatch(activePlayerActions.setActivePlayer(ALICE.id)))
    expect(live()).toEqual({ color: ALICE.color, harmony: DEFAULT_HARMONY })
    await act$(() => store.dispatch(activePlayerActions.setActivePlayer(null)))

    expect(live()).toEqual({ color: '#4caf50', harmony: 'analogous' })
  })
})

describe('useScreenOptions', () => {
  // The shell keeps the ink light over any backdrop; this board is a whiteboard in light appearance.
  it.each([
    ['light', 'dark'],
    ['dark', 'light']
  ] as const)('writes the status bar for a %s board in %s ink', async (appearance, ink) => {
    store.dispatch(themeActions.initialize({ ...store.getState().theme, appearance }))
    const { result } = await renderHook(() => useScreenOptions(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current).toEqual({ statusBarStyle: ink }))
  })
})

describe('toastStackFrame', () => {
  it('sits between the corner buttons, at most 360 wide', () => {
    expect(toastStackFrame(375, { left: 0, right: 0 })).toEqual({ left: 60, right: 60, marginTop: 14 })
    expect(toastStackFrame(1000, { left: 0, right: 0 })).toEqual({ left: 320, right: 320, marginTop: 14 })
  })
})
