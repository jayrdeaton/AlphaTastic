import { Button, IconButton } from '@rific/feedback-press'
import { ConfirmDialog } from '@tastic/hud/chrome'
import { JSX, useCallback, useEffect, useState } from 'react'
import { type LayoutChangeEvent, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Portal, Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { DEFAULT_CELEBRATION } from '@/effects/registry'
import { useGameHaptics } from '@/hooks/useGameHaptics'
import { usePackSelection } from '@/hooks/usePackSelection'
import { usePuzzleDefaults } from '@/hooks/usePuzzleDefaults'
import { useSoundEffects } from '@/hooks/useSoundEffects'
import { goHome, safeBack } from '@/utils/navigation'
import { gameShell } from '@/utils/webLayout'
import { drawWordSearch, findSelectedWord, type GridCell, type WordSearchBoard } from '@/utils/wordSearch'

import { ReadableAccent } from './ReadableAccent'
import { ScreenHeader } from './ScreenHeader'
import { type FoundWord, WordSearchGrid } from './WordSearchGrid'

// A win's fireworks get a moment before the card covers them, as a solved Hangman puzzle's do.
const SOLVED_CARD_DELAY_MS = 2000
const COLUMN_MAX_WIDTH = 480
const GUTTER = 16
const HEADER_HEIGHT = 64
const WORD_ROW_HEIGHT = 26
const WORD_COLUMNS = 2
const PROGRESS_HEIGHT = 36
const CelebrationView = DEFAULT_CELEBRATION.Component

const formatElapsed = (ms: number): string => {
  const seconds = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

type Puzzle = { board: WordSearchBoard | null; startedAt: number }

// A prototype of Word Search, built to find out whether grids themed by the packs are fun. A grid comes
// from one of the active player's selected packs, and their Difficulty sets its size and directions
// (see wordSearch.ts). Nothing is saved yet: leaving drops the puzzle, and it adds to no stats.
export const WordSearchScreen = (): JSX.Element => {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  const { selectedPackKeys } = usePackSelection()
  const { difficulty } = usePuzzleDefaults()
  const { correctGuess, win } = useGameHaptics()
  const { playCorrect, playWin } = useSoundEffects()

  const draw = useCallback((): Puzzle => ({ board: drawWordSearch(selectedPackKeys, difficulty), startedAt: Date.now() }), [selectedPackKeys, difficulty])
  const [puzzle, setPuzzle] = useState(draw)
  const [found, setFound] = useState<FoundWord[]>([])
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [cardVisible, setCardVisible] = useState(false)
  const [celebrationCycle, setCelebrationCycle] = useState(0)
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null)

  const { board, startedAt } = puzzle
  const solved = elapsedMs !== null

  useEffect(() => {
    if (!solved) return
    const timeout = setTimeout(() => setCardVisible(true), SOLVED_CARD_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [solved])

  const newPuzzle = useCallback(() => {
    setPuzzle(draw())
    setFound([])
    setElapsedMs(null)
    setCardVisible(false)
  }, [draw])

  const handleSelect = useCallback(
    (start: GridCell, end: GridCell) => {
      if (!board) return
      const word = findSelectedWord(
        board,
        found.map(({ id }) => id),
        start,
        end
      )
      if (!word) return
      const next = [...found, { id: word.id, start, end }]
      setFound(next)
      if (next.length < board.words.length) {
        correctGuess()
        playCorrect()
        return
      }
      win()
      playWin()
      setElapsedMs(Date.now() - startedAt)
    },
    [board, found, startedAt, correctGuess, playCorrect, win, playWin]
  )

  const handleLayout = useCallback(({ nativeEvent: { layout } }: LayoutChangeEvent) => setMeasured({ width: layout.width, height: layout.height }), [])

  if (!board) {
    return (
      <View style={[styles.screen, gameShell]}>
        <ScreenHeader icon='arrow-left' label='Back' onPress={safeBack} title='Word Search' />
        <View style={styles.empty}>
          <Text variant='bodyLarge' style={[styles.emptyText, { color: theme.colors.onSurface }]}>
            None of your selected packs has enough short answers for a grid.
          </Text>
          <Button mode='contained' icon='cards-outline' onPress={safeBack}>
            Choose Packs
          </Button>
        </View>
      </View>
    )
  }

  // The list keeps its full height, and the grid takes what's left, in whole points per cell so its
  // letters and bands stay crisp. Until the body has been measured, the window stands in for it.
  const { size, words } = board
  const width = measured?.width ?? Math.min(window.width, COLUMN_MAX_WIDTH)
  const height = measured?.height ?? window.height - insets.top - insets.bottom - HEADER_HEIGHT
  const listHeight = Math.ceil(words.length / WORD_COLUMNS) * WORD_ROW_HEIGHT + PROGRESS_HEIGHT
  const cellSize = Math.max(16, Math.floor(Math.min(width - GUTTER * 2, height - listHeight) / size))
  const foundIds = new Set(found.map(({ id }) => id))

  return (
    <View style={[styles.screen, gameShell]}>
      <ScreenHeader icon='arrow-left' label='Back' onPress={safeBack} title={board.packLabel} trailing={<IconButton icon='refresh' iconColor={theme.colors.onSurface} size={24} hitSlop={4} onPress={newPuzzle} accessibilityLabel='New puzzle' />} />
      <View style={[styles.body, { paddingBottom: insets.bottom }]}>
        <View style={styles.fill} onLayout={handleLayout}>
          <View style={styles.centered}>
            <WordSearchGrid board={board} cellSize={cellSize} found={found} disabled={solved} onSelect={handleSelect} />
            <Text testID='word-search-progress' variant='labelLarge' style={[styles.progress, { color: theme.colors.onSurfaceVariant }]}>
              {found.length} of {words.length} found
            </Text>
            <View style={[styles.words, { width: cellSize * size }]}>
              {words.map((word) => {
                const isFound = foundIds.has(word.id)
                return (
                  <Text key={word.id} testID={`word-search-word-${word.id}`} variant='bodyMedium' numberOfLines={1} accessibilityLabel={isFound ? `${word.answer}, found` : word.answer} style={[styles.word, { color: isFound ? theme.colors.onSurfaceVariant : theme.colors.onSurface }, isFound && styles.wordFound]}>
                    {word.answer}
                  </Text>
                )
              })}
            </View>
          </View>
        </View>
      </View>

      {solved && !cardVisible ? (
        <Portal>
          <CelebrationView key={celebrationCycle} colors={[theme.colors.primary, theme.colors.secondary, theme.colors.tertiary]} dark={theme.dark} onComplete={() => setCelebrationCycle((cycle) => cycle + 1)} />
        </Portal>
      ) : null}
      <ReadableAccent>
        <ConfirmDialog visible={cardVisible} icon='trophy' title='Puzzle Solved!' message={`You found all ${words.length} in ${formatElapsed(elapsedMs ?? 0)}.`} confirmLabel='Next Puzzle' cancelLabel='Home' onConfirm={newPuzzle} onCancel={goHome} />
      </ReadableAccent>
    </View>
  )
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  centered: { alignItems: 'center' },
  empty: { alignItems: 'center', flex: 1, gap: 24, justifyContent: 'center', padding: 32 },
  emptyText: { textAlign: 'center' },
  fill: { flex: 1, justifyContent: 'center' },
  progress: { lineHeight: PROGRESS_HEIGHT },
  screen: { flex: 1 },
  word: { lineHeight: WORD_ROW_HEIGHT, paddingRight: 8, width: `${100 / WORD_COLUMNS}%` },
  wordFound: { opacity: 0.6, textDecorationLine: 'line-through' },
  words: { flexDirection: 'row', flexWrap: 'wrap' }
})
