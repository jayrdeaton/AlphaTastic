import { IconButton } from '@rific/feedback-press'
import { JSX, type ReactNode, useCallback, useState } from 'react'
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { fitTitleSize, titleType } from '@/constants/typography'

export type ScreenHeaderProps = {
  // The glyph at its start: 'close' for a whole-screen modal, 'arrow-left' for a page inside one.
  icon: 'close' | 'arrow-left'
  label: string
  onPress: () => void
  // Holds the screen open (Choose Packs with no pack selected).
  disabled?: boolean
  title: string
  // Plain glyphs at its end (the pack editor's Share and Delete).
  trailing?: ReactNode
}

// A whole screen's header, the way the fleet's own screens draw theirs (@tastic/hud's BaseStatsScreen:
// Stats & Achievements, the Profiles screen): a plain glyph in the screen's ink, then the title, bold,
// on the board itself rather than a bar of its own. The glyph is a 48pt target (hitSlop 4, as the
// corners'). The title is in the title font's capitals, shrunk to fit its line (fitTitleSize: a long pack
// name), and past that (a custom pack's name, up to 60 characters) cut short.
const TITLE_SIZE = 24
export const ScreenHeader = ({ icon, label, onPress, disabled = false, title, trailing }: ScreenHeaderProps): JSX.Element => {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const ink = theme.colors.onSurface
  const [width, setWidth] = useState(0)
  const handleLayout = useCallback((event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width), [])
  const fontSize = width > 0 ? fitTitleSize(title, width, TITLE_SIZE) : TITLE_SIZE
  return (
    <View style={[styles.header, { paddingTop: 8 + insets.top }]}>
      <IconButton icon={icon} iconColor={ink} size={24} hitSlop={4} onPress={onPress} disabled={disabled} accessibilityLabel={label} />
      <Text variant='headlineSmall' numberOfLines={1} accessibilityRole='header' onLayout={handleLayout} style={[styles.title, { color: ink }, titleType, { fontSize }]}>
        {title}
      </Text>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', gap: 4, paddingBottom: 8, paddingHorizontal: 8 },
  title: { flex: 1, fontWeight: 'bold' },
  trailing: { alignItems: 'center', flexDirection: 'row' }
})
