import { resolveSeedColor, useThemeSettings } from '@rific/auto-paper'
import { useKeepAwake } from '@rific/core'
import { type GamePreviewProps, type GuidelessGameDefinition } from '@tastic/shell'
import { useLocalSearchParams } from 'expo-router'
import { JSX, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useTheme } from 'react-native-paper'

import { GameScreen } from '@/components/GameScreen'
import { GameVisual } from '@/components/GameVisual'
import { HangmanStatsSections } from '@/components/HangmanStats'
import { HANGMAN_GAME_ID } from '@/constants/games'
import { usePuzzleDefaults } from '@/hooks/usePuzzleDefaults'
import { DEFAULT_MODE } from '@/modes/registry'
import { parsePlayMode } from '@/utils/navigation'

import { OWN_LOADOUT } from './ownLoadout'

// The board: `mode` is a player's own puzzle (solo) or a written word (pnp), and `door` 'pnp' on a
// solo board is the table's turns from the packs (see gameHref). Keyed on both: a share link can pop
// back to a written word's board in place, and a changed `mode` param has to give a fresh screen.
const HangmanPlayScreen = (): JSX.Element => {
  const params = useLocalSearchParams<{ mode?: string; door?: string }>()
  const mode = parsePlayMode(params.mode)
  const door = params.door === undefined ? mode : parsePlayMode(params.door)
  useKeepAwake('game')
  return <GameScreen key={`${mode}:${door}`} mode={mode} door={door} />
}

// Home's card: the active player's art, fully drawn, in their colors.
const HangmanPreview = ({ width, height }: GamePreviewProps): JSX.Element => {
  const theme = useTheme()
  const { settings } = useThemeSettings()
  const { mode } = usePuzzleDefaults()
  // Letters Only has no drawing to show.
  const art = mode.hasVisual === false ? DEFAULT_MODE : mode
  const colors = useMemo(() => [theme.colors.primary, theme.colors.secondary, theme.colors.tertiary], [theme.colors.primary, theme.colors.secondary, theme.colors.tertiary])
  return (
    <View style={[styles.preview, { width, height }]}>
      <GameVisual mode={art} mistakes={art.maxMistakes} color={resolveSeedColor(settings.color)} colors={colors} started style={{ width: height, height }} />
    </View>
  )
}

export const hangman: GuidelessGameDefinition = {
  id: HANGMAN_GAME_ID,
  title: 'Hangman',
  blurb: 'Guess the word before the drawing is finished.',
  Preview: HangmanPreview,
  reducers: {},
  useLoadout: OWN_LOADOUT,
  PlayScreen: HangmanPlayScreen,
  // The round is saved on every guess, so a cold launch comes back to the board.
  resumable: true,
  keepStatusBar: true,
  StatsSections: HangmanStatsSections
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', justifyContent: 'center' }
})
