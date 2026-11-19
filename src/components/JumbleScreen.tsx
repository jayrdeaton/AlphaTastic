import { useAutoPaperTheme } from '@rific/auto-paper'
import { Button, IconButton, Pressable } from '@rific/feedback-press'
import { WELL_SHADOW } from '@tastic/hud/chrome'
import { useIsFocused } from 'expo-router'
import { JSX, memo, useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { JUMBLE_GAME_ID } from '@/constants/games'
import { useGameHaptics } from '@/hooks/useGameHaptics'
import { usePackSelection } from '@/hooks/usePackSelection'
import { usePhysicalKeys } from '@/hooks/usePhysicalKeys'
import { usePuzzleOptions } from '@/hooks/usePuzzleOptions'
import { useSoundEffects } from '@/hooks/useSoundEffects'
import { clearJumbleSlot, clearJumbleSlots, drawJumbleRound, emptyJumbleSlots, isJumbleFull, isJumbleSolved, type JumblePuzzle, type JumbleRound, type JumbleSlots, placeJumbleTile, revealJumbleLetter } from '@/utils/jumble'
import { safeBack } from '@/utils/navigation'
import { gameShell } from '@/utils/webLayout'

import { formatElapsed, PuzzleSolvedCelebration, PuzzleUnavailable } from './PuzzleScreenParts'
import { ScreenHeader } from './ScreenHeader'
import { SketchGlyph } from './SketchGlyph'

const COLUMN_MAX_WIDTH = 480
const GUTTER = 16
const TILE_GAP = 6
const MAX_TILE = 46
const MIN_TILE = 26
const MIN_TILES_ACROSS = 7
// Long enough to see the word finished before the next one comes up.
const NEXT_WORD_DELAY_MS = 800

type TileProps = { id: number; letter: string; size: number; disabled: boolean; onPress: (id: number) => void }

const PoolTile = memo(({ id, letter, size, disabled, onPress }: TileProps): JSX.Element => {
  const { colors } = useAutoPaperTheme()
  return (
    <Pressable testID={`jumble-tile-${id}`} onPress={() => onPress(id)} disabled={disabled} accessibilityRole='button' accessibilityLabel={`Letter ${letter}`} style={[styles.tile, { width: size, height: size, backgroundColor: colors.surface }]}>
      <SketchGlyph letter={letter} size={size} color={colors.onSurface} />
    </Pressable>
  )
})
PoolTile.displayName = 'PoolTile'

type SlotState = 'open' | 'filled' | 'fixed' | 'solved' | 'wrong'
type SlotProps = { index: number; letter: string | null; state: SlotState; size: number; disabled: boolean; onPress: (index: number) => void }

const AnswerSlot = memo(({ index, letter, state, size, disabled, onPress }: SlotProps): JSX.Element => {
  const { colors } = useAutoPaperTheme()
  const look = {
    open: { backgroundColor: 'transparent', borderColor: colors.outline, ink: colors.onSurface },
    filled: { backgroundColor: colors.surface, borderColor: colors.primary, ink: colors.onSurface },
    fixed: { backgroundColor: colors.surfaceVariant, borderColor: colors.outline, ink: colors.onSurfaceVariant },
    solved: { backgroundColor: colors.success, borderColor: colors.success, ink: colors.onSuccess },
    wrong: { backgroundColor: colors.dangerContainer, borderColor: colors.danger, ink: colors.onDangerContainer }
  }[state]
  return (
    <Pressable testID={`jumble-slot-${index}`} onPress={() => onPress(index)} disabled={disabled || letter === null} accessibilityRole='button' accessibilityLabel={letter ? `Answer letter ${index + 1}, ${letter}` : `Answer letter ${index + 1}, empty`} style={[styles.slot, { width: size, height: size, backgroundColor: look.backgroundColor, borderColor: look.borderColor }]}>
      {letter ? <SketchGlyph letter={letter} size={size - 4} color={look.ink} /> : null}
    </Pressable>
  )
})
AnswerSlot.displayName = 'AnswerSlot'

type JumbleBoardProps = { puzzle: JumblePuzzle; frozen: boolean; onSolved: () => void; onHint: () => void }

// One scrambled answer. Keyed on the word, so each starts clean.
const JumbleBoard = ({ puzzle, frozen, onSolved, onHint }: JumbleBoardProps): JSX.Element => {
  const { colors } = useAutoPaperTheme()
  const window = useWindowDimensions()
  const focused = useIsFocused()
  const { wrongGuess } = useGameHaptics()
  const { playWrong } = useSoundEffects()
  const [slots, setSlots] = useState<JumbleSlots>(() => emptyJumbleSlots(puzzle))
  const [locked, setLocked] = useState<number[]>([])
  const solved = isJumbleSolved(puzzle, slots)
  const wrong = isJumbleFull(slots) && !solved
  const disabled = frozen || solved

  const commit = useCallback(
    (next: JumbleSlots) => {
      setSlots(next)
      if (!isJumbleFull(next)) return
      if (isJumbleSolved(puzzle, next)) {
        onSolved()
        return
      }
      wrongGuess()
      playWrong()
    },
    [puzzle, onSolved, wrongGuess, playWrong]
  )

  const handleTile = useCallback((id: number) => commit(placeJumbleTile(slots, id)), [commit, slots])
  const handleSlot = useCallback(
    (index: number) => {
      if (!locked.includes(index)) setSlots(clearJumbleSlot(slots, index))
    },
    [locked, slots]
  )
  const handleLetter = useCallback(
    (letter: string) => {
      const tile = puzzle.tiles.find((candidate) => candidate.letter === letter && !slots.includes(candidate.id))
      if (tile) commit(placeJumbleTile(slots, tile.id))
    },
    [puzzle, slots, commit]
  )
  const handleBackspace = useCallback(() => {
    const index = slots.findLastIndex((slot, i) => slot !== null && !locked.includes(i))
    if (index >= 0) setSlots(clearJumbleSlot(slots, index))
  }, [slots, locked])
  usePhysicalKeys(focused && !disabled, handleLetter, handleBackspace)

  const handleHint = () => {
    const reveal = revealJumbleLetter(puzzle, slots)
    if (!reveal) return
    onHint()
    setLocked((current) => [...current, reveal.index])
    commit(reveal.slots)
  }

  const letterAt = (index: number) => puzzle.tiles.find((tile) => tile.id === slots[index])?.letter ?? null
  const slotState = (index: number): SlotState => {
    if (solved) return 'solved'
    if (slots[index] === null) return 'open'
    if (locked.includes(index)) return 'fixed'
    return wrong ? 'wrong' : 'filled'
  }

  const available = Math.min(window.width, COLUMN_MAX_WIDTH) - GUTTER * 2
  const across = Math.max(MIN_TILES_ACROSS, ...puzzle.words.map((word) => word.length))
  const size = Math.max(MIN_TILE, Math.min(MAX_TILE, Math.floor((available - TILE_GAP * (across - 1)) / across)))
  const wordStarts = puzzle.words.map((_word, i) => puzzle.words.slice(0, i).join('').length)

  return (
    <View style={styles.board}>
      {puzzle.hint ? (
        <Text testID='jumble-clue' variant='bodyMedium' style={[styles.centerText, { color: colors.onSurfaceVariant }]}>
          {puzzle.hint}
        </Text>
      ) : null}
      <View style={styles.answer}>
        {puzzle.words.map((word, wordIndex) => (
          <View key={wordStarts[wordIndex]} style={styles.tileRow}>
            {[...word].map((_letter, offset) => {
              const index = wordStarts[wordIndex] + offset
              return <AnswerSlot key={index} index={index} letter={letterAt(index)} state={slotState(index)} size={size} disabled={disabled || locked.includes(index)} onPress={handleSlot} />
            })}
          </View>
        ))}
      </View>
      <Text testID='jumble-status' variant='bodyMedium' style={[styles.status, styles.centerText, { color: colors.danger }]}>
        {wrong ? 'Not quite. Tap a letter to take it back.' : ' '}
      </Text>
      <View style={styles.pool}>{puzzle.tiles.map((tile) => (slots.includes(tile.id) ? <View key={tile.id} style={{ width: size, height: size }} /> : <PoolTile key={tile.id} id={tile.id} letter={tile.letter} size={size} disabled={disabled} onPress={handleTile} />))}</View>
      <View style={styles.actions}>
        <Button mode='outlined' icon='lightbulb-outline' onPress={handleHint} disabled={disabled}>
          Hint
        </Button>
        <Button mode='outlined' icon='backspace-outline' onPress={() => setSlots(clearJumbleSlots(slots, locked))} disabled={disabled || slots.every((slot, i) => slot === null || locked.includes(i))}>
          Clear
        </Button>
      </View>
    </View>
  )
}

type Game = { round: JumbleRound | null; startedAt: number }

// A prototype: a run of scrambled answers from one of the active player's packs. Their settings say how
// many and how long (see jumble.ts). Nothing is saved yet, and it adds to no stats.
export const JumbleScreen = (): JSX.Element => {
  const { colors } = useAutoPaperTheme()
  const insets = useSafeAreaInsets()
  const { selectedPackKeys } = usePackSelection()
  const { options } = usePuzzleOptions(JUMBLE_GAME_ID)
  const { correctGuess, win } = useGameHaptics()
  const { playCorrect, playWin } = useSoundEffects()
  const draw = useCallback((): Game => ({ round: drawJumbleRound(selectedPackKeys, options), startedAt: Date.now() }), [selectedPackKeys, options])
  const [game, setGame] = useState(draw)
  const [index, setIndex] = useState(0)
  const [hints, setHints] = useState(0)
  const [advancing, setAdvancing] = useState(false)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const { round, startedAt } = game
  const total = round?.puzzles.length ?? 0

  useEffect(() => {
    if (!advancing) return
    const timeout = setTimeout(() => {
      setIndex((current) => current + 1)
      setAdvancing(false)
    }, NEXT_WORD_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [advancing])

  const newRound = useCallback(() => {
    setGame(draw())
    setIndex(0)
    setHints(0)
    setAdvancing(false)
    setElapsedMs(null)
  }, [draw])

  const handleSolved = useCallback(() => {
    if (index < total - 1) {
      correctGuess()
      playCorrect()
      setAdvancing(true)
      return
    }
    win()
    playWin()
    setElapsedMs(Date.now() - startedAt)
  }, [index, total, startedAt, correctGuess, playCorrect, win, playWin])
  const handleHint = useCallback(() => setHints((count) => count + 1), [])
  const message = useMemo(() => {
    const help = hints === 0 ? '' : hints === 1 ? ' with 1 hint' : ` with ${hints} hints`
    return `You unscrambled all ${total}${help} in ${formatElapsed(elapsedMs ?? 0)}.`
  }, [hints, total, elapsedMs])

  if (!round) return <PuzzleUnavailable title='Jumble' message='None of your selected packs has enough answers of the right length.' />

  const puzzle = round.puzzles[index]
  return (
    <View style={[styles.screen, gameShell]}>
      <ScreenHeader icon='arrow-left' label='Back' onPress={safeBack} title={round.packLabel} trailing={<IconButton icon='refresh' iconColor={colors.onSurface} size={24} hitSlop={4} onPress={newRound} accessibilityLabel='New puzzle' />} />
      <View style={[styles.body, { paddingBottom: insets.bottom + GUTTER }]}>
        <Text testID='jumble-progress' variant='labelLarge' style={[styles.centerText, { color: colors.onSurfaceVariant }]}>
          Answer {index + 1} of {total}
        </Text>
        <JumbleBoard key={`${startedAt}:${puzzle.id}`} puzzle={puzzle} frozen={advancing || elapsedMs !== null} onSolved={handleSolved} onHint={handleHint} />
      </View>
      {elapsedMs !== null ? <PuzzleSolvedCelebration message={message} onNext={newRound} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  answer: { gap: TILE_GAP + 4 },
  board: { alignItems: 'center', alignSelf: 'stretch', gap: 20 },
  body: { flex: 1, gap: 12, justifyContent: 'center', paddingHorizontal: GUTTER },
  centerText: { textAlign: 'center' },
  pool: { flexDirection: 'row', flexWrap: 'wrap', gap: TILE_GAP, justifyContent: 'center' },
  screen: { flex: 1 },
  slot: { alignItems: 'center', borderRadius: 8, borderWidth: 2, justifyContent: 'center' },
  status: { minHeight: 20 },
  tile: { alignItems: 'center', borderRadius: 8, boxShadow: WELL_SHADOW, justifyContent: 'center' },
  tileRow: { flexDirection: 'row', gap: TILE_GAP, justifyContent: 'center' }
})
