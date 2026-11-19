import { act, render } from '@testing-library/react-native'
import { Provider as PaperProvider } from 'react-native-paper'

import { PackHero } from '@/components/PackHero'
import { firstLetterMs, LETTER_STAGGER_MS } from '@/components/SolvingWord'

// Each line as text, its unrevealed letters as '_' (what SketchWord is asked to draw).
jest.mock('@/components/SketchWord', () => {
  const { createElement } = jest.requireActual('react')
  const { Text } = jest.requireActual('react-native')
  return {
    ...jest.requireActual('@/components/SketchWord'),
    SketchWord: ({ letters }: { letters: string[] }) => createElement(Text, { testID: 'hero-line' }, letters.join(''))
  }
})

const renderHero = (active = true) =>
  render(
    <PaperProvider>
      <PackHero words={['Alpha', 'Tastic']} color='#000000' p1Color='#f44336' p2Color='#2196f3' active={active} />
    </PaperProvider>
  )
type Screen = Awaited<ReturnType<typeof renderHero>>
const lines = (screen: Screen) => screen.getAllByTestId('hero-line', { includeHiddenElements: true }).map((line) => line.props.children)
const advance = async (ms: number) => {
  for (let step = 0; step < ms; step += 10) {
    await act(async () => {
      jest.advanceTimersByTime(10)
    })
  }
}

describe('PackHero', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  // Jay, 2026-11-19: from the A of ALPHA to the C of TASTIC, one letter at a time, not both lines at once.
  it('solves its wordmark one letter at a time, the first line before the second', async () => {
    const screen = await renderHero()
    const start = Math.max(firstLetterMs(5), firstLetterMs(6))

    await advance(start - 10)
    expect(lines(screen)).toEqual(['_____', '______'])

    await advance(10)
    expect(lines(screen)).toEqual(['A____', '______'])

    await advance(4 * LETTER_STAGGER_MS)
    expect(lines(screen)).toEqual(['ALPHA', '______'])

    await advance(LETTER_STAGGER_MS)
    expect(lines(screen)).toEqual(['ALPHA', 'T_____'])

    await advance(5 * LETTER_STAGGER_MS)
    expect(lines(screen)).toEqual(['ALPHA', 'TASTIC'])
  })

  it('waits while Home is covered', async () => {
    const screen = await renderHero(false)

    await advance(5000)

    expect(lines(screen)).toEqual(['_____', '______'])
  })
})
