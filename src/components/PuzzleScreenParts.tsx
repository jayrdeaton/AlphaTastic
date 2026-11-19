import { Button } from '@rific/feedback-press'
import { ConfirmDialog } from '@tastic/hud/chrome'
import { JSX, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Portal, Text, useTheme } from 'react-native-paper'

import { DEFAULT_CELEBRATION } from '@/effects/registry'
import { goHome, safeBack } from '@/utils/navigation'
import { gameShell } from '@/utils/webLayout'

import { ReadableAccent } from './ReadableAccent'
import { ScreenHeader } from './ScreenHeader'

// A win's fireworks get a moment before the card covers them, as a solved Hangman puzzle's do.
const SOLVED_CARD_DELAY_MS = 2000
const CelebrationView = DEFAULT_CELEBRATION.Component

export const formatElapsed = (ms: number): string => {
  const seconds = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// How a puzzle game ends: fireworks, then a card with Next Puzzle and Home. Mounted once it's solved.
export const PuzzleSolvedCelebration = ({ message, onNext }: { message: string; onNext: () => void }): JSX.Element => {
  const theme = useTheme()
  const [cardVisible, setCardVisible] = useState(false)
  const [celebrationCycle, setCelebrationCycle] = useState(0)

  useEffect(() => {
    const timeout = setTimeout(() => setCardVisible(true), SOLVED_CARD_DELAY_MS)
    return () => clearTimeout(timeout)
  }, [])

  return (
    <>
      {!cardVisible ? (
        <Portal>
          <CelebrationView key={celebrationCycle} colors={[theme.colors.primary, theme.colors.secondary, theme.colors.tertiary]} dark={theme.dark} onComplete={() => setCelebrationCycle((cycle) => cycle + 1)} />
        </Portal>
      ) : null}
      <ReadableAccent>
        <ConfirmDialog visible={cardVisible} icon='trophy' title='Puzzle Solved!' message={message} confirmLabel='Next Puzzle' cancelLabel='Home' onConfirm={onNext} onCancel={goHome} />
      </ReadableAccent>
    </>
  )
}

// What a puzzle game shows when none of the player's selected packs can make a puzzle for it.
export const PuzzleUnavailable = ({ title, message }: { title: string; message: string }): JSX.Element => {
  const theme = useTheme()
  return (
    <View style={[styles.screen, gameShell]}>
      <ScreenHeader icon='arrow-left' label='Back' onPress={safeBack} title={title} />
      <View style={styles.empty}>
        <Text variant='bodyLarge' style={[styles.emptyText, { color: theme.colors.onSurface }]}>
          {message}
        </Text>
        <Button mode='contained' icon='cards-outline' onPress={safeBack}>
          Choose Packs
        </Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', flex: 1, gap: 24, justifyContent: 'center', padding: 32 },
  emptyText: { textAlign: 'center' },
  screen: { flex: 1 }
})
