import { IconButton } from '@rific/feedback-press'
import { JSX, useCallback, useState } from 'react'
import { type LayoutChangeEvent, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { WORD_SEARCH_GAME_ID } from '@/constants/games'
import { useGameHaptics } from '@/hooks/useGameHaptics'
import { usePackSelection } from '@/hooks/usePackSelection'
import { usePuzzleOptions } from '@/hooks/usePuzzleOptions'
import { useSoundEffects } from '@/hooks/useSoundEffects'
import { safeBack } from '@/utils/navigation'
import { gameShell } from '@/utils/webLayout'
import { drawWordSearch, findSelectedWord, type GridCell, type WordSearchBoard } from '@/utils/wordSearch'

import { formatElapsed, PuzzleSolvedCelebration, PuzzleUnavailable } from './PuzzleScreenParts'
import { ScreenHeader } from './ScreenHeader'
import { type FoundWord, WordSearchGrid } from './WordSearchGrid'

const COLUMN_MAX_WIDTH = 480
const GUTTER = 16
const HEADER_HEIGHT = 64
const WORD_ROW_HEIGHT = 26
const WORD_COLUMNS = 2
const PROGRESS_HEIGHT = 36

type Puzzle = { board: WordSearchBoard | null; startedAt: number }

// A prototype of Word Search, built to find out whether grids themed by the packs are fun. A grid comes
// from one of the active player's selected packs, and their settings set its size and directions
// (see wordSearch.ts). Nothing is saved yet: leaving drops the puzzle, and it adds to no stats.
export const WordSearchScreen = (): JSX.Element => {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  const { selectedPackKeys } = usePackSelection()
  const { options } = usePuzzleOptions(WORD_SEARCH_GAME_ID)
  const { correctGuess, win } = useGameHaptics()
  const { playCorrect, playWin } = useSoundEffects()

  const draw = useCallback((): Puzzle => ({ board: drawWordSearch(selectedPackKeys, options), startedAt: Date.now() }), [selectedPackKeys, options])
  const [puzzle, setPuzzle] = useState(draw)
  const [found, setFound] = useState<FoundWord[]>([])
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null)

  const { board, startedAt } = puzzle
  const solved = elapsedMs !== null

  const newPuzzle = useCallback(() => {
    setPuzzle(draw())
    setFound([])
    setElapsedMs(null)
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

  if (!board) return <PuzzleUnavailable title='Word Search' message='None of your selected packs has enough short answers for a grid.' />

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

      {elapsedMs !== null ? <PuzzleSolvedCelebration message={`You found all ${words.length} in ${formatElapsed(elapsedMs)}.`} onNext={newPuzzle} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  centered: { alignItems: 'center' },
  fill: { flex: 1, justifyContent: 'center' },
  progress: { lineHeight: PROGRESS_HEIGHT },
  screen: { flex: 1 },
  word: { lineHeight: WORD_ROW_HEIGHT, paddingRight: 8, width: `${100 / WORD_COLUMNS}%` },
  wordFound: { opacity: 0.6, textDecorationLine: 'line-through' },
  words: { flexDirection: 'row', flexWrap: 'wrap' }
})
