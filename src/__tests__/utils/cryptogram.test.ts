import { spellsBlockedWord } from '@/utils/blockedWords'
import { assignGuess, buildCryptogram, createCipher, type CryptogramBoard, cryptogramRulesFor, describeCryptogram, drawCryptogram, eraseGuess, isCryptogramFull, isCryptogramSolved, nextOpenCipher, revealCipher, startingGuesses } from '@/utils/cryptogram'
import { getPuzzleManifest } from '@/utils/puzzleCatalog'

const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const PACK = { key: 'test', label: 'Test Pack', categories: ['Thing'] }
const ANSWERS = ['The Quick Brown Fox', 'Jumping Over Dogs', 'Pack My Box With Jugs', 'Bright Vixens Jump', 'Sphinx Of Black Quartz', 'Short', 'One Two', 'A Name With Averyveryverylongword Inside']
const puzzles = ANSWERS.map((answer, i) => ({ id: `p${i}`, answer, category: 'Thing' }))

// CAB in code XYZ.
const board: Pick<CryptogramBoard, 'cipherLetters' | 'plainByCipher' | 'given'> = { cipherLetters: ['X', 'Y', 'Z'], plainByCipher: { X: 'C', Y: 'A', Z: 'B' }, given: ['Z'] }

const OPTIONS = { length: 'medium', headStart: '3' } as const
const RULES = { medium: cryptogramRulesFor(OPTIONS), long: cryptogramRulesFor({ length: 'long', headStart: '1' }) }

describe('createCipher', () => {
  it('maps every letter to a different one, none to itself', () => {
    for (let seed = 0; seed < 50; seed++) {
      const cipher = createCipher(seeded(seed))
      expect(new Set(Object.values(cipher)).size).toBe(26)
      for (const [plain, code] of Object.entries(cipher)) expect(code).not.toBe(plain)
    }
  })
})

describe('buildCryptogram', () => {
  it('encodes the answer letter for letter and decodes back', () => {
    for (let seed = 0; seed < 30; seed++) {
      const built = buildCryptogram(PACK, puzzles, RULES.medium, seeded(seed))!
      expect(built.cipherWords.map((word) => [...word].map((code) => built.plainByCipher[code]).join(''))).toEqual(built.words)
      expect(built.given).toHaveLength(RULES.medium.givenLetters)
      expect(built.cipherLetters).toEqual([...new Set(built.cipherWords.join(''))])
      for (const word of built.cipherWords) expect(spellsBlockedWord(word)).toBe(false)
    }
  })

  it('uses only answers of several words, with enough different letters', () => {
    for (let seed = 0; seed < 30; seed++) expect(['Short', 'One Two', 'A Name With Averyveryverylongword Inside']).not.toContain(buildCryptogram(PACK, puzzles, RULES.long, seeded(seed))!.answer)
  })

  it('gives up with too few usable answers', () => {
    expect(buildCryptogram(PACK, puzzles.slice(0, 3), RULES.medium, seeded(1))).toBeNull()
  })
})

describe('drawCryptogram', () => {
  it('takes its length and head start from the settings', () => {
    expect(cryptogramRulesFor({ length: 'short', headStart: '5' })).toEqual({ maxLetters: 28, givenLetters: 5 })
    expect(describeCryptogram({ length: 'long', headStart: '1' })).toBe('Answers up to 44 letters, with 1 code letter solved')
    expect(describeCryptogram(OPTIONS)).toBe('Answers up to 36 letters, with 3 code letters solved')
  })

  it('draws from a selected pack', () => {
    const pack = getPuzzleManifest().sort((a, b) => b.count - a.count)[0]
    expect(drawCryptogram([pack.key], OPTIONS, seeded(3))).toMatchObject({ packKey: pack.key })
  })

  it('has nothing to draw with no pack selected', () => {
    expect(drawCryptogram([], OPTIONS, seeded(1))).toBeNull()
  })
})

describe('writing letters', () => {
  const locked = ['Z']
  const start = startingGuesses(board)

  it('starts with the given letters written', () => {
    expect(start).toEqual({ Z: 'B' })
  })

  it('moves a letter when it is written somewhere else', () => {
    const once = assignGuess(board, start, locked, 'X', 'A')
    expect(assignGuess(board, once, locked, 'Y', 'A')).toEqual({ Z: 'B', Y: 'A' })
  })

  it('leaves fixed letters alone, and never reuses one', () => {
    expect(assignGuess(board, start, locked, 'Z', 'A')).toBe(start)
    expect(assignGuess(board, start, locked, 'X', 'B')).toBe(start)
    expect(eraseGuess(start, locked, 'Z')).toBe(start)
  })

  it('erases a written letter', () => {
    expect(eraseGuess({ Z: 'B', X: 'C' }, locked, 'X')).toEqual({ Z: 'B' })
  })

  it('knows full from solved', () => {
    expect(isCryptogramFull(board, { X: 'A', Y: 'C', Z: 'B' })).toBe(true)
    expect(isCryptogramSolved(board, { X: 'A', Y: 'C', Z: 'B' })).toBe(false)
    expect(isCryptogramSolved(board, { X: 'C', Y: 'A', Z: 'B' })).toBe(true)
  })

  it('finds the next open code letter, wrapping round', () => {
    expect(nextOpenCipher(board, { Z: 'B' }, 'X')).toBe('Y')
    expect(nextOpenCipher(board, { Y: 'A', Z: 'B' }, 'Y')).toBe('X')
    expect(nextOpenCipher(board, { X: 'C', Y: 'A', Z: 'B' }, 'X')).toBeNull()
  })
})

describe('revealCipher', () => {
  it('solves and fixes the chosen letter, taking its letter from anywhere wrong', () => {
    expect(revealCipher(board, { Z: 'B', Y: 'C' }, ['Z'], 'X')).toEqual({ guesses: { Z: 'B', X: 'C' }, locked: ['Z', 'X'], cipher: 'X' })
  })

  it('moves on to the first open letter when the chosen one is fixed or right', () => {
    expect(revealCipher(board, { Z: 'B' }, ['Z'], 'Z')?.cipher).toBe('X')
    expect(revealCipher(board, { Z: 'B', X: 'C' }, ['Z'], 'X')?.cipher).toBe('Y')
  })

  it('has nothing to reveal once solved', () => {
    expect(revealCipher(board, { X: 'C', Y: 'A', Z: 'B' }, ['Z'], null)).toBeNull()
  })
})
