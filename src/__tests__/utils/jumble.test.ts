import { spellsBlockedWord } from '@/utils/blockedWords'
import { buildJumbleRound, clearJumbleSlot, clearJumbleSlots, describeJumble, drawJumbleRound, emptyJumbleSlots, isJumbleFull, isJumbleSolved, type JumblePuzzle, jumbleRulesFor, placeJumbleTile, revealJumbleLetter, scrambleTiles } from '@/utils/jumble'
import { getPuzzleManifest } from '@/utils/puzzleCatalog'

const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const PACK = { key: 'test', label: 'Test Pack', categories: ['Thing'] }
const entry = (answer: string, i: number) => ({ id: `p${i}`, answer, category: 'Thing' })
const ANSWERS = ['Lion', 'Tiger', 'Zebra', 'Monkey', 'Parrot', 'Rabbit', 'Red Panda', 'Polar Bear', 'Sea Otter', 'Blue Whale Shark', 'Ox', 'Aaaa']
const puzzles = ANSWERS.map(entry)

const OPTIONS = { answers: '5', length: 'medium' } as const
const RULES = { short: jumbleRulesFor({ ...OPTIONS, length: 'short' }), medium: jumbleRulesFor(OPTIONS), long: jumbleRulesFor({ ...OPTIONS, length: 'long' }) }

const puzzleOf = (letters: string): Pick<JumblePuzzle, 'letters' | 'tiles'> => ({ letters, tiles: [...letters].map((letter, id) => ({ id, letter })) })

describe('scrambleTiles', () => {
  it('keeps every letter, never leaves the answer, and spells nothing blocked', () => {
    for (let seed = 0; seed < 200; seed++) {
      const text = scrambleTiles('BASSHIT', seeded(seed))
        .map((tile) => tile.letter)
        .join('')
      expect([...text].sort()).toEqual([...'BASSHIT'].sort())
      expect(text).not.toBe('BASSHIT')
      expect(spellsBlockedWord(text)).toBe(false)
    }
  })
})

describe('buildJumbleRound', () => {
  it.each(Object.entries(RULES))('picks five different answers that fit %s', (_name, rules) => {
    for (let seed = 0; seed < 20; seed++) {
      const round = buildJumbleRound(PACK, puzzles, { ...rules, maxWords: 3, minLetters: 4, maxLetters: 16, maxWordLetters: 10 }, seeded(seed))!
      expect(round.puzzles).toHaveLength(5)
      expect(new Set(round.puzzles.map((puzzle) => puzzle.letters)).size).toBe(5)
      for (const puzzle of round.puzzles) expect(puzzle.words.join('')).toBe(puzzle.letters)
    }
  })

  it('holds short rounds to one short word', () => {
    const round = buildJumbleRound(PACK, puzzles, RULES.short, seeded(4))!
    for (const puzzle of round.puzzles) {
      expect(puzzle.words).toHaveLength(1)
      expect(puzzle.letters.length).toBeLessThanOrEqual(7)
    }
  })

  it('leaves out answers too short or with too few different letters', () => {
    const round = buildJumbleRound(PACK, puzzles, { answers: 5, maxWords: 3, minLetters: 2, maxLetters: 16, maxWordLetters: 10 }, seeded(2))!
    expect(round.puzzles.map((puzzle) => puzzle.letters)).not.toContain('AAAA')
    expect(round.puzzles.map((puzzle) => puzzle.letters)).not.toContain('OX')
  })

  it('gives up with too few answers', () => {
    expect(buildJumbleRound(PACK, puzzles.slice(0, 3), RULES.medium, seeded(1))).toBeNull()
  })
})

describe('drawJumbleRound', () => {
  it('draws as many answers as the settings ask for, and says what they are', () => {
    const pack = getPuzzleManifest().sort((a, b) => b.count - a.count)[0]
    expect(drawJumbleRound([pack.key], { answers: '10', length: 'medium' }, seeded(5))?.puzzles).toHaveLength(10)
    expect(describeJumble({ answers: '3', length: 'short' })).toBe('3 answers, one word of up to 7 letters')
    expect(describeJumble({ answers: '5', length: 'long' })).toBe('5 answers, up to 3 words and 16 letters')
  })

  it('draws from a selected pack', () => {
    const pack = getPuzzleManifest().sort((a, b) => b.count - a.count)[0]
    expect(drawJumbleRound([pack.key], OPTIONS, seeded(3))).toMatchObject({ packKey: pack.key, packLabel: pack.label })
  })

  it('has nothing to draw with no pack selected', () => {
    expect(drawJumbleRound([], OPTIONS, seeded(1))).toBeNull()
  })
})

describe('placing tiles', () => {
  const puzzle = puzzleOf('CAT')

  it('fills the first open place and takes a letter back from any', () => {
    let slots = emptyJumbleSlots(puzzle)
    slots = placeJumbleTile(slots, 2)
    slots = placeJumbleTile(slots, 0)
    expect(slots).toEqual([2, 0, null])
    expect(placeJumbleTile(slots, 2)).toBe(slots)
    expect(clearJumbleSlot(slots, 0)).toEqual([null, 0, null])
  })

  it('is solved by the letters, so matching letters can swap places', () => {
    const repeated = puzzleOf('DOOR')
    expect(isJumbleSolved(repeated, [0, 2, 1, 3])).toBe(true)
    expect(isJumbleSolved(repeated, [0, 2, 3, 1])).toBe(false)
    expect(isJumbleFull([0, 2, 3, 1])).toBe(true)
    expect(isJumbleSolved(repeated, [0, 1, 2, null])).toBe(false)
  })

  it('clears everything but the letters hints fixed', () => {
    expect(clearJumbleSlots([1, 0, 2], [1])).toEqual([null, 0, null])
  })
})

describe('revealJumbleLetter', () => {
  const puzzle = puzzleOf('CAT')

  it('puts the right letter in the first place that needs one', () => {
    expect(revealJumbleLetter(puzzle, [null, null, null])).toEqual({ index: 0, slots: [0, null, null] })
  })

  it('takes the letter from where it was wrong, and returns what it replaces', () => {
    expect(revealJumbleLetter(puzzle, [1, 0, null])).toEqual({ index: 0, slots: [0, null, null] })
  })

  it('never takes a letter from a place it is right in', () => {
    const repeated = puzzleOf('ABA')
    expect(revealJumbleLetter(repeated, [0, null, null])).toEqual({ index: 1, slots: [0, 1, null] })
    expect(revealJumbleLetter(repeated, [0, 1, null])).toEqual({ index: 2, slots: [0, 1, 2] })
  })

  it('has nothing to reveal once solved', () => {
    expect(revealJumbleLetter(puzzle, [0, 1, 2])).toBeNull()
  })
})
