import { type ThemeSettings, useAutoPaperTheme, useThemeSettings } from '@rific/auto-paper'
import { Toaster } from '@rific/toaster'
import type { FeedbackSounds, StackScreenOptions } from '@tastic/shell'
import * as SystemUI from 'expo-system-ui'
import { Fragment, type JSX, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Platform, useWindowDimensions } from 'react-native'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { ThemeProvider } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector, useStore } from 'react-redux'

import { smallTitleType } from '@/constants/typography'
import { ActiveGameProvider } from '@/hooks/useActiveGame'
import { useActivePlayer } from '@/hooks/useActivePlayer'
import { CatalogProvider } from '@/hooks/useCatalog'
import { useClickSound } from '@/hooks/useClickSound'
import { GameStatsProvider } from '@/hooks/useGameStats'
import { PlayerRoster, ShellSeatOne } from '@/hooks/useProfiles'
import { isSamePlayerTheme, isSamePlayerThemeEntry, playerThemeActions, resolvePlayerTheme, sameColor } from '@/redux/playerThemeSlice'
import type { RootState } from '@/redux/store'
import { setLiveTheme } from '@/utils/liveTheme'
import type { PlayerKey } from '@/utils/players'

import { AutoSaveCustomProvider } from './AutoSaveCustomProvider'
import { boardColor } from './BoardBackground'
import { IncomingFileImport } from './IncomingFileImport'
import { KeyboardLayoutProvider } from './KeyboardLayoutProvider'
import { PackSelectionProvider } from './PackSelectionProvider'
import { PuzzleDefaultsProvider } from './PuzzleDefaultsProvider'

// What the pack hands @tastic/shell's RootLayout: the providers its games run under, its toaster and
// its stack options. Everything else at the root (the store, the theme, profiles, feedback, the splash
// and the update card) is the shell's.

// The toast stack sits in the band between the screens' corner buttons, clear of the result card's
// Next, whatever is on screen: Solitaire's geometry.
const TOAST_TOP = 14
const TOAST_SIDE_CLEARANCE = 60
const TOAST_MAX_WIDTH = 360

export const toastStackFrame = (width: number, insets: { left: number; right: number }): { left: number; right: number; marginTop: number } => {
  const start = TOAST_SIDE_CLEARANCE + insets.left
  const end = width - TOAST_SIDE_CLEARANCE - insets.right
  const stackWidth = Math.min(TOAST_MAX_WIDTH, Math.max(0, end - start))
  const left = start + (end - start - stackWidth) / 2
  return { left, marginTop: TOAST_TOP, right: width - left - stackWidth }
}

// The pack's Toaster, which the shell lays over the whole app. A .alphatastic file opened from another app
// is handled here too: its import card can come up over any screen, and it toasts when it's done, so
// it has to sit under the toast provider, which the pack's Provider is above.
export const PackToaster = (): JSX.Element => {
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  return (
    <>
      <Toaster position='top' wrapperStyle={toastStackFrame(width, insets)} clearButton={null} historyButton={null} limit={1} labelStyle={smallTitleType} />
      <IncomingFileImport />
    </>
  )
}

// The OS window behind everything matches the board, so nothing flashes at the corners during a push.
// After the stack in the tree on purpose: the shell's stack paints the window black as it mounts, and
// this has to land last.
const RootBackground = (): null => {
  const { colors, dark } = useAutoPaperTheme()
  const color = boardColor(dark, colors.surface)
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(color)
  }, [color])
  return null
}

// Each player's colors are their own. A change of player (or of their profile's color) puts their
// colors on screen; any other change of the live theme (the color page, Settings' HARMONY) is filed
// as theirs. A pick lapses when its profile's color has moved on (see resolvePlayerTheme).
const PlayerThemeSync = (): null => {
  const store = useStore<RootState>()
  const dispatch = useDispatch()
  const { key: playerKey, profileId } = useActivePlayer()
  const profileColor = useSelector((state: RootState) => (profileId ? (state.profiles.find((profile) => profile.id === profileId)?.color ?? null) : null))
  const { settings, set } = useThemeSettings()
  const { color, harmony } = settings
  const syncedRef = useRef<{ playerKey: PlayerKey; profileColor: string | null } | null>(null)

  // Before any screen's effects, so the shell's Home reads what's on screen (see utils/liveTheme.ts).
  useLayoutEffect(() => setLiveTheme({ color, harmony }), [color, harmony])

  useEffect(() => {
    const live = { color, harmony }
    const saved = store.getState().playerTheme[playerKey]
    const synced = syncedRef.current
    if (!synced || synced.playerKey !== playerKey || !sameColor(synced.profileColor, profileColor)) {
      syncedRef.current = { playerKey, profileColor }
      const wanted = resolvePlayerTheme(saved, profileColor)
      if (wanted && !isSamePlayerTheme(wanted, live)) {
        set(wanted)
        return
      }
    }
    const next = profileColor ? { ...live, profileColor } : live
    if (!isSamePlayerThemeEntry(saved, next)) dispatch(playerThemeActions.setPlayerTheme({ playerKey, theme: next }))
  }, [playerKey, profileColor, color, harmony, set, store, dispatch])

  return null
}

// Dialog cards are more solid than the fleet's default (0.2), since the board's thick, bright art read
// clearly through them, right behind a card's title and answer (Jay's dialog audit, 2026-10-19).
export const CARD_BLUR_TINT: NonNullable<ThemeSettings['blurTint']> = 0.7

const CardBlur = (): null => {
  const { settings, set } = useThemeSettings()
  useEffect(() => {
    if (settings.blurTint !== CARD_BLUR_TINT) set({ blurTint: CARD_BLUR_TINT })
  }, [settings.blurTint, set])
  return null
}

// MD3's grey scrim lifted the dark chalkboard to the cards' own color and a card's edge vanished, so
// in dark appearance every card's scrim is black.
export const DARK_BACKDROP = 'rgba(0, 0, 0, 0.6)'

// The theme's part of the pack's root: every card's frost and scrim, the active player's colors, and
// the OS window behind it all.
export const PackTheme = ({ children }: { children: ReactNode }): JSX.Element => {
  const theme = useAutoPaperTheme()
  const scrimTheme = useMemo(() => (theme.dark ? { ...theme, colors: { ...theme.colors, backdrop: DARK_BACKDROP } } : theme), [theme])
  return (
    <ThemeProvider theme={scrimTheme}>
      <CardBlur />
      <PlayerThemeSync />
      {children}
      <RootBackground />
    </ThemeProvider>
  )
}

const KeyboardWrapper = Platform.OS === 'web' ? Fragment : KeyboardProvider

// The pack's Provider: inside the shell's store, theme and profiles, around every screen.
export const PackProviders = ({ children }: { children: ReactNode }): JSX.Element => (
  <PackTheme>
    <KeyboardWrapper>
      <KeyboardLayoutProvider>
        <AutoSaveCustomProvider>
          {/* Above the pack selection, whose "every pack" follows its packsVersion, and above every
              reader of the unlocked puzzles (usePuzzleUnlocks). */}
          <CatalogProvider>
            <PackSelectionProvider>
              <PuzzleDefaultsProvider>
                {/* Never keyed or gated, so its one mount-time catalog sweep never runs twice. */}
                <GameStatsProvider>
                  <ActiveGameProvider>
                    <PlayerRoster />
                    <ShellSeatOne />
                    {children}
                  </ActiveGameProvider>
                </GameStatsProvider>
              </PuzzleDefaultsProvider>
            </PackSelectionProvider>
          </CatalogProvider>
        </AutoSaveCustomProvider>
      </KeyboardLayoutProvider>
    </KeyboardWrapper>
  </PackTheme>
)

// The status bar's ink follows the in-app theme. The shell keeps it light over any backdrop, since its
// other backdrop is dark felt, but this board is a whiteboard in light appearance.
export const useScreenOptions = (): StackScreenOptions => {
  const { dark } = useAutoPaperTheme()
  return useMemo(() => ({ statusBarStyle: dark ? 'light' : 'dark' }), [dark])
}

const noSound = () => {}

// Every button's press plays Hangman's click (feedback-press checks the Sound setting first).
export const useFeedbackSounds = (): FeedbackSounds => {
  const { playClick } = useClickSound()
  return useMemo(() => ({ selection: playClick, notification: noSound }), [playClick])
}
