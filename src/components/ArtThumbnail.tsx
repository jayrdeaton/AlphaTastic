import { resolveSeedColor, useAutoPaperTheme, useThemeSettings } from '@rific/auto-paper'
import { TouchableRipple } from '@rific/feedback-press'
import { JSX, memo, useCallback, useMemo, useState } from 'react'
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'

import { useArtDemoLoop } from '@/hooks/useArtDemoLoop'
import { SketchDrawnContext } from '@/modes/shared/sketchShapes'
import type { GameMode } from '@/types/gameModes'

import { GameVisual } from './GameVisual'

type ArtThumbnailProps = {
  mode: GameMode
  selected: boolean
  color: string
  colors: string[]
  onSelect: (mode: GameMode) => void
  // Holds a round a press started while the thumbnail is out of sight (the setup page under a game).
  paused?: boolean
  style?: StyleProp<ViewStyle>
}

// Waits for a press, then plays one round (see useArtDemoLoop's waitForReplay).
const THUMBNAIL_DEMO = { waitForReplay: true }

// One art, drawn complete in the player's colors, the selected one framed in primary: a tile of the
// setup page's art row (ArtRow). It shows already drawn (SketchDrawnContext) and holds still with no
// timers running; a press picks it and acts out a round, like the hero (Jay, 2026-10-18), Classic's figure
// redrawn under its gallows, then holds again. Memoized, so a pick re-renders just the old and new
// picks.
export const ArtThumbnail = memo(({ mode, selected, color, colors, onSelect, paused = false, style }: ArtThumbnailProps): JSX.Element => {
  const theme = useAutoPaperTheme()
  const { mistakes, revealKey, cardOpacity, partsOpacity, replay } = useArtDemoLoop(true, paused, mode, THUMBNAIL_DEMO)
  const visualStyle = useAnimatedStyle(() => ({ opacity: cardOpacity.value }))
  // Drawn from the start, with no draw-in (Jay, 2026-11-19), until the first press, whose round draws it
  // in (its art remounts under the switched-off context).
  const [pressed, setPressed] = useState(false)
  const handlePress = useCallback(() => {
    setPressed(true)
    onSelect(mode)
    replay()
  }, [onSelect, mode, replay])
  return (
    <TouchableRipple onPress={handlePress} accessibilityRole='button' accessibilityLabel={`${mode.label} art`} accessibilityState={{ selected }} style={[styles.thumbnail, { backgroundColor: theme.colors.surface, borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant }, style]}>
      <Animated.View style={[styles.visual, visualStyle]}>
        <SketchDrawnContext.Provider value={!pressed}>
          <GameVisual key={revealKey} mode={mode} mistakes={mistakes} color={color} colors={colors} partsOpacity={partsOpacity} style={styles.visual} />
        </SketchDrawnContext.Provider>
      </Animated.View>
    </TouchableRipple>
  )
})
ArtThumbnail.displayName = 'ArtThumbnail'

// The player's palette, as the board draws an art: the seed color and the triad PuzzleStage builds, so
// a thumbnail shows the art's full colors.
export const useArtColors = (): { color: string; colors: string[] } => {
  const theme = useAutoPaperTheme()
  const { settings } = useThemeSettings()
  const color = resolveSeedColor(settings.color)
  const { primary, secondary, tertiary } = theme.colors
  const colors = useMemo(() => [primary, secondary, tertiary], [primary, secondary, tertiary])
  return { color, colors }
}

const styles = StyleSheet.create({
  // The visual is a square scene (every mode draws in a 100x100 viewBox), so the thumbnail is too.
  thumbnail: { aspectRatio: 1, borderRadius: 8, borderWidth: 2, overflow: 'hidden' },
  visual: { flex: 1, width: '100%' }
})
