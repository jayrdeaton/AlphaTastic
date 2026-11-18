import { act, render } from '@testing-library/react-native'

import { WordSearchGrid, type WordSearchGridProps } from '@/components/WordSearchGrid'

type Point = { x: number; y: number }
type PanHandlers = { enabled: boolean; onBegin: (point: Point) => void; onUpdate: (point: Point) => void; onFinalize: (event: object, success: boolean) => void }

// The real gesture needs a device, so this keeps the handlers the grid hands it and drives them directly.
const mockPan = {} as PanHandlers
jest.mock('react-native-gesture-handler', () => {
  const chain: Record<string, unknown> = {}
  for (const name of ['runOnJS', 'maxPointers', 'minDistance', 'shouldCancelWhenOutside']) chain[name] = () => chain
  chain.enabled = (value: boolean) => {
    mockPan.enabled = value
    return chain
  }
  for (const name of ['onBegin', 'onUpdate', 'onFinalize'] as const) {
    chain[name] = (handler: never) => {
      mockPan[name] = handler
      return chain
    }
  }
  return { Gesture: { Pan: () => chain }, GestureDetector: ({ children }: { children: unknown }) => children }
})

const CELL = 30
const at = (row: number, col: number): Point => ({ x: (col + 0.5) * CELL, y: (row + 0.5) * CELL })
const board = { size: 4, grid: ['CATS', 'XXXX', 'XXXX', 'XXXX'].map((row) => [...row]) }

const renderGrid = async (props: Partial<WordSearchGridProps> = {}) => {
  const onSelect = jest.fn()
  const screen = await render(<WordSearchGrid board={board} cellSize={CELL} found={[]} disabled={false} onSelect={onSelect} {...props} />)
  return { onSelect, ...screen }
}

describe('WordSearchGrid', () => {
  it('selects the line a drag covers, and shows it during the drag', async () => {
    const { onSelect, getByTestId, queryByTestId } = await renderGrid()

    await act(async () => mockPan.onBegin(at(0, 0)))
    await act(async () => mockPan.onUpdate(at(0, 3)))
    expect(getByTestId('word-search-selection').props).toMatchObject({ x1: 15, y1: 15, x2: 105, y2: 15 })
    expect(onSelect).not.toHaveBeenCalled()

    await act(async () => mockPan.onFinalize({}, true))
    expect(onSelect).toHaveBeenCalledWith({ row: 0, col: 0 }, { row: 0, col: 3 })
    expect(queryByTestId('word-search-selection')).toBeNull()
  })

  it('selects nothing on a tap', async () => {
    const { onSelect } = await renderGrid()

    await act(async () => mockPan.onBegin(at(1, 1)))
    await act(async () => mockPan.onFinalize({}, true))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('selects nothing when the drag is cancelled', async () => {
    const { onSelect, queryByTestId } = await renderGrid()

    await act(async () => mockPan.onBegin(at(0, 0)))
    await act(async () => mockPan.onUpdate(at(0, 3)))
    await act(async () => mockPan.onFinalize({}, false))

    expect(onSelect).not.toHaveBeenCalled()
    expect(queryByTestId('word-search-selection')).toBeNull()
  })

  // A new gesture has to be attached again, and a quick next drag could be lost in that gap.
  it('keeps one gesture as words are found, and calls the latest handler', async () => {
    const { onSelect, rerender } = await renderGrid()
    const { onBegin } = mockPan
    const latest = jest.fn()

    await rerender(<WordSearchGrid board={board} cellSize={CELL} found={[]} disabled={false} onSelect={latest} />)
    expect(mockPan.onBegin).toBe(onBegin)

    await act(async () => mockPan.onBegin(at(0, 0)))
    await act(async () => mockPan.onUpdate(at(0, 3)))
    await act(async () => mockPan.onFinalize({}, true))
    expect(latest).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('marks each found word, and stops taking drags once disabled', async () => {
    const found = [{ id: 'cats', start: { row: 0, col: 0 }, end: { row: 0, col: 3 } }]
    const { getByTestId } = await renderGrid({ found, disabled: true })

    expect(getByTestId('word-search-found-cats').props).toMatchObject({ x1: 15, x2: 105 })
    expect(mockPan.enabled).toBe(false)
  })

  it('draws every letter of the grid', async () => {
    const { getByTestId } = await renderGrid()

    // Each glyph starts at least one stroke, and so one move command.
    expect(getByTestId('word-search-letters').props.d.match(/M/g).length).toBeGreaterThanOrEqual(16)
  })
})
