import type { HeroTitleProps } from '@tastic/shell'
import { JSX, useCallback, useEffect, useState } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import { Text } from 'react-native-paper'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { labelType } from '@/constants/typography'

import { fitSketchWordFontSize } from './SketchWord'
import { firstLetterMs, LETTER_STAGGER_MS, SolvingWord } from './SolvingWord'

const MAX_FONT_SIZE = 64
const COLUMN_WIDTH = 480
const SIDE_MARGIN = 32
const LINE_GAP = 8
const SUBTITLE = 'Word Games'
const SUBTITLE_OPACITY = 0.6
const SUBTITLE_FADE_MS = 600

// Home's wordmark, one word to a line, solved like a puzzle on the board: every blank draws in, then
// each gives way to its letter, one at a time from the first word's first letter to the last word's
// last (Jay, 2026-11-19: A to C, not both lines at once), the way a right guess fills a blank. Then the
// subtitle fades in. It waits while Home is covered.
export const PackHero = ({ words, color, active, fit }: HeroTitleProps): JSX.Element => {
  const { width: windowWidth } = useWindowDimensions()
  const lines = words.map((word) => word.toUpperCase())
  const width = fit?.width ?? Math.min(windowWidth, COLUMN_WIDTH) - SIDE_MARGIN * 2
  const longest = Math.max(...lines.map((line) => line.length))
  const tallest = fit ? (fit.height - LINE_GAP * (lines.length - 1)) / lines.length : MAX_FONT_SIZE
  const fontSize = fitSketchWordFontSize(longest, width, Math.min(MAX_FONT_SIZE, tallest))
  // Every line's blanks are in by the first letter; each line's letters follow the line before's.
  const start = Math.max(...lines.map((line) => firstLetterMs(line.length)))
  const before = lines.map((_, index) => lines.slice(0, index).reduce((sum, line) => sum + line.length, 0))
  const [solved, setSolved] = useState(false)
  const handleSolved = useCallback(() => setSolved(true), [])
  const subtitleOpacity = useSharedValue(0)
  useEffect(() => {
    if (solved) subtitleOpacity.value = withTiming(SUBTITLE_OPACITY, { duration: SUBTITLE_FADE_MS })
  }, [solved, subtitleOpacity])
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }))
  return (
    <View style={styles.block}>
      <View style={styles.hero} accessible accessibilityRole='header' accessibilityLabel={words.join('')}>
        {lines.map((line, index) => (
          <SolvingWord key={line} word={line} fontSize={fontSize} color={color} paused={!active} firstLetterDelayMs={start + before[index] * LETTER_STAGGER_MS} onSolved={index === lines.length - 1 ? handleSolved : undefined} />
        ))}
      </View>
      {/* What the pack is, under its name (Jay, 2026-11-19). */}
      <Animated.View style={subtitleStyle}>
        <Text style={[styles.subtitle, labelType, { color }]}>{SUBTITLE}</Text>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Room above it, under the corners, and more below, before the cards.
  block: { alignItems: 'center', gap: 12, paddingBottom: 24, paddingTop: 12 },
  hero: { alignItems: 'center', gap: LINE_GAP },
  subtitle: { letterSpacing: 4 }
})
