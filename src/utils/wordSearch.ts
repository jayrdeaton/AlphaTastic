import type { Puzzle } from '@/types/puzzle'
import { BLOCKED_WORDS } from '@/utils/blockedWords'
import type { WordSearchOptions } from '@/utils/puzzleOptions'

import { normalizePhrase } from './normalizePhrase'
import { drawFromPacks } from './packDraw'
import { pickFrom, type Rng, shuffled } from './random'

export type GridCell = { row: number; col: number }
export type WordSearchDirection = readonly [row: number, col: number]
export type WordSearchRules = { size: number; wordCount: number; directions: readonly WordSearchDirection[] }
export type WordSearchEntry = { id: string; answer: string; letters: string }
export type PlacedWord = WordSearchEntry & { start: GridCell; end: GridCell }
export type WordSearchGrid = { size: number; grid: string[][]; words: PlacedWord[] }
export type WordSearchBoard = WordSearchGrid & { packKey: string; packLabel: string }

const ACROSS: WordSearchDirection = [0, 1]
const DOWN: WordSearchDirection = [1, 0]
const DOWN_RIGHT: WordSearchDirection = [1, 1]
const UP_RIGHT: WordSearchDirection = [-1, 1]
const FORWARD_DIRECTIONS = [ACROSS, DOWN, DOWN_RIGHT, UP_RIGHT]
const ALL_DIRECTIONS = FORWARD_DIRECTIONS.flatMap(([row, col]): WordSearchDirection[] => [
  [row, col],
  [0 - row, 0 - col]
])

const GRIDS: Record<WordSearchOptions['grid'], Pick<WordSearchRules, 'size' | 'wordCount'>> = {
  small: { size: 10, wordCount: 8 },
  medium: { size: 12, wordCount: 10 },
  large: { size: 14, wordCount: 14 }
}

const DIRECTIONS: Record<WordSearchOptions['directions'], { directions: readonly WordSearchDirection[]; summary: string }> = {
  straight: { directions: [ACROSS, DOWN], summary: 'across and down' },
  diagonal: { directions: FORWARD_DIRECTIONS, summary: 'including diagonals' },
  backward: { directions: ALL_DIRECTIONS, summary: 'in every direction, backward too' }
}

export const wordSearchRulesFor = (options: WordSearchOptions): WordSearchRules => ({ ...GRIDS[options.grid], directions: DIRECTIONS[options.directions].directions })

export const describeWordSearch = (options: WordSearchOptions): string => {
  const { size, wordCount } = GRIDS[options.grid]
  return `${wordCount} words on a ${size} by ${size} grid, ${DIRECTIONS[options.directions].summary}`
}

// Three-letter answers turn up by chance in the filler, so they'd rarely be the one the player was meant to find.
const MIN_WORD_LETTERS = 4
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
// How often a filler letter comes from the hidden words rather than the whole alphabet. Filler that
// shares the words' letters makes false starts, where uniform letters let the real words stand out.
const WORD_LETTER_FILLER_CHANCE = 0.5
// How often a word that could cross another is made to, so the words tangle a little.
const CROSSING_CHANCE = 0.4
const MAX_FILLER_PASSES = 20

const reversed = (text: string): string => [...text].reverse().join('')

// A word inside another (IRON in IRON MAN), either way round, would make finding one also find the
// other's letters, so a grid never holds both.
const contains = (a: string, b: string): boolean => a.includes(b) || b.includes(a) || a.includes(reversed(b)) || b.includes(reversed(a))

// A pack's answers that can be hidden in a grid of `size`, spaces dropped, each spelling once.
export const wordSearchEntries = (puzzles: Pick<Puzzle, 'id' | 'answer'>[], size: number): WordSearchEntry[] => {
  const byLetters = new Map<string, WordSearchEntry>()
  for (const { id, answer } of puzzles) {
    const letters = normalizePhrase(answer).replace(/ /g, '')
    if (letters.length >= MIN_WORD_LETTERS && letters.length <= size && !byLetters.has(letters)) byLetters.set(letters, { id, answer, letters })
  }
  return [...byLetters.values()]
}

type Draft = (string | null)[][]

// One direction at a time, each equally likely, because counting every placement together would favor
// straight lines: a long word has far fewer places to go on a diagonal.
const findPlacement = (draft: Draft, letters: string, directions: readonly WordSearchDirection[], rng: Rng) => {
  const size = draft.length
  const last = letters.length - 1
  for (const direction of shuffled(directions, rng)) {
    const [rowStep, colStep] = direction
    const fits: { row: number; col: number; crossings: number }[] = []
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const endRow = row + rowStep * last
        const endCol = col + colStep * last
        if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue
        let crossings = 0
        let open = true
        for (let i = 0; i <= last && open; i++) {
          const existing = draft[row + rowStep * i][col + colStep * i]
          if (existing === letters[i]) crossings++
          else if (existing !== null) open = false
        }
        if (open) fits.push({ row, col, crossings })
      }
    }
    if (fits.length === 0) continue
    const crossing = fits.filter((fit) => fit.crossings > 0)
    const pool = crossing.length > 0 && rng() < CROSSING_CHANCE ? crossing : fits
    return { ...pickFrom(pool, rng), direction }
  }
  return null
}

// Every straight line through the grid, as its cells: rows, columns and both diagonals.
export const wordSearchLines = (size: number): GridCell[][] => {
  const lines: GridCell[][] = []
  const walk = (row: number, col: number, rowStep: number, colStep: number) => {
    const line: GridCell[] = []
    for (let r = row, c = col; r >= 0 && r < size && c >= 0 && c < size; r += rowStep, c += colStep) line.push({ row: r, col: c })
    lines.push(line)
  }
  for (let i = 0; i < size; i++) {
    walk(i, 0, 0, 1)
    walk(0, i, 1, 0)
    walk(i, 0, 1, 1)
    walk(i, size - 1, 1, -1)
    if (i > 0) {
      walk(0, i, 1, 1)
      walk(0, size - 1 - i, 1, -1)
    }
  }
  return lines
}

const cleanFiller = (grid: string[][], isFiller: boolean[][], rng: Rng) => {
  const lines = wordSearchLines(grid.length)
  for (let pass = 0; pass < MAX_FILLER_PASSES; pass++) {
    let changed = false
    for (const line of lines) {
      const text = line.map(({ row, col }) => grid[row][col]).join('')
      for (const word of BLOCKED_WORDS) {
        for (const spelled of [word, reversed(word)]) {
          const index = text.indexOf(spelled)
          if (index < 0) continue
          const filler = line.slice(index, index + spelled.length).filter(({ row, col }) => isFiller[row][col])
          if (filler.length === 0) continue
          const { row, col } = pickFrom(filler, rng)
          grid[row][col] = pickFrom(
            [...ALPHABET].filter((letter) => letter !== grid[row][col]),
            rng
          )
          changed = true
        }
      }
      if (changed) break
    }
    if (!changed) return
  }
}

// Answers are tried in random order until the grid holds enough. One that won't fit is skipped, so a
// crowded grid just moves on to the next answer. Null when the entries run out first.
export const buildWordSearch = (entries: readonly WordSearchEntry[], rules: WordSearchRules, rng: Rng = Math.random): WordSearchGrid | null => {
  const { size, wordCount, directions } = rules
  const draft: Draft = Array.from({ length: size }, () => Array<string | null>(size).fill(null))
  const words: PlacedWord[] = []

  for (const entry of shuffled(entries, rng)) {
    if (words.length === wordCount) break
    const { letters } = entry
    if (letters.length > size || words.some((word) => contains(word.letters, letters))) continue
    const placement = findPlacement(draft, letters, directions, rng)
    if (!placement) continue
    const { row, col, direction } = placement
    const [rowStep, colStep] = direction
    ;[...letters].forEach((letter, i) => {
      draft[row + rowStep * i][col + colStep * i] = letter
    })
    const last = letters.length - 1
    words.push({ ...entry, start: { row, col }, end: { row: row + rowStep * last, col: col + colStep * last } })
  }
  if (words.length < wordCount) return null

  const wordLetters = words.flatMap((word) => [...word.letters])
  const isFiller = draft.map((row) => row.map((letter) => letter === null))
  const grid = draft.map((row) => row.map((letter) => letter ?? pickFrom(rng() < WORD_LETTER_FILLER_CHANCE ? wordLetters : [...ALPHABET], rng)))
  cleanFiller(grid, isFiller, rng)

  return { size, grid, words: words.sort((a, b) => a.answer.localeCompare(b.answer)) }
}

// One grid from one of the selected packs, so its words share a theme. Null when none can fill one.
export const drawWordSearch = (packKeys: readonly string[], options: WordSearchOptions, rng: Rng = Math.random): WordSearchBoard | null => {
  const rules = wordSearchRulesFor(options)
  return drawFromPacks(
    packKeys,
    rules.wordCount,
    (pack, puzzles) => {
      const built = buildWordSearch(wordSearchEntries(puzzles, rules.size), rules, rng)
      return built ? { ...built, packKey: pack.key, packLabel: pack.label } : null
    },
    rng
  )
}

export const wordSearchCellAt = (x: number, y: number, cellSize: number, size: number): GridCell => {
  const clamp = (value: number) => Math.min(size - 1, Math.max(0, Math.floor(value / cellSize)))
  return { row: clamp(y), col: clamp(x) }
}

// Where a drag from `start` to the point (x, y) ends: the nearest of the eight straight lines, as far
// along it as the finger has come, stopped at the grid's edge.
export const snapWordSearchSelection = (start: GridCell, x: number, y: number, cellSize: number, size: number): GridCell => {
  const dx = x / cellSize - (start.col + 0.5)
  const dy = y / cellSize - (start.row + 0.5)
  const eighth = Math.round(Math.atan2(dy, dx) / (Math.PI / 4))
  const colStep = Math.round(Math.cos((eighth * Math.PI) / 4))
  const rowStep = Math.round(Math.sin((eighth * Math.PI) / 4))
  const wanted = Math.round(colStep !== 0 && rowStep !== 0 ? (Math.abs(dx) + Math.abs(dy)) / 2 : Math.abs(colStep !== 0 ? dx : dy))
  const room = (position: number, step: number) => (step > 0 ? size - 1 - position : step < 0 ? position : Infinity)
  const steps = Math.min(wanted, room(start.row, rowStep), room(start.col, colStep))
  return { row: start.row + rowStep * steps, col: start.col + colStep * steps }
}

const selectionLetters = (grid: string[][], start: GridCell, end: GridCell): string => {
  const rowDelta = end.row - start.row
  const colDelta = end.col - start.col
  const steps = Math.max(Math.abs(rowDelta), Math.abs(colDelta))
  let letters = ''
  for (let i = 0; i <= steps; i++) letters += grid[start.row + (steps === 0 ? 0 : (rowDelta / steps) * i)][start.col + (steps === 0 ? 0 : (colDelta / steps) * i)]
  return letters
}

// The unfound word a selection spells, read from either end. It's matched by its letters, not where the
// word was placed, so a copy the filler happened to spell counts too.
export const findSelectedWord = (board: Pick<WordSearchGrid, 'grid' | 'words'>, foundIds: readonly string[], start: GridCell, end: GridCell): PlacedWord | null => {
  const letters = selectionLetters(board.grid, start, end)
  const backward = reversed(letters)
  return board.words.find((word) => !foundIds.includes(word.id) && (word.letters === letters || word.letters === backward)) ?? null
}
