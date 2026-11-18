import type { HeroTitleProps } from '@tastic/shell'
import { JSX } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'

import { fitSketchWordFontSize } from './SketchWord'
import { SolvingWord } from './SolvingWord'

const MAX_FONT_SIZE = 64
const COLUMN_WIDTH = 480
const SIDE_MARGIN = 32
const LINE_GAP = 8

// Home's wordmark, one word to a line, solved like a puzzle on the board: each word's blanks draw in,
// then each gives way to its letter, left to right, the way a right guess fills a blank. It waits while
// Home is covered.
export const PackHero = ({ words, color, active, fit }: HeroTitleProps): JSX.Element => {
  const { width: windowWidth } = useWindowDimensions()
  const lines = words.map((word) => word.toUpperCase())
  const width = fit?.width ?? Math.min(windowWidth, COLUMN_WIDTH) - SIDE_MARGIN * 2
  const longest = Math.max(...lines.map((line) => line.length))
  const tallest = fit ? (fit.height - LINE_GAP * (lines.length - 1)) / lines.length : MAX_FONT_SIZE
  const fontSize = fitSketchWordFontSize(longest, width, Math.min(MAX_FONT_SIZE, tallest))
  return (
    <View style={styles.hero} accessible accessibilityRole='header' accessibilityLabel={words.join('')}>
      {lines.map((line) => (
        <SolvingWord key={line} word={line} fontSize={fontSize} color={color} paused={!active} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: LINE_GAP, paddingVertical: 8 }
})
