import { useAutoPaperTheme } from '@rific/auto-paper'
import { Button, Pressable } from '@rific/feedback-press'
import { useIsFocused } from 'expo-router'
import { JSX, memo, useCallback, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { CRYPTOGRAM_GAME_ID } from '@/constants/games'
import { useGameHaptics } from '@/hooks/useGameHaptics'
import { usePackSelection } from '@/hooks/usePackSelection'
import { usePhysicalKeys } from '@/hooks/usePhysicalKeys'
import { usePuzzleOptions } from '@/hooks/usePuzzleOptions'
import { useSoundEffects } from '@/hooks/useSoundEffects'
import { assignGuess, type CryptogramBoard, type CryptogramGuesses, drawCryptogram, eraseGuess, isCryptogramFull, isCryptogramSolved, nextOpenCipher, revealCipher, startingGuesses } from '@/utils/cryptogram'

import { PuzzleKeyboard } from './PuzzleKeyboard'
import { formatElapsed, PuzzleBoardFrame, PuzzleSolvedCelebration, PuzzleUnavailable, usePuzzleSettingsOpen } from './PuzzleScreenParts'
import { SketchGlyph } from './SketchGlyph'

const COLUMN_MAX_WIDTH = 480
const GUTTER = 12
const CELL_GAP = 2
const MAX_CELL = 34
const MIN_CELL = 20
const MIN_LETTERS_ACROSS = 10

type CellState = 'plain' | 'selected' | 'fixed' | 'solved'
type CellProps = { cipher: string; guess: string | undefined; state: CellState; size: number; disabled: boolean; onPress: (cipher: string) => void }

const CipherCell = memo(({ cipher, guess, state, size, disabled, onPress }: CellProps): JSX.Element => {
  const { colors } = useAutoPaperTheme()
  const background = { plain: 'transparent', selected: colors.primaryContainer, fixed: 'transparent', solved: colors.successContainer }[state]
  const ink = state === 'fixed' ? colors.onSurfaceVariant : colors.onSurface
  return (
    <Pressable onPress={() => onPress(cipher)} disabled={disabled} accessibilityRole='button' accessibilityLabel={guess ? `Code letter ${cipher}, written as ${guess}` : `Code letter ${cipher}, empty`} accessibilityState={{ selected: state === 'selected' }} style={[styles.cell, { width: size, backgroundColor: background }]}>
      <View style={[styles.guess, { width: size, height: size, borderBottomColor: colors.outline }]}>{guess ? <SketchGlyph letter={guess} size={size} color={ink} /> : null}</View>
      <Text variant='labelSmall' style={[styles.cipher, { color: colors.onSurfaceVariant }]}>
        {cipher}
      </Text>
    </Pressable>
  )
})
CipherCell.displayName = 'CipherCell'

type BoardProps = { board: CryptogramBoard; frozen: boolean; onSolved: () => void; onHint: () => void }

// The coded answer and the keyboard. Keyed on the puzzle, so each starts clean.
const CryptogramBoardView = ({ board, frozen, onSolved, onHint }: BoardProps): JSX.Element => {
  const { colors } = useAutoPaperTheme()
  const window = useWindowDimensions()
  const focused = useIsFocused()
  const settingsOpen = usePuzzleSettingsOpen()
  const { wrongGuess, correctGuess } = useGameHaptics()
  const { playWrong, playCorrect } = useSoundEffects()
  const [guesses, setGuesses] = useState<CryptogramGuesses>(() => startingGuesses(board))
  const [locked, setLocked] = useState<string[]>(board.given)
  const [selected, setSelected] = useState<string | null>(() => nextOpenCipher(board, startingGuesses(board), null))
  const solved = isCryptogramSolved(board, guesses)
  const wrong = isCryptogramFull(board, guesses) && !solved
  const disabled = frozen || solved

  const commit = useCallback(
    (next: CryptogramGuesses, from: string | null) => {
      setGuesses(next)
      setSelected(nextOpenCipher(board, next, from) ?? from)
      if (!isCryptogramFull(board, next)) return
      if (isCryptogramSolved(board, next)) {
        onSolved()
        return
      }
      wrongGuess()
      playWrong()
    },
    [board, onSolved, wrongGuess, playWrong]
  )

  const handleLetter = useCallback(
    (letter: string) => {
      const cipher = selected ?? nextOpenCipher(board, guesses, null)
      if (!cipher) return
      const next = assignGuess(board, guesses, locked, cipher, letter)
      if (next !== guesses) commit(next, cipher)
    },
    [board, guesses, locked, selected, commit]
  )
  const handleErase = useCallback(() => {
    if (selected) setGuesses(eraseGuess(guesses, locked, selected))
  }, [guesses, locked, selected])
  const handleCell = useCallback(
    (cipher: string) => {
      if (!locked.includes(cipher)) setSelected(cipher)
    },
    [locked]
  )
  usePhysicalKeys(focused && !settingsOpen && !disabled, handleLetter, handleErase)

  const handleHint = () => {
    const reveal = revealCipher(board, guesses, locked, selected)
    if (!reveal) return
    onHint()
    correctGuess()
    playCorrect()
    setLocked(reveal.locked)
    commit(reveal.guesses, reveal.cipher)
  }

  const used = useMemo(() => new Set(Object.values(guesses)), [guesses])
  const fixed = useMemo(() => new Set(locked.map((cipher) => board.plainByCipher[cipher])), [board, locked])
  const available = Math.min(window.width, COLUMN_MAX_WIDTH) - GUTTER * 2
  const across = Math.max(MIN_LETTERS_ACROSS, ...board.words.map((word) => word.length))
  const size = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor((available - CELL_GAP * (across - 1)) / across)))
  const stateOf = (cipher: string): CellState => {
    if (solved) return 'solved'
    if (locked.includes(cipher)) return 'fixed'
    return cipher === selected ? 'selected' : 'plain'
  }

  return (
    <>
      <ScrollView style={styles.phraseScroll} contentContainerStyle={styles.phrase} showsVerticalScrollIndicator={false}>
        <View testID='cryptogram-phrase' style={styles.words}>
          {board.cipherWords.map((word, wordIndex) => (
            <View key={`${word}:${wordIndex}`} style={styles.word}>
              {[...word].map((cipher, letterIndex) => (
                <CipherCell key={letterIndex} cipher={cipher} guess={guesses[cipher]} state={stateOf(cipher)} size={size} disabled={disabled || locked.includes(cipher)} onPress={handleCell} />
              ))}
            </View>
          ))}
        </View>
        <Text testID='cryptogram-status' variant='bodyMedium' style={[styles.status, styles.centerText, { color: colors.danger }]}>
          {wrong ? 'Not quite. Some letters are wrong.' : ' '}
        </Text>
      </ScrollView>
      <View style={styles.actions}>
        <Button mode='outlined' icon='format-letter-case' onPress={handleHint} disabled={disabled}>
          Reveal Letter
        </Button>
      </View>
      <PuzzleKeyboard used={used} fixed={fixed} disabled={disabled} onLetter={handleLetter} onErase={handleErase} />
    </>
  )
}

type Game = { board: CryptogramBoard | null; startedAt: number }

// A prototype: one answer from the active player's packs in a letter-for-letter code. Their settings say
// how long it can run and how many letters start solved (see cryptogram.ts). Nothing is saved yet,
// and it adds to no stats.
export const CryptogramScreen = (): JSX.Element => {
  const insets = useSafeAreaInsets()
  const { selectedPackKeys } = usePackSelection()
  const { options } = usePuzzleOptions(CRYPTOGRAM_GAME_ID)
  const { win } = useGameHaptics()
  const { playWin } = useSoundEffects()
  const draw = useCallback((): Game => ({ board: drawCryptogram(selectedPackKeys, options), startedAt: Date.now() }), [selectedPackKeys, options])
  const [game, setGame] = useState(draw)
  const [hints, setHints] = useState(0)
  // Hangman's Hint pill: the pack, then the clue, once pressed.
  const [clueShown, setClueShown] = useState(false)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const { board, startedAt } = game

  const newPuzzle = useCallback(() => {
    setGame(draw())
    setHints(0)
    setClueShown(false)
    setElapsedMs(null)
  }, [draw])
  const handleSolved = useCallback(() => {
    win()
    playWin()
    setElapsedMs(Date.now() - startedAt)
  }, [startedAt, win, playWin])
  const handleHint = useCallback(() => setHints((count) => count + 1), [])
  // Opening the clue is a hint too, as Hangman's is.
  const showClue = useCallback(() => {
    setClueShown(true)
    setHints((count) => count + 1)
  }, [])

  if (!board) return <PuzzleUnavailable message='None of your selected packs has enough longer answers for a code.' />

  const help = hints === 0 ? '' : hints === 1 ? ' with 1 hint' : ` with ${hints} hints`
  return (
    <PuzzleBoardFrame difficultyTier={board.difficultyTier} packLabel={board.packLabel} hint={board.hint} hintRevealed={clueShown} onRevealHint={showClue}>
      <View style={[styles.body, { paddingBottom: insets.bottom + 8 }]}>
        <CryptogramBoardView key={startedAt} board={board} frozen={elapsedMs !== null} onSolved={handleSolved} onHint={handleHint} />
      </View>
      {elapsedMs !== null ? <PuzzleSolvedCelebration message={`${board.answer}, cracked${help} in ${formatElapsed(elapsedMs)}.`} onNext={newPuzzle} /> : null}
    </PuzzleBoardFrame>
  )
}

const styles = StyleSheet.create({
  actions: { alignItems: 'center', paddingVertical: 8 },
  body: { flex: 1, paddingHorizontal: GUTTER },
  cell: { alignItems: 'center', borderRadius: 4, paddingBottom: 2 },
  centerText: { textAlign: 'center' },
  cipher: { lineHeight: 14 },
  guess: { alignItems: 'center', borderBottomWidth: 1.5, justifyContent: 'center' },
  phrase: { flexGrow: 1, gap: 16, justifyContent: 'center', paddingVertical: 8 },
  phraseScroll: { flex: 1 },
  status: { minHeight: 20 },
  word: { flexDirection: 'row', gap: CELL_GAP },
  words: { columnGap: 14, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', rowGap: 10 }
})
