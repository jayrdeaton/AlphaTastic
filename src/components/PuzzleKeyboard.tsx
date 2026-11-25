import { useAutoPaperTheme } from '@rific/auto-paper'
import { Pressable } from '@rific/feedback-press'
import { JSX, memo, useState } from 'react'
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native'
import { Icon, Text } from 'react-native-paper'

import { keyType } from '@/constants/typography'
import { useKeyboardLayout } from '@/hooks/useKeyboardLayout'

import { KEY_MARGIN, KeyFill, LAYOUT_ROWS } from './Keyboard'

const KEY_HEIGHT = 42
const ROW_MARGIN = 4
const ERASE_KEYS_WIDE = 1.5
const KEY_HIT_SLOP = { top: ROW_MARGIN, bottom: ROW_MARGIN, left: KEY_MARGIN, right: KEY_MARGIN }

type PuzzleKeyProps = { label: string; width?: number; used: boolean; disabled: boolean; onPress: () => void; icon?: string }

const PuzzleKey = ({ label, width, used, disabled, onPress, icon }: PuzzleKeyProps): JSX.Element => {
  const { colors } = useAutoPaperTheme()
  const fill = used ? colors.surfaceVariant : colors.primary
  const ink = used ? colors.onSurfaceVariant : colors.onPrimary
  return (
    <View style={disabled && styles.keyOff}>
      {width !== undefined ? <KeyFill key={fill} width={width} height={KEY_HEIGHT} color={fill} start delayMs={0} /> : null}
      <Pressable onPress={onPress} disabled={disabled} hitSlop={KEY_HIT_SLOP} accessibilityRole='button' accessibilityLabel={label} accessibilityState={{ disabled, selected: used }} style={[styles.key, width !== undefined && { width }]}>
        {icon ? (
          <Icon source={icon} size={20} color={ink} />
        ) : (
          <Text variant='titleSmall' style={[keyType, { color: ink }]}>
            {label}
          </Text>
        )}
      </Pressable>
    </View>
  )
}

export type PuzzleKeyboardProps = {
  // Letters already written somewhere: still pressable, since writing one moves it.
  used: ReadonlySet<string>
  // Letters that can't be written: the puzzle gave them or a hint fixed them.
  fixed: ReadonlySet<string>
  disabled: boolean
  onLetter: (letter: string) => void
  onErase: () => void
}

// The letter keys for a puzzle where an answer can change, in the player's keyboard layout and the
// Hangman keyboard's hand-drawn look. Hangman's own spends a key for good once it's pressed.
export const PuzzleKeyboard = memo(({ used, fixed, disabled, onLetter, onErase }: PuzzleKeyboardProps): JSX.Element => {
  const { layout } = useKeyboardLayout()
  const rows = LAYOUT_ROWS[layout]
  const [containerWidth, setContainerWidth] = useState(0)
  const handleLayout = ({ nativeEvent }: LayoutChangeEvent) => setContainerWidth(nativeEvent.layout.width)
  const columns = Math.max(...rows.map((row) => row.length))
  const keyWidth = containerWidth > 0 ? containerWidth / columns - KEY_MARGIN * 2 : undefined
  return (
    <View testID='puzzle-keyboard' style={styles.keyboard} onLayout={handleLayout}>
      {rows.map((row, rowIndex) => (
        <View key={row[0]} style={styles.row}>
          {row.map((letter) => (
            <PuzzleKey key={letter} label={letter} width={keyWidth} used={used.has(letter) || fixed.has(letter)} disabled={disabled || fixed.has(letter)} onPress={() => onLetter(letter)} />
          ))}
          {rowIndex === rows.length - 1 ? <PuzzleKey label='Erase' icon='backspace-outline' width={keyWidth === undefined ? undefined : keyWidth * ERASE_KEYS_WIDE} used disabled={disabled} onPress={onErase} /> : null}
        </View>
      ))}
    </View>
  )
})
PuzzleKeyboard.displayName = 'PuzzleKeyboard'

const styles = StyleSheet.create({
  key: { alignItems: 'center', height: KEY_HEIGHT, justifyContent: 'center', marginHorizontal: KEY_MARGIN, minWidth: 24 },
  keyOff: { opacity: 0.45 },
  keyboard: { width: '100%' },
  row: { flexDirection: 'row', justifyContent: 'center', marginVertical: ROW_MARGIN }
})
