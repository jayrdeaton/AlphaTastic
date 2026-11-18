import type { GamePreviewProps, GuidelessGameDefinition } from '@tastic/shell'
import { JSX } from 'react'
import { StyleSheet, View } from 'react-native'
import { Portal } from 'react-native-paper'

import { WordSearchArt } from '@/components/WordSearchGrid'
import { WordSearchScreen } from '@/components/WordSearchScreen'
import { WORD_SEARCH_GAME_ID } from '@/constants/games'

import { OWN_LOADOUT } from './ownLoadout'

const PREVIEW_ROWS = 5

// Its own Portal host keeps the fireworks and the solved card with this screen.
const WordSearchPlayScreen = (): JSX.Element => (
  <Portal.Host>
    <WordSearchScreen />
  </Portal.Host>
)

// Home's card: the top of a sample grid, with words already found.
const WordSearchPreview = ({ width, height }: GamePreviewProps): JSX.Element => (
  <View style={[styles.preview, { width, height }]}>
    <WordSearchArt rows={PREVIEW_ROWS} cellSize={Math.floor(height / PREVIEW_ROWS)} />
  </View>
)

// Nothing of its own on the Stats tab yet: the prototype doesn't record rounds.
const NoStats = (): null => null

export const wordSearch: GuidelessGameDefinition = {
  id: WORD_SEARCH_GAME_ID,
  title: 'Word Search',
  blurb: 'Find every word hidden in a grid themed by your puzzle packs.',
  Preview: WordSearchPreview,
  reducers: {},
  useLoadout: OWN_LOADOUT,
  PlayScreen: WordSearchPlayScreen,
  keepStatusBar: true,
  StatsSections: NoStats
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', justifyContent: 'center' }
})
