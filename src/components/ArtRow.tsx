import { WELL_SHADOW } from '@tastic/hud/chrome'
import { JSX, memo, useCallback, useMemo, useRef } from 'react'
import { type LayoutChangeEvent, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'

import { VISIBLE_MODES } from '@/modes/registry'
import type { GameMode } from '@/types/gameModes'

import { ArtThumbnail, useArtColors } from './ArtThumbnail'

const TILE = 72
const GAP = 10
// The page's gutters, which the row bleeds past so it scrolls off the screen's edges.
const BLEED = 16

type ArtRowProps = {
  selected: GameMode
  // Keep it stable (useSelectArt's is): every tile is memoized on it.
  onSelect: (mode: GameMode) => void
  // The page is out of sight: a round a press started holds still.
  paused: boolean
}

// Hangman's art on its setup page (Jay, 2026-11-19, after HexFleet's arena picker: "the art should be
// visible"): a row of tiles, each art drawn complete in the player's colors with its name under it, the
// picked one ringed. A tap picks it and acts out a round on its tile (ArtThumbnail). It's the one place
// art is picked (the Settings sheet's grid went, Jay 2026-11-19). It scrolls sideways, opening on the art picked; in a browser, where a mouse can't swipe,
// every tile is on show, wrapping. An art since taken out of the picker stays listed for a player who
// still has it.
export const ArtRow = memo(({ selected, onSelect, paused }: ArtRowProps): JSX.Element => {
  const theme = useTheme()
  const { color, colors } = useArtColors()
  const modes = useMemo(() => (VISIBLE_MODES.some((mode) => mode.id === selected.id) ? VISIBLE_MODES : [selected, ...VISIBLE_MODES]), [selected])
  const scroll = useRef<ScrollView>(null)
  const placed = useRef(false)
  const selectedIndex = Math.max(
    0,
    modes.findIndex((mode) => mode.id === selected.id)
  )
  // Once, as it first lays out: the art picked in the middle of the row where it can be.
  const place = useCallback(
    (event: LayoutChangeEvent) => {
      if (placed.current) return
      placed.current = true
      const center = BLEED + selectedIndex * (TILE + GAP) + TILE / 2
      scroll.current?.scrollTo({ x: Math.max(0, center - event.nativeEvent.layout.width / 2), animated: false })
    },
    [selectedIndex]
  )

  const tiles = modes.map((mode) => {
    const active = mode.id === selected.id
    return (
      <View key={mode.id} style={styles.choice}>
        <ArtThumbnail mode={mode} selected={active} color={color} colors={colors} onSelect={onSelect} paused={paused} style={styles.tile} />
        <Text variant='labelSmall' numberOfLines={1} accessibilityElementsHidden importantForAccessibility='no' style={[styles.name, { color: active ? theme.colors.onSurface : theme.colors.onSurfaceVariant }, active && styles.nameActive]}>
          {mode.label}
        </Text>
      </View>
    )
  })

  if (Platform.OS === 'web')
    return (
      <View testID='art-row' style={styles.wrap}>
        {tiles}
      </View>
    )
  return (
    <ScrollView testID='art-row' ref={scroll} onLayout={place} horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={styles.row}>
      {tiles}
    </ScrollView>
  )
})
ArtRow.displayName = 'ArtRow'

const styles = StyleSheet.create({
  choice: { alignItems: 'center', gap: 6, width: TILE },
  name: { textAlign: 'center' },
  nameActive: { fontWeight: '700' },
  row: { gap: GAP, paddingHorizontal: BLEED, paddingVertical: 4 },
  scroll: { alignSelf: 'stretch', flexGrow: 0, marginHorizontal: -BLEED },
  // Raised off the board like the pills and cards around it.
  tile: { boxShadow: WELL_SHADOW, width: TILE },
  wrap: { alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', gap: GAP, justifyContent: 'center' }
})
