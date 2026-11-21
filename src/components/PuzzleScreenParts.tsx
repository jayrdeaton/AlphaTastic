import { Button } from '@rific/feedback-press'
import { ConfirmDialog, CornerActionButtons } from '@tastic/hud/chrome'
import { SettingsDialog } from '@tastic/shell'
import { createContext, JSX, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Portal, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { DEFAULT_CELEBRATION } from '@/effects/registry'
import { safeBack } from '@/utils/navigation'
import { gameShell } from '@/utils/webLayout'

import { PuzzleInfoRow, type PuzzleInfoRowProps } from './PuzzleInfoRow'
import { ReadableAccent } from './ReadableAccent'

// A win's fireworks get a moment before the card covers them, as a solved Hangman puzzle's do.
const SOLVED_CARD_DELAY_MS = 2000
const CelebrationView = DEFAULT_CELEBRATION.Component

export const formatElapsed = (ms: number): string => {
  const seconds = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// How a puzzle game ends: fireworks, then a card with Next Puzzle and Back (to its setup screen, as the
// header's arrow goes). Mounted once it's solved.
export const PuzzleSolvedCelebration = ({ message, onNext }: { message: string; onNext: () => void }): JSX.Element => {
  const theme = useTheme()
  const [cardVisible, setCardVisible] = useState(false)
  const [celebrationCycle, setCelebrationCycle] = useState(0)

  useEffect(() => {
    const timeout = setTimeout(() => setCardVisible(true), SOLVED_CARD_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [])

  return (
    <>
      {!cardVisible ? (
        <Portal>
          <CelebrationView key={celebrationCycle} colors={[theme.colors.primary, theme.colors.secondary, theme.colors.tertiary]} dark={theme.dark} onComplete={() => setCelebrationCycle((cycle) => cycle + 1)} />
        </Portal>
      ) : null}
      <ReadableAccent>
        <ConfirmDialog visible={cardVisible} icon='trophy' title='Puzzle Solved!' message={message} confirmLabel='Next Puzzle' cancelLabel='Back' onConfirm={onNext} onCancel={safeBack} />
      </ReadableAccent>
    </>
  )
}

// Whether the frame's Settings sheet is open, so a board stops taking a computer's keys under it.
const SettingsOpenContext = createContext(false)
export const usePuzzleSettingsOpen = (): boolean => useContext(SettingsOpenContext)

// The band the pills sit in under the corners (PuzzleInfoRow's hintSlot: 15 above, 38 tall, 4 below),
// held open when there are no pills, so every board starts at the same place.
export const PUZZLE_TOP_HEIGHT = 57

type PuzzleBoardFrameProps = Partial<Pick<PuzzleInfoRowProps, 'difficultyTier' | 'packLabel' | 'hint' | 'hintRevealed' | 'onRevealHint'>> & { children: ReactNode }

// A puzzle game's board, framed as Hangman's is (Jay, 2026-11-19): the back arrow and the Settings cog in
// the corners, and between them Hangman's pills, the answer's difficulty and Hint (the pack, then the
// clue, once pressed), in place of a title and a New puzzle button. Back goes to the setup screen, whose
// Ready deals a new puzzle (nothing here is saved). The board sits in the game's column; the corners
// are the screen's, as on Hangman's board.
export const PuzzleBoardFrame = ({ difficultyTier, packLabel, hint, hintRevealed = false, onRevealHint, children }: PuzzleBoardFrameProps): JSX.Element => {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const noop = useCallback(() => undefined, [])
  return (
    <SettingsOpenContext.Provider value={settingsOpen}>
      <View style={styles.screen}>
        <View style={[styles.screen, gameShell, { paddingTop: insets.top }]}>
          <View style={styles.top}>
            <PuzzleInfoRow difficultyTier={difficultyTier} packLabel={packLabel} hint={hint} hintRevealed={hintRevealed} onRevealHint={onRevealHint ?? noop} />
          </View>
          {children}
        </View>
        <View style={[StyleSheet.absoluteFill, styles.corners]} pointerEvents='box-none'>
          <CornerActionButtons onBack={safeBack} onSettings={openSettings} fg={theme.colors.onSurface} insets={insets} hitSlop={4} />
        </View>
        <SettingsDialog visible={settingsOpen} onDismiss={closeSettings} />
      </View>
    </SettingsOpenContext.Provider>
  )
}

// What a puzzle game shows when none of the player's selected packs can make a puzzle for it.
export const PuzzleUnavailable = ({ message }: { message: string }): JSX.Element => {
  const theme = useTheme()
  return (
    <PuzzleBoardFrame>
      <View style={styles.empty}>
        <Text variant='bodyLarge' style={[styles.emptyText, { color: theme.colors.onSurface }]}>
          {message}
        </Text>
        <Button mode='contained' icon='cards-outline' onPress={safeBack}>
          Choose Packs
        </Button>
      </View>
    </PuzzleBoardFrame>
  )
}

const styles = StyleSheet.create({
  corners: { zIndex: 10 },
  empty: { alignItems: 'center', flex: 1, gap: 24, justifyContent: 'center', padding: 32 },
  emptyText: { textAlign: 'center' },
  screen: { flex: 1 },
  top: { minHeight: PUZZLE_TOP_HEIGHT }
})
