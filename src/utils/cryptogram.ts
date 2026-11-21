import type { Puzzle } from '@/types/puzzle'
import { spellsBlockedWord } from '@/utils/blockedWords'
import type { PuzzleDifficultyTier, PuzzleManifestItem } from '@/utils/puzzleCatalog'
import type { CryptogramOptions, PuzzleLength } from '@/utils/puzzleOptions'
import { buildHint } from '@/utils/puzzlePicker'

import { answerWords, drawFromPacks } from './packDraw'
import { pickFrom, type Rng, shuffled } from './random'

export type CryptogramRules = { maxLetters: number; givenLetters: number }
export type CryptogramBoard = {
  id: string
  answer: string
  hint?: string
  difficultyTier: PuzzleDifficultyTier
  packKey: string
  packLabel: string
  // The answer, and the same words as they're shown, letter for letter.
  words: string[]
  cipherWords: string[]
  // The real letter behind each code letter, and the code letters in reading order.
  plainByCipher: Record<string, string>
  cipherLetters: string[]
  // The code letters the puzzle starts with solved.
  given: string[]
}
// What the player has written for each code letter.
export type CryptogramGuesses = Record<string, string>

const ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
const MIN_WORDS = 2
const MIN_LETTERS = 14
const MIN_DISTINCT_LETTERS = 8
const MAX_WORD_LETTERS = 12
const CIPHER_ATTEMPTS = 40
const MINIMUM_ANSWERS = 5

const MAX_LETTERS: Record<PuzzleLength, number> = { short: 28, medium: 36, long: 44 }

export const cryptogramRulesFor = (options: CryptogramOptions): CryptogramRules => ({ maxLetters: MAX_LETTERS[options.length], givenLetters: Number(options.headStart) })

export const describeCryptogram = (options: CryptogramOptions): string => {
  const { maxLetters, givenLetters } = cryptogramRulesFor(options)
  return `Answers up to ${maxLetters} letters, with ${givenLetters} ${givenLetters === 1 ? 'code letter' : 'code letters'} solved`
}

// A code where no letter stands for itself. Plain letter to code letter.
export const createCipher = (rng: Rng): Record<string, string> => {
  let order = shuffled(ALPHABET, rng)
  for (let attempt = 0; attempt < CIPHER_ATTEMPTS && order.some((letter, i) => letter === ALPHABET[i]); attempt++) order = shuffled(ALPHABET, rng)
  // Shifted by one as the last resort: still no letter standing for itself.
  if (order.some((letter, i) => letter === ALPHABET[i])) order = ALPHABET.map((_letter, i) => ALPHABET[(i + 1) % ALPHABET.length])
  return Object.fromEntries(ALPHABET.map((letter, i) => [letter, order[i]]))
}

const fitsRules = (words: string[], rules: CryptogramRules): boolean => {
  const letters = words.join('')
  return words.length >= MIN_WORDS && letters.length >= MIN_LETTERS && letters.length <= rules.maxLetters && words.every((word) => word.length <= MAX_WORD_LETTERS) && new Set(letters).size >= MIN_DISTINCT_LETTERS
}

const encode = (words: string[], cipher: Record<string, string>): string[] => words.map((word) => [...word].map((letter) => cipher[letter]).join(''))

export const buildCryptogram = (pack: Pick<PuzzleManifestItem, 'key' | 'label' | 'categories'>, puzzles: readonly Pick<Puzzle, 'id' | 'answer' | 'category' | 'metadata' | 'difficultyTier'>[], rules: CryptogramRules, rng: Rng): CryptogramBoard | null => {
  const candidates = shuffled(puzzles, rng).filter((puzzle) => fitsRules(answerWords(puzzle.answer), rules))
  if (candidates.length < MINIMUM_ANSWERS) return null
  const puzzle = pickFrom(candidates, rng)
  const words = answerWords(puzzle.answer)
  let cipher = createCipher(rng)
  for (let attempt = 0; attempt < CIPHER_ATTEMPTS && encode(words, cipher).some(spellsBlockedWord); attempt++) cipher = createCipher(rng)
  const cipherWords = encode(words, cipher)
  const cipherLetters = [...new Set(cipherWords.join(''))]
  const plainByCipher = Object.fromEntries(Object.entries(cipher).map(([plain, code]) => [code, plain]))
  return { id: puzzle.id, answer: puzzle.answer, hint: buildHint(puzzle, pack), difficultyTier: puzzle.difficultyTier, packKey: pack.key, packLabel: pack.label, words, cipherWords, plainByCipher, cipherLetters, given: shuffled(cipherLetters, rng).slice(0, rules.givenLetters) }
}

export const drawCryptogram = (packKeys: readonly string[], options: CryptogramOptions, rng: Rng = Math.random): CryptogramBoard | null => {
  const rules = cryptogramRulesFor(options)
  return drawFromPacks(packKeys, MINIMUM_ANSWERS, (pack, puzzles) => buildCryptogram(pack, puzzles, rules, rng), rng)
}

export const startingGuesses = (board: Pick<CryptogramBoard, 'given' | 'plainByCipher'>): CryptogramGuesses => Object.fromEntries(board.given.map((cipher) => [cipher, board.plainByCipher[cipher]]))

// A real letter stands for one code letter at a time, so writing it here takes it from anywhere else.
// Letters the puzzle gave or a hint fixed can't be changed or reused.
export const assignGuess = (board: Pick<CryptogramBoard, 'plainByCipher'>, guesses: CryptogramGuesses, locked: readonly string[], cipher: string, plain: string): CryptogramGuesses => {
  if (locked.includes(cipher) || locked.some((code) => board.plainByCipher[code] === plain)) return guesses
  const next = Object.fromEntries(Object.entries(guesses).filter(([, letter]) => letter !== plain))
  next[cipher] = plain
  return next
}

export const eraseGuess = (guesses: CryptogramGuesses, locked: readonly string[], cipher: string): CryptogramGuesses => {
  if (locked.includes(cipher) || !(cipher in guesses)) return guesses
  return Object.fromEntries(Object.entries(guesses).filter(([code]) => code !== cipher))
}

export const isCryptogramFull = (board: Pick<CryptogramBoard, 'cipherLetters'>, guesses: CryptogramGuesses): boolean => board.cipherLetters.every((cipher) => guesses[cipher])

export const isCryptogramSolved = (board: Pick<CryptogramBoard, 'cipherLetters' | 'plainByCipher'>, guesses: CryptogramGuesses): boolean => board.cipherLetters.every((cipher) => guesses[cipher] === board.plainByCipher[cipher])

// The next code letter with nothing written, in reading order after `after`, wrapping round.
export const nextOpenCipher = (board: Pick<CryptogramBoard, 'cipherLetters'>, guesses: CryptogramGuesses, after: string | null): string | null => {
  const { cipherLetters } = board
  const start = after ? cipherLetters.indexOf(after) + 1 : 0
  return [...cipherLetters.slice(start), ...cipherLetters.slice(0, start)].find((cipher) => !guesses[cipher]) ?? null
}

// A hint: the chosen code letter, or the first one that's wrong or empty, is solved and fixed.
export const revealCipher = (board: Pick<CryptogramBoard, 'cipherLetters' | 'plainByCipher'>, guesses: CryptogramGuesses, locked: readonly string[], chosen: string | null): { guesses: CryptogramGuesses; locked: string[]; cipher: string } | null => {
  const isOpen = (cipher: string) => guesses[cipher] !== board.plainByCipher[cipher]
  const cipher = chosen && !locked.includes(chosen) && isOpen(chosen) ? chosen : board.cipherLetters.find(isOpen)
  if (!cipher) return null
  const plain = board.plainByCipher[cipher]
  const next = Object.fromEntries(Object.entries(guesses).filter(([, letter]) => letter !== plain))
  next[cipher] = plain
  return { guesses: next, locked: [...locked, cipher], cipher }
}
