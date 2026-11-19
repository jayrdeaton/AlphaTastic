import { JSX, memo, useLayoutEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useTheme } from 'react-native-paper'
import Svg, { Line, Path } from 'react-native-svg'

import { glyphWidth, sketchGlyphPath } from '@/modes/shared/sketchLetter'
import { type GridCell, snapWordSearchSelection, wordSearchCellAt, type WordSearchGrid as Board } from '@/utils/wordSearch'

export type FoundWord = { id: string; start: GridCell; end: GridCell }
type Selection = { start: GridCell; end: GridCell }

export type WordSearchGridProps = {
  board: Pick<Board, 'size' | 'grid'>
  cellSize: number
  found: readonly FoundWord[]
  disabled: boolean
  onSelect: (start: GridCell, end: GridCell) => void
}

const LETTER_HEIGHT = 0.58
const BAND_WIDTH = 0.76
const FOUND_OPACITY = 0.38
const SELECTION_OPACITY = 0.55

const sameCell = (a: GridCell, b: GridCell) => a.row === b.row && a.col === b.col

// The whole grid as one path in the board's sketch letters: 144 letters of separate strokes would be
// hundreds of native views, and it never changes during a puzzle.
const lettersPath = (grid: string[][], cellSize: number): string => {
  const height = cellSize * LETTER_HEIGHT
  const top = (cellSize - height) / 2
  return grid.flatMap((letters, row) => letters.map((letter, col) => sketchGlyphPath(letter, col * cellSize + (cellSize - glyphWidth(letter, height)) / 2, row * cellSize + top, height))).join(' ')
}

const GridLetters = memo(({ grid, cellSize }: { grid: string[][]; cellSize: number }): JSX.Element => {
  const theme = useTheme()
  const d = useMemo(() => lettersPath(grid, cellSize), [grid, cellSize])
  return (
    <Svg width={cellSize * grid[0].length} height={cellSize * grid.length} style={StyleSheet.absoluteFill} pointerEvents='none'>
      <Path testID='word-search-letters' d={d} fill='none' stroke={theme.colors.onSurface} strokeWidth={Math.max(1.5, cellSize * 0.07)} strokeLinecap='round' strokeLinejoin='round' />
    </Svg>
  )
})
GridLetters.displayName = 'GridLetters'

// The band laid over a word, under the letters so they stay readable.
const Band = ({ start, end, cellSize, color, opacity, testID }: Selection & { cellSize: number; color: string; opacity: number; testID?: string }): JSX.Element => <Line testID={testID} x1={(start.col + 0.5) * cellSize} y1={(start.row + 0.5) * cellSize} x2={(end.col + 0.5) * cellSize} y2={(end.row + 0.5) * cellSize} stroke={color} strokeOpacity={opacity} strokeWidth={cellSize * BAND_WIDTH} strokeLinecap='round' />

type SelectionPanOptions = Pick<WordSearchGridProps, 'cellSize' | 'disabled'> & { size: number; onChange: (selection: Selection | null) => void }
type SelectionHandler = WordSearchGridProps['onSelect']

// The drag that picks a straight line of letters. It reports a change only when the finger reaches
// another cell, and a selection only when it was really dragged and let go. Its state lives in an object
// because the worklets Babel plugin copies the variables a gesture callback closes over, even with
// runOnJS: a plain `let` would stay null in every callback but the one that set it. The handler is set
// separately (see WordSearchGrid) so a new one doesn't need a new gesture.
const createSelectionPan = ({ cellSize, size, disabled, onChange }: SelectionPanOptions) => {
  const drag: { selection: Selection | null; onSelect: SelectionHandler | null } = { selection: null, onSelect: null }
  const show = (next: Selection | null) => {
    drag.selection = next
    onChange(next)
  }
  const setOnSelect = (handler: SelectionHandler) => {
    drag.onSelect = handler
  }
  const gesture = Gesture.Pan()
    .runOnJS(true)
    .enabled(!disabled)
    .maxPointers(1)
    .minDistance(0)
    .shouldCancelWhenOutside(false)
    .onBegin(({ x, y }) => {
      const start = wordSearchCellAt(x, y, cellSize, size)
      show({ start, end: start })
    })
    .onUpdate(({ x, y }) => {
      const current = drag.selection
      if (!current) return
      const end = snapWordSearchSelection(current.start, x, y, cellSize, size)
      if (!sameCell(end, current.end)) show({ start: current.start, end })
    })
    .onFinalize((_event, success) => {
      const finished = drag.selection
      show(null)
      if (success && finished && !sameCell(finished.start, finished.end)) drag.onSelect?.(finished.start, finished.end)
    })
  return { gesture, setOnSelect }
}

// The grid. Only the band under the finger changes during a drag.
export const WordSearchGrid = memo(({ board, cellSize, found, disabled, onSelect }: WordSearchGridProps): JSX.Element => {
  const theme = useTheme()
  const { size, grid } = board
  const side = cellSize * size
  const foundColors = [theme.colors.primary, theme.colors.secondary, theme.colors.tertiary]
  const [selection, setSelection] = useState<Selection | null>(null)
  const { gesture, setOnSelect } = useMemo(() => createSelectionPan({ cellSize, size, disabled, onChange: setSelection }), [cellSize, size, disabled])
  // The parent's handler changes with every word found, and a new gesture has to be attached again: a
  // quick next drag could start in that gap and be lost. So the gesture stays, and is told the latest.
  useLayoutEffect(() => setOnSelect(onSelect), [setOnSelect, onSelect])

  return (
    <GestureDetector gesture={gesture}>
      <View testID='word-search-grid' accessibilityLabel='Letter grid. Drag across letters to select a word.' style={{ width: side, height: side }}>
        <Svg width={side} height={side} style={StyleSheet.absoluteFill} pointerEvents='none'>
          {found.map((word, i) => (
            <Band key={word.id} testID={`word-search-found-${word.id}`} start={word.start} end={word.end} cellSize={cellSize} color={foundColors[i % foundColors.length]} opacity={FOUND_OPACITY} />
          ))}
          {selection ? <Band testID='word-search-selection' start={selection.start} end={selection.end} cellSize={cellSize} color={theme.colors.primary} opacity={SELECTION_OPACITY} /> : null}
        </Svg>
        <GridLetters grid={grid} cellSize={cellSize} />
      </View>
    </GestureDetector>
  )
})
WordSearchGrid.displayName = 'WordSearchGrid'

const SAMPLE_GRID = ['SEARCHKTL', 'MWPDFQOUB', 'TOGHIVRNE', 'KRAJNZDXM', 'LDUYDSWCA', 'PQEBETGHR', 'FNZORMIKY', 'CVHASLUPT', 'GRIDQJNEW'].map((row) => [...row])
const SAMPLE_WORDS: FoundWord[] = [
  { id: 'search', start: { row: 0, col: 0 }, end: { row: 0, col: 5 } },
  { id: 'word', start: { row: 1, col: 1 }, end: { row: 4, col: 1 } },
  { id: 'finder', start: { row: 1, col: 4 }, end: { row: 6, col: 4 } },
  { id: 'grid', start: { row: 8, col: 0 }, end: { row: 8, col: 3 } }
]

// A sample grid with words already found, for Home's card and the setup page: its first `rows` rows.
export const WordSearchArt = memo(({ rows = SAMPLE_GRID.length, cellSize }: { rows?: number; cellSize: number }): JSX.Element => {
  const theme = useTheme()
  const grid = useMemo(() => SAMPLE_GRID.slice(0, rows), [rows])
  const colors = [theme.colors.primary, theme.colors.secondary, theme.colors.tertiary]
  const width = cellSize * SAMPLE_GRID[0].length
  const height = cellSize * rows
  return (
    <View testID='word-search-art' accessibilityElementsHidden importantForAccessibility='no-hide-descendants' style={{ width, height }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents='none'>
        {SAMPLE_WORDS.filter((word) => word.end.row < rows).map((word, i) => (
          <Band key={word.id} start={word.start} end={word.end} cellSize={cellSize} color={colors[i % colors.length]} opacity={FOUND_OPACITY} />
        ))}
      </Svg>
      <GridLetters grid={grid} cellSize={cellSize} />
    </View>
  )
})
WordSearchArt.displayName = 'WordSearchArt'
