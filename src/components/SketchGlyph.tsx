import { JSX, memo, useMemo } from 'react'
import Svg, { Path } from 'react-native-svg'

import { glyphWidth, sketchGlyphPath } from '@/modes/shared/sketchLetter'

const LETTER_HEIGHT = 0.68

// One letter in the board's sketch lettering, centered in a square of `size`, already drawn.
export const SketchGlyph = memo(({ letter, size, color }: { letter: string; size: number; color: string }): JSX.Element => {
  const height = size * LETTER_HEIGHT
  const d = useMemo(() => sketchGlyphPath(letter, (size - glyphWidth(letter, height)) / 2, (size - height) / 2, height), [letter, size, height])
  return (
    <Svg width={size} height={size} pointerEvents='none'>
      <Path d={d} fill='none' stroke={color} strokeWidth={Math.max(1.5, size * 0.075)} strokeLinecap='round' strokeLinejoin='round' />
    </Svg>
  )
})
SketchGlyph.displayName = 'SketchGlyph'
