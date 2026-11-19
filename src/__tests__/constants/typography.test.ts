import { TITLE_FONT_ADVANCES } from '@/constants/titleFontAdvances.generated'
import { fitTitleSize, TITLE_FONT, titleType } from '@/constants/typography'

describe('the title font', () => {
  // Jay, 2026-11-19: titles in capitals, like the puzzles.
  it('sets titles in its capitals, one weight', () => {
    expect(titleType).toMatchObject({ fontFamily: TITLE_FONT, fontWeight: 'normal', textTransform: 'uppercase' })
  })

  it('knows the width of every printable character', () => {
    for (let code = 32; code < 127; code++) expect(TITLE_FONT_ADVANCES[String.fromCharCode(code)]).toBeGreaterThan(0)
  })
})

describe('fitTitleSize', () => {
  // A phone's header: about 300 points for the title between its glyphs.
  it('keeps a title that fits at its size', () => {
    expect(fitTitleSize('Choose Packs', 300, 24)).toBe(24)
  })

  it('shrinks a long one until it fits its line', () => {
    const size = fitTitleSize('Countries & Territories', 300, 24)
    expect(size).toBeLessThan(24)
    const units = [...'COUNTRIES & TERRITORIES'].reduce((sum, letter) => sum + TITLE_FONT_ADVANCES[letter], 0)
    expect((units * size) / 1000 + 23).toBeLessThanOrEqual(300)
  })

  it('goes no smaller than its floor, past which the title is cut short', () => {
    expect(fitTitleSize('A custom pack with a very long name indeed, sixty characters', 300, 24)).toBe(16)
  })
})
