import type { Puzzle } from '@/types/puzzle'
import { spellsBlockedWord } from '@/utils/blockedWords'
import type { PuzzleDifficultyTier, PuzzleManifestItem } from '@/utils/puzzleCatalog'
import type { JumbleOptions, PuzzleLength } from '@/utils/puzzleOptions'
import { buildHint } from '@/utils/puzzlePicker'

import { answerWords, drawFromPacks } from './packDraw'
import { type Rng, shuffled } from './random'

type JumbleLengthRules = { maxWords: number; minLetters: number; maxLetters: number; maxWordLetters: number }
export type JumbleRules = JumbleLengthRules & { answers: number }
export type JumbleTile = { id: number; letter: string }
export type JumblePuzzle = { id: string; answer: string; hint?: string; difficultyTier: PuzzleDifficultyTier; words: string[]; letters: string; tiles: JumbleTile[] }
export type JumbleRound = { packKey: string; packLabel: string; puzzles: JumblePuzzle[] }
// Which tile sits in each answer position, null while it's empty.
export type JumbleSlots = (number | null)[]

const MIN_DISTINCT_LETTERS = 3
const MIN_WORD_LETTERS = 2
const SCRAMBLE_ATTEMPTS = 40

const JUMBLE_LENGTHS: Record<PuzzleLength, JumbleLengthRules> = {
  short: { maxWords: 1, minLetters: 4, maxLetters: 7, maxWordLetters: 7 },
  medium: { maxWords: 2, minLetters: 5, maxLetters: 12, maxWordLetters: 9 },
  long: { maxWords: 3, minLetters: 7, maxLetters: 16, maxWordLetters: 10 }
}

export const jumbleRulesFor = (options: JumbleOptions): JumbleRules => ({ ...JUMBLE_LENGTHS[options.length], answers: Number(options.answers) })

export const describeJumble = (options: JumbleOptions): string => {
  const { maxWords, maxLetters } = JUMBLE_LENGTHS[options.length]
  return `${options.answers} answers, ${maxWords === 1 ? `one word of up to ${maxLetters} letters` : `up to ${maxWords} words and ${maxLetters} letters`}`
}

const fitsRules = (words: string[], letters: string, rules: JumbleRules): boolean => words.length >= 1 && words.length <= rules.maxWords && letters.length >= rules.minLetters && letters.length <= rules.maxLetters && words.every((word) => word.length >= MIN_WORD_LETTERS && word.length <= rules.maxWordLetters) && new Set(letters).size >= MIN_DISTINCT_LETTERS

// In a new order: never the answer, with most letters moved, and spelling nothing that shouldn't be on
// screen. A rare answer with no such order settles for the best try.
export const scrambleTiles = (letters: string, rng: Rng): JumbleTile[] => {
  const tiles = [...letters].map((letter, id) => ({ id, letter }))
  let best = tiles
  let bestStaying = Infinity
  for (let attempt = 0; attempt < SCRAMBLE_ATTEMPTS; attempt++) {
    const order = shuffled(tiles, rng)
    const text = order.map((tile) => tile.letter).join('')
    const staying = order.filter((tile, index) => tile.letter === letters[index]).length
    if (text === letters || spellsBlockedWord(text) || staying >= bestStaying) continue
    best = order
    bestStaying = staying
    if (staying <= letters.length / 3) break
  }
  return best
}

export const buildJumbleRound = (pack: Pick<PuzzleManifestItem, 'key' | 'label' | 'categories'>, puzzles: readonly Pick<Puzzle, 'id' | 'answer' | 'category' | 'metadata' | 'difficultyTier'>[], rules: JumbleRules, rng: Rng): JumbleRound | null => {
  const seen = new Set<string>()
  const chosen: JumblePuzzle[] = []
  for (const puzzle of shuffled(puzzles, rng)) {
    if (chosen.length === rules.answers) break
    const words = answerWords(puzzle.answer)
    const letters = words.join('')
    if (seen.has(letters) || !fitsRules(words, letters, rules)) continue
    seen.add(letters)
    chosen.push({ id: puzzle.id, answer: puzzle.answer, hint: buildHint(puzzle, pack), difficultyTier: puzzle.difficultyTier, words, letters, tiles: scrambleTiles(letters, rng) })
  }
  return chosen.length === rules.answers ? { packKey: pack.key, packLabel: pack.label, puzzles: chosen } : null
}

export const drawJumbleRound = (packKeys: readonly string[], options: JumbleOptions, rng: Rng = Math.random): JumbleRound | null => {
  const rules = jumbleRulesFor(options)
  return drawFromPacks(packKeys, rules.answers, (pack, puzzles) => buildJumbleRound(pack, puzzles, rules, rng), rng)
}

export const emptyJumbleSlots = (puzzle: Pick<JumblePuzzle, 'letters'>): JumbleSlots => Array<number | null>(puzzle.letters.length).fill(null)

const letterOf = (puzzle: Pick<JumblePuzzle, 'tiles'>, tileId: number | null): string | null => puzzle.tiles.find((tile) => tile.id === tileId)?.letter ?? null

// Into the first empty position.
export const placeJumbleTile = (slots: JumbleSlots, tileId: number): JumbleSlots => {
  const index = slots.indexOf(null)
  if (index < 0 || slots.includes(tileId)) return slots
  return slots.map((slot, i) => (i === index ? tileId : slot))
}

export const clearJumbleSlot = (slots: JumbleSlots, index: number): JumbleSlots => slots.map((slot, i) => (i === index ? null : slot))

// Everything back in the pool but the letters hints have fixed.
export const clearJumbleSlots = (slots: JumbleSlots, locked: readonly number[]): JumbleSlots => slots.map((slot, i) => (locked.includes(i) ? slot : null))

export const isJumbleFull = (slots: JumbleSlots): boolean => !slots.includes(null)

// Spelled by its letters, so two of the same letter can sit either way round.
export const isJumbleSolved = (puzzle: Pick<JumblePuzzle, 'letters' | 'tiles'>, slots: JumbleSlots): boolean => slots.map((slot) => letterOf(puzzle, slot)).join('') === puzzle.letters && isJumbleFull(slots)

// A hint: the first position not holding its right letter gets one, taken from the pool or from a
// position it's wrong in, never from one it's right in. Null with nothing left to fix.
export const revealJumbleLetter = (puzzle: Pick<JumblePuzzle, 'letters' | 'tiles'>, slots: JumbleSlots): { slots: JumbleSlots; index: number } | null => {
  const isRight = (index: number) => letterOf(puzzle, slots[index]) === puzzle.letters[index]
  const index = slots.findIndex((_slot, i) => !isRight(i))
  if (index < 0) return null
  const wanted = puzzle.letters[index]
  const spare = puzzle.tiles.find((tile) => tile.letter === wanted && !slots.includes(tile.id)) ?? puzzle.tiles.find((tile) => tile.letter === wanted && !isRight(slots.indexOf(tile.id)))
  if (!spare) return null
  return { index, slots: slots.map((slot, i) => (i === index ? spare.id : slot === spare.id ? null : slot)) }
}
