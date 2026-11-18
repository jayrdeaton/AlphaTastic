import { getPuzzleManifest } from '@/utils/puzzleCatalog'
import { buildWordSearch, drawWordSearch, findSelectedWord, type GridCell, snapWordSearchSelection, WORD_SEARCH_RULES, wordSearchCellAt, wordSearchEntries, type WordSearchGrid, wordSearchLines, wordSearchRulesFor } from '@/utils/wordSearch'

// A small seeded generator, so a failure names the seed that caused it.
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const ANSWERS = ['Bruins', 'Canadiens', 'Flames', 'Oilers', 'Red Wings', 'Maple Leafs', 'Rangers', 'Penguins', 'Blackhawks', 'Sharks', 'Kings', 'Ducks', 'Stars', 'Blues', 'Jets', 'Wild']
const entries = wordSearchEntries(
  ANSWERS.map((answer, i) => ({ id: `p${i}`, answer })),
  12
)

const cellsOf = (start: GridCell, end: GridCell): GridCell[] => {
  const steps = Math.max(Math.abs(end.row - start.row), Math.abs(end.col - start.col))
  return Array.from({ length: steps + 1 }, (_, i) => ({ row: start.row + ((end.row - start.row) / steps) * i, col: start.col + ((end.col - start.col) / steps) * i }))
}
const spelled = (board: WordSearchGrid, start: GridCell, end: GridCell) =>
  cellsOf(start, end)
    .map(({ row, col }) => board.grid[row][col])
    .join('')

describe('wordSearchEntries', () => {
  it('drops spaces and punctuation, and skips what is too short, too long or repeated', () => {
    const result = wordSearchEntries(
      [
        { id: 'a', answer: 'Spider-Man' },
        { id: 'b', answer: 'SPIDERMAN' },
        { id: 'c', answer: 'Ice' },
        { id: 'd', answer: 'A Very Long Answer Indeed' }
      ],
      12
    )
    expect(result).toEqual([{ id: 'a', answer: 'Spider-Man', letters: 'SPIDERMAN' }])
  })
})

describe('buildWordSearch', () => {
  it.each(Object.entries(WORD_SEARCH_RULES))('hides every word along a straight line on %s', (_name, rules) => {
    for (let seed = 0; seed < 40; seed++) {
      const board = buildWordSearch(
        entries.filter((entry) => entry.letters.length <= rules.size),
        rules,
        seeded(seed)
      )
      expect(board).not.toBeNull()
      expect(board!.words).toHaveLength(rules.wordCount)
      expect(board!.grid.flat().every((letter) => /^[A-Z]$/.test(letter))).toBe(true)
      for (const word of board!.words) {
        expect(spelled(board!, word.start, word.end)).toBe(word.letters)
        const step = [Math.sign(word.end.row - word.start.row), Math.sign(word.end.col - word.start.col)]
        expect(rules.directions).toContainEqual(step)
      }
    }
  })

  it('never hides a word inside another', () => {
    const nested = wordSearchEntries(
      ['Iron', 'Iron Man', 'Norim', 'Thor', 'Hulk', 'Loki'].map((answer, i) => ({ id: `n${i}`, answer })),
      12
    )
    for (let seed = 0; seed < 20; seed++) {
      const board = buildWordSearch(nested, { ...WORD_SEARCH_RULES.medium, wordCount: 4 }, seeded(seed))
      const hidden = board!.words.map((word) => word.letters)
      expect(hidden.includes('IRON') && hidden.includes('IRONMAN')).toBe(false)
    }
  })

  it('gives up when there are too few answers to fill the grid', () => {
    expect(buildWordSearch(entries.slice(0, 3), WORD_SEARCH_RULES.medium, seeded(1))).toBeNull()
  })

  it('keeps blocked words out of the filler in every direction', () => {
    const blocked = /FUCK|SHIT|CUNT|COCK|DICK|PUSSY|BITCH|ASS|SEX|KCUF|TIHS|TNUC|KCOC|KCID|YSSUP|HCTIB|SSA|XES/
    for (let seed = 0; seed < 150; seed++) {
      const board = buildWordSearch(entries, WORD_SEARCH_RULES.hard, seeded(seed))!
      const hidden = new Set(board.words.flatMap((word) => cellsOf(word.start, word.end).map(({ row, col }) => `${row},${col}`)))
      for (const line of wordSearchLines(board.size)) {
        const text = line.map(({ row, col }) => board.grid[row][col]).join('')
        const match = blocked.exec(text)
        if (match) expect(line.slice(match.index, match.index + match[0].length).every(({ row, col }) => hidden.has(`${row},${col}`))).toBe(true)
      }
    }
  })
})

describe('wordSearchLines', () => {
  it('covers every row, column and diagonal once', () => {
    const lines = wordSearchLines(4)
    expect(lines).toHaveLength(4 + 4 + 7 + 7)
    expect(lines.flat()).toHaveLength(16 * 4)
  })
})

describe('drawWordSearch', () => {
  const big = getPuzzleManifest().sort((a, b) => b.count - a.count)[0]

  it('draws a themed grid from a selected pack', () => {
    const board = drawWordSearch([big.key], 'hard', seeded(3))
    expect(board).toMatchObject({ packKey: big.key, packLabel: big.label, size: 12 })
    expect(board!.words).toHaveLength(12)
  })

  it('reads Any as Medium', () => {
    expect(wordSearchRulesFor('any')).toBe(WORD_SEARCH_RULES.medium)
  })

  it('has nothing to draw with no pack selected', () => {
    expect(drawWordSearch([], 'any', seeded(1))).toBeNull()
  })
})

describe('the drag', () => {
  const CELL = 30
  const center = ({ row, col }: GridCell) => ({ x: (col + 0.5) * CELL, y: (row + 0.5) * CELL })

  it('finds the cell under a point, and stays on the grid', () => {
    expect(wordSearchCellAt(65, 31, CELL, 12)).toEqual({ row: 1, col: 2 })
    expect(wordSearchCellAt(-5, 9999, CELL, 12)).toEqual({ row: 11, col: 0 })
  })

  it.each([
    [0, 3],
    [3, 3],
    [3, 0],
    [3, -3],
    [0, -3],
    [-3, -3],
    [-3, 0],
    [-3, 3]
  ])('snaps a drag of %i rows and %i columns to its line', (rows, cols) => {
    const start = { row: 5, col: 5 }
    const end = { row: start.row + rows, col: start.col + cols }
    const point = center(end)
    expect(snapWordSearchSelection(start, point.x + 4, point.y - 3, CELL, 12)).toEqual(end)
  })

  it('stays on a straight line when the finger wanders off it', () => {
    const { x, y } = center({ row: 6, col: 9 })
    expect(snapWordSearchSelection({ row: 5, col: 5 }, x, y, CELL, 12)).toEqual({ row: 5, col: 9 })
  })

  it('stops at the edge of the grid', () => {
    expect(snapWordSearchSelection({ row: 1, col: 10 }, 900, 900, CELL, 12)).toEqual({ row: 2, col: 11 })
  })

  it('stays put while the finger is on the first cell', () => {
    const start = { row: 2, col: 2 }
    const { x, y } = center(start)
    expect(snapWordSearchSelection(start, x + 3, y + 3, CELL, 12)).toEqual(start)
  })
})

describe('findSelectedWord', () => {
  const board = {
    grid: [
      ['C', 'A', 'T', 'S'],
      ['X', 'X', 'X', 'X'],
      ['S', 'T', 'A', 'C'],
      ['X', 'X', 'X', 'X']
    ],
    words: [{ id: 'cats', answer: 'Cats', letters: 'CATS', start: { row: 0, col: 0 }, end: { row: 0, col: 3 } }]
  }

  it('matches a word read from either end', () => {
    expect(findSelectedWord(board, [], { row: 0, col: 0 }, { row: 0, col: 3 })?.id).toBe('cats')
    expect(findSelectedWord(board, [], { row: 0, col: 3 }, { row: 0, col: 0 })?.id).toBe('cats')
  })

  it('counts a copy somewhere other than where the word was placed', () => {
    expect(findSelectedWord(board, [], { row: 2, col: 0 }, { row: 2, col: 3 })?.id).toBe('cats')
  })

  it('ignores a word already found, and letters that spell nothing', () => {
    expect(findSelectedWord(board, ['cats'], { row: 0, col: 0 }, { row: 0, col: 3 })).toBeNull()
    expect(findSelectedWord(board, [], { row: 0, col: 0 }, { row: 0, col: 2 })).toBeNull()
  })
})
