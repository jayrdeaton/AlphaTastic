import { JSX } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'

import { CRYPTOGRAM_GAME_ID, JUMBLE_GAME_ID, type PuzzleGameId } from '@/constants/games'

import { SketchGlyph } from './SketchGlyph'
import { WordSearchArt } from './WordSearchGrid'

const WORD_SEARCH_ROWS = 5
const GAP = 4

// JUMBLE, half solved, with its last letters still in the pile.
const JumbleArt = ({ width, height }: { width: number; height: number }): JSX.Element => {
  const { colors } = useTheme()
  const size = Math.floor(Math.min((width - GAP * 5) / 6, (height - GAP * 4) / 2))
  const box = { width: size, height: size }
  return (
    <View style={styles.art}>
      <View style={styles.row}>
        {[...'JUM   '].map((letter, i) => (
          <View key={i} style={[styles.tile, box, letter === ' ' ? { borderColor: colors.outline } : { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            {letter === ' ' ? null : <SketchGlyph letter={letter} size={size - 4} color={colors.onSurface} />}
          </View>
        ))}
      </View>
      <View style={styles.row}>
        {[...'ELB'].map((letter) => (
          <View key={letter} style={[styles.tile, styles.pileTile, box, { backgroundColor: colors.primaryContainer }]}>
            <SketchGlyph letter={letter} size={size - 4} color={colors.onPrimaryContainer} />
          </View>
        ))}
      </View>
    </View>
  )
}

const CODE: [string, string | null][] = [
  ['Q', 'S'],
  ['B', 'E'],
  ['J', null],
  ['H', 'R'],
  ['B', 'E'],
  ['K', null]
]

// SECRET in code, partly cracked.
const CryptogramArt = ({ width, height }: { width: number; height: number }): JSX.Element => {
  const { colors } = useTheme()
  const size = Math.floor(Math.min((width - GAP * 5) / 6, height / 1.7))
  return (
    <View style={[styles.row, styles.art]}>
      {CODE.map(([cipher, guess], i) => (
        <View key={i} style={[styles.code, { width: size }, cipher === 'J' && { backgroundColor: colors.primaryContainer }]}>
          <View style={[styles.guess, { width: size, height: size, borderBottomColor: colors.outline }]}>{guess ? <SketchGlyph letter={guess} size={size} color={colors.onSurface} /> : null}</View>
          <Text style={{ color: colors.onSurfaceVariant, fontSize: Math.max(9, size * 0.36), lineHeight: Math.max(11, size * 0.46) }}>{cipher}</Text>
        </View>
      ))}
    </View>
  )
}

type PuzzleArtProps = { game: PuzzleGameId; width: number; height: number }

const Art = ({ game, width, height }: PuzzleArtProps): JSX.Element => {
  if (game === JUMBLE_GAME_ID) return <JumbleArt width={width} height={height} />
  if (game === CRYPTOGRAM_GAME_ID) return <CryptogramArt width={width} height={height} />
  return <WordSearchArt rows={WORD_SEARCH_ROWS} cellSize={Math.floor(height / WORD_SEARCH_ROWS)} />
}

// The small picture of each puzzle game, on its card on Home and its setup screen.
export const PuzzleGameArt = ({ game, width, height }: PuzzleArtProps): JSX.Element => (
  <View testID={`${game}-art`} accessibilityElementsHidden importantForAccessibility='no-hide-descendants' style={[styles.frame, { width, height }]}>
    <Art game={game} width={width} height={height} />
  </View>
)

const styles = StyleSheet.create({
  art: { alignItems: 'center', gap: GAP },
  code: { alignItems: 'center', borderRadius: 4 },
  frame: { alignItems: 'center', justifyContent: 'center' },
  guess: { alignItems: 'center', borderBottomWidth: 1, justifyContent: 'center' },
  pileTile: { borderWidth: 0 },
  row: { flexDirection: 'row', gap: GAP, justifyContent: 'center' },
  tile: { alignItems: 'center', borderRadius: 6, borderWidth: 1.5, justifyContent: 'center' }
})
