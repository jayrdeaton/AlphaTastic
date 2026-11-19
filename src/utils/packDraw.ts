import type { Puzzle } from '@/types/puzzle'
import { getPuzzleManifest, getPuzzlesForCategory, type PuzzleManifestItem } from '@/utils/puzzleCatalog'
import { normalizePhrase } from '@/utils/puzzlePicker'

import { type Rng, shuffled } from './random'

// One puzzle from one pack, so it has a theme. Every selected pack with enough answers is equally
// likely, however many puzzles it has, the same as a Hangman draw (see puzzlePicker.ts). `build` says
// null when a pack can't make one. Null when no selected pack can.
export const drawFromPacks = <T>(packKeys: readonly string[], minimumAnswers: number, build: (pack: PuzzleManifestItem, puzzles: Puzzle[]) => T | null, rng: Rng): T | null => {
  const selected = new Set(packKeys)
  const packs = getPuzzleManifest().filter((pack) => selected.has(pack.key) && pack.count >= minimumAnswers)
  for (const pack of shuffled(packs, rng)) {
    const built = build(pack, getPuzzlesForCategory(pack.key))
    if (built) return built
  }
  return null
}

// An answer's words as the board plays them: capitals only, one entry per word.
export const answerWords = (answer: string): string[] => normalizePhrase(answer).split(' ').filter(Boolean)
