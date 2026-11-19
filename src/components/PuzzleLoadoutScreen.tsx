import { FadingScrollView } from '@rific/auto-paper'
import { Button } from '@rific/feedback-press'
import { router, useIsFocused } from 'expo-router'
import { JSX, type ReactNode, useCallback, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text, useTheme } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { JUMBLE_GAME_ID, type PuzzleGameId, WORD_SEARCH_GAME_ID } from '@/constants/games'
import { actionType, titleType } from '@/constants/typography'
import { useCatalogActions, useCatalogVersions } from '@/hooks/useCatalog'
import { usePackSelection } from '@/hooks/usePackSelection'
import { usePuzzleDefaults } from '@/hooks/usePuzzleDefaults'
import { usePuzzleOptions } from '@/hooks/usePuzzleOptions'
import { usePuzzleUnlocks } from '@/hooks/usePuzzleUnlocks'
import { describeCryptogram } from '@/utils/cryptogram'
import { describeJumble } from '@/utils/jumble'
import { puzzleGameHref } from '@/utils/navigation'
import { type CryptogramOptions, type JumbleOptions, PUZZLE_GAME_SETUP, type WordSearchOptions } from '@/utils/puzzleOptions'
import { describeWordSearch } from '@/utils/wordSearch'

import { isPlayerPickerOpen, PacksCard, PlayerRow, useSelectedPacks } from './LoadoutScreen'
import { CORNER_BAND_HEIGHT, LoadoutPressAway, LoadoutShell, useLoadoutPopoverHost } from './LoadoutShell'
import { PacksScreen, type PacksScreenHandle } from './PacksScreen'
import { PuzzleSettingPicker } from './PillPicker'
import { PuzzleGameArt } from './PuzzleArt'

const GUTTER = 16
const GAP = 20
// A small picture of the game: the settings are what this page is for.
const ART_WIDTH = 240
const ART_HEIGHT = 88
const SETTING_PICKER_PREFIX = 'loadout-setting-'

const describe = (game: PuzzleGameId, options: unknown): string => {
  if (game === WORD_SEARCH_GAME_ID) return describeWordSearch(options as WordSearchOptions)
  if (game === JUMBLE_GAME_ID) return describeJumble(options as JumbleOptions)
  return describeCryptogram(options as CryptogramOptions)
}

const isSettingOpen = (openId: string | null) => openId?.startsWith(SETTING_PICKER_PREFIX) ?? false

const GameTitle = ({ title }: { title: string }): JSX.Element => {
  const theme = useTheme()
  return (
    <View style={styles.title}>
      <Text variant='titleLarge' accessibilityRole='header' numberOfLines={1} style={[styles.titleText, { color: theme.colors.onSurface }, titleType]}>
        {title}
      </Text>
    </View>
  )
}

// A group lifted over the page's tap catcher while a popover it holds is open, so the popover takes its
// own taps (zIndex only orders one parent's children).
const Group = ({ lifted, children }: { lifted: boolean; children: ReactNode }): JSX.Element => <View style={[styles.group, lifted && styles.lifted]}>{children}</View>

const PuzzleLoadoutPage = ({ game, onOpenPacks, coveredPacks }: { game: PuzzleGameId; onOpenPacks: () => void; coveredPacks: ReturnType<typeof useSelectedPacks> }): JSX.Element => {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const host = useLoadoutPopoverHost()
  const { options, setOption } = usePuzzleOptions(game)
  const { selectedPacks, manifest, totalUnlocked, totalAvailable, overallProgress } = coveredPacks
  const values = options as unknown as Record<string, string>
  const padding = { paddingTop: insets.top + CORNER_BAND_HEIGHT + GAP / 2, paddingBottom: insets.bottom + GAP / 2 }

  return (
    <FadingScrollView testID='loadout-page' style={styles.flex} fadeHeight={insets.top + CORNER_BAND_HEIGHT} contentContainerStyle={[styles.page, padding]} alwaysBounceVertical={false} showsVerticalScrollIndicator={false}>
      <LoadoutPressAway style={styles.pressAway} />
      <Group lifted={isPlayerPickerOpen(host.openId)}>
        <PlayerRow />
      </Group>
      <PuzzleGameArt game={game} width={ART_WIDTH} height={ART_HEIGHT} />
      <Group lifted={isSettingOpen(host.openId)}>
        <View testID='puzzle-settings' style={[styles.pickers, isSettingOpen(host.openId) && styles.lifted]}>
          {PUZZLE_GAME_SETUP[game].settings.map((setting) => (
            <PuzzleSettingPicker key={setting.key} id={`${SETTING_PICKER_PREFIX}${setting.key}`} host={host} setting={setting} value={values[setting.key]} onChange={setOption} />
          ))}
        </View>
        <View style={styles.summaryRow}>
          <Text testID='puzzle-summary' variant='bodySmall' style={[styles.summary, { color: theme.colors.onSurfaceVariant }]}>
            {describe(game, options)}
          </Text>
        </View>
      </Group>
      <PacksCard packs={selectedPacks} total={manifest.length} progress={overallProgress} unlocked={totalUnlocked} available={totalAvailable} onPress={onOpenPacks} />
      <Button mode='contained' icon='play' onPress={() => router.push(puzzleGameHref(game))} disabled={selectedPacks.length === 0} accessibilityHint='Starts a new puzzle' style={styles.ready} contentStyle={styles.readyContent} labelStyle={actionType}>
        Ready
      </Button>
    </FadingScrollView>
  )
}

// A puzzle game's own setup screen, from its card on Home: its name, who's playing, a picture of the
// game, its settings (each player's own), the packs its puzzles come from and Ready.
export const PuzzleLoadoutScreen = ({ game }: { game: PuzzleGameId }): JSX.Element => {
  const focused = useIsFocused()
  const { selectedPackKeys, setSelectedPackKeys } = usePackSelection()
  const { mode, difficulty } = usePuzzleDefaults()
  const { packsVersion } = useCatalogVersions()
  const { refreshCustomPacks } = useCatalogActions()
  const { unlockMap } = usePuzzleUnlocks({ enabled: focused })
  const packs = useSelectedPacks(selectedPackKeys, unlockMap, packsVersion)
  const [packsVisible, setPacksVisible] = useState(false)
  const packsRef = useRef<PacksScreenHandle>(null)
  const hasPacks = packs.selectedPacks.length > 0
  const openPacks = useCallback(() => setPacksVisible(true), [])
  const closePacks = useCallback(() => setPacksVisible(false), [])
  // Choose Packs' own pages close first, and it stays open while no pack is selected.
  const closeOverlay = useCallback(() => {
    if (!packsVisible) return false
    if (!packsRef.current?.closeTopOverlay() && hasPacks) setPacksVisible(false)
    return true
  }, [packsVisible, hasPacks])

  return (
    <LoadoutShell closeOverlay={closeOverlay} closeAllOverlays={closePacks} centerAction={<GameTitle title={PUZZLE_GAME_SETUP[game].title} />} overlays={<PacksScreen ref={packsRef} visible={packsVisible} onDismiss={closePacks} selectedKeys={selectedPackKeys} onChangeSelectedKeys={setSelectedPackKeys} packsVersion={packsVersion} onPacksChanged={refreshCustomPacks} mode={mode} difficulty={difficulty} />}>
      <PuzzleLoadoutPage game={game} onOpenPacks={openPacks} coveredPacks={packs} />
    </LoadoutShell>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { alignItems: 'center', alignSelf: 'stretch' },
  lifted: { zIndex: 2 },
  page: { alignItems: 'center', flexGrow: 1, gap: GAP, justifyContent: 'center', paddingHorizontal: GUTTER },
  pickers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  pressAway: { zIndex: 1 },
  ready: { alignSelf: 'stretch' },
  readyContent: { height: 48 },
  summary: { flex: 1, textAlign: 'center' },
  summaryRow: { alignItems: 'center', alignSelf: 'stretch', flexDirection: 'row', gap: 8, marginTop: 4 },
  title: { height: 48, justifyContent: 'center', maxWidth: 240 },
  titleText: { fontWeight: '700' }
})
