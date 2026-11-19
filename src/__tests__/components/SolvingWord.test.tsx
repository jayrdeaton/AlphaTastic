import { render } from '@testing-library/react-native'

import { SolvingWord } from '@/components/SolvingWord'
import { SketchDrawnContext } from '@/modes/shared/sketchShapes'

// Each word as text, its unrevealed letters as '_' (what SketchWord is asked to draw).
jest.mock('@/components/SketchWord', () => {
  const { createElement } = jest.requireActual('react')
  const { Text } = jest.requireActual('react-native')
  return {
    ...jest.requireActual('@/components/SketchWord'),
    SketchWord: ({ letters }: { letters: string[] }) => createElement(Text, { testID: 'word' }, letters.join(''))
  }
})

describe('SolvingWord', () => {
  it('starts on its blanks', async () => {
    const screen = await render(<SolvingWord word='HANGMAN' fontSize={20} color='#000000' />)

    expect(screen.getByTestId('word').props.children).toBe('_______')
  })

  // An art tile before its first press (Letters Only's preview): no reveal as the page opens.
  it('starts solved where shapes mount already drawn', async () => {
    const screen = await render(
      <SketchDrawnContext.Provider value>
        <SolvingWord word='HANGMAN' fontSize={20} color='#000000' />
      </SketchDrawnContext.Provider>
    )

    expect(screen.getByTestId('word').props.children).toBe('HANGMAN')
  })
})
