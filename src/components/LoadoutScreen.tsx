import { FadingScrollView } from '@rific/auto-paper'
import { Button, IconButton, Pressable, type PressableProps, SegmentedButtons, Switch } from '@rific/feedback-press'
import { ConfirmDialog, WELL_SHADOW } from '@tastic/hud/chrome'
import { type Profile } from '@tastic/profile'
import { router, useIsFocused } from 'expo-router'
import { JSX, memo, type ReactNode, type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, type LayoutChangeEvent, Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native'
import { Avatar, Icon, ProgressBar, Text, useTheme } from 'react-native-paper'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector, useStore } from 'react-redux'

import { REFLOW_EASING, REFLOW_MS, SOURCE_FADE_MS } from '@/constants/loadoutMotion'
import { actionType, labelType } from '@/constants/typography'
import { useActivePlayer } from '@/hooks/useActivePlayer'
import { useAutoSaveCustom } from '@/hooks/useAutoSaveCustom'
import { useCatalogActions, useCatalogVersions } from '@/hooks/useCatalog'
import { useEasedValue } from '@/hooks/useEasedValue'
import { usePackSelection } from '@/hooks/usePackSelection'
import { usePlayerData } from '@/hooks/usePlayerData'
import { selectProfile, useActiveProfile, useProfiles, useProfilesActions } from '@/hooks/useProfiles'
import { usePuzzleDefaults } from '@/hooks/usePuzzleDefaults'
import { usePuzzleUnlocks } from '@/hooks/usePuzzleUnlocks'
import { useSelectArt } from '@/hooks/useSelectArt'
import { useStartSolo } from '@/hooks/useStartSolo'
import type { DifficultyFilter } from '@/redux/playerSettingsSlice'
import { roundActions, selectSoloRound } from '@/redux/roundSlice'
import type { RootState } from '@/redux/store'
import type { GameMode } from '@/types/gameModes'
import type { GameStartPayload } from '@/types/gameSession'
import { alert } from '@/utils/alert'
import { commaString } from '@/utils/commaString'
import { isCustomPackKey } from '@/utils/customPacks'
import { gameHref } from '@/utils/navigation'
import { packGroupColors, packGroupIcon, packGroupLabel } from '@/utils/packGroupStyle'
import { packNamesBudget, summarizePackNames } from '@/utils/packSummary'
import { getPackTurnPlan, getSeatPlayer, getSeatPlayerKey } from '@/utils/packTurns'
import { GUEST_PLAYER_KEY, playerKeyFor } from '@/utils/players'
import { getFocusedSeat, getSeatIdentity, getStanding, guestName, hasStandings, MAX_PNP_PLAYERS, type WordSource } from '@/utils/pnpSession'
import { getPuzzleManifest, type PuzzleManifestItem } from '@/utils/puzzleCatalog'
import { resolvePuzzle } from '@/utils/puzzlePicker'
import { getPnpRemovalLoss, isRoundPlayable } from '@/utils/roundState'
import { getManifestUnlockProgress } from '@/utils/unlocks'

import { ArtRow } from './ArtRow'
import { CORNER_BAND_HEIGHT, LoadoutPressAway, LoadoutShell, useLoadoutCovered, useLoadoutMotion, useLoadoutPopoverHost } from './LoadoutShell'
import { PacksScreen, type PacksScreenHandle } from './PacksScreen'
import { DifficultyPicker } from './PillPicker'
import { PLAYER_PICKER_ID_PREFIX, PlayerPicker } from './PlayerPicker'
import { isSeatPickerOpen, SeatsRow } from './SeatsRow'

// The Difficulty picker's popover id on the page's popover host, beside the players' pickers.
export const DIFFICULTY_PICKER_ID = 'loadout-difficulty'
const PLAYER_PICKER_ID = `${PLAYER_PICKER_ID_PREFIX}-profile`

// The packs card's names line: two lines of it at most, across the card inside the page's gutters
// (the game's 480pt column on the web), its padding, the icon and the chevron.
const PACK_NAMES_LINES = 2
const PACK_NAMES_INSET = 2 * 16 + 2 * 16 + 40 + 12 + 24 + 12
const MAX_PAGE_WIDTH = 480
// The names are the card's title, in the pills' lettering (labelType: the sketch font's heavier pen, in
// capitals): its capitals average about 0.62 of the type's size with the spaces between words, counted
// a little wide, as packNamesBudget's own default is.
const TITLE_CHAR_WIDTH = 0.66 * (labelType.fontSize ?? 14)

// The packs card's bar shows from 1% (Jay, 2026-10-18), where its fill starts to show.
const MIN_SHOWN_PROGRESS = 0.01

// One of the page's cards (the packs card, Keep Each Word): a raised, rounded surface in `color`, the
// whole of it one press. Drawn here rather than with Paper's Card, whose press area is only as tall as
// its content, so a card stretched to fill the word sources' cell (`fill`, see SourceSwap) would have
// had a band at each edge that took no taps.
type PageCardProps = Omit<PressableProps, 'children' | 'style'> & { color: string; fill: boolean; children: ReactNode }
const PageCard = ({ color, fill, children, ...props }: PageCardProps): JSX.Element => {
  const theme = useTheme()
  return (
    <Pressable {...props} style={[styles.card, styles.cardSurface, { backgroundColor: color, borderRadius: 3 * theme.roundness }, fill && styles.cardFill]}>
      <View style={[styles.cardContent, fill && styles.cardFill]}>{children}</View>
    </Pressable>
  )
}

type PacksCardProps = {
  // The selected packs, in Choose Packs' order (the player's own packs first).
  packs: PuzzleManifestItem[]
  total: number
  // How much of the selected packs the player has unlocked, 0 to 1, for the bar.
  progress: number
  // The same, in puzzles, for a screen reader.
  unlocked: number
  available: number
  onPress: () => void
  // Fills its parent's height (the word sources' cell).
  fill?: boolean
}

// Which packs the focused player's puzzles come from. One card in Hangman's card language (the pack
// rows' tinted card and icon badge), opening Choose Packs (58 packs are too many for a popover): "12 of
// 58 packs" over the selected packs' names in one line, cut short with how many more there are
// (summarizePackNames), so it never runs long, then a bar of how much of them is unlocked. Every pack
// is just "All 58 packs", since new packs join it too; none says why Ready is off. Its badge and tint
// are a list's, unless every pack selected is of one category (one pack, or Brands & Products and
// Companies, both Business): then they're that category's, the way its rows in Choose Packs look (a
// custom pack's category is Custom, as PackRow has it).
export const PacksCard = memo(({ packs, total, progress, unlocked, available, onPress, fill = false }: PacksCardProps): JSX.Element => {
  const theme = useTheme()
  const { width } = useWindowDimensions()
  const selected = packs.length
  const all = selected === total
  // The packs themselves are the headline, the count the detail (Jay, 2026-10-18): "Brands & Products
  // and Companies" over "2 of 58 packs".
  const names = useMemo(() => packs.map((item) => item.label), [packs])
  // With every pack, the whole set is the list.
  const some = !all && selected > 0
  const title = all ? `All ${commaString(total)} packs` : selected === 0 ? 'No packs' : summarizePackNames(names, packNamesBudget(Math.min(width, MAX_PAGE_WIDTH) - PACK_NAMES_INSET, PACK_NAMES_LINES, TITLE_CHAR_WIDTH))
  const detail = all ? 'Every pack, new ones included' : selected === 0 ? 'Choose at least one pack to play.' : `${commaString(selected)} of ${commaString(total)} packs`
  // A screen reader hears the count first, then which packs.
  const spoken = selected === 0 ? `${title}. ${detail}` : some ? `${detail}. ${title}. ${commaString(unlocked)} of ${commaString(available)} puzzles unlocked` : `${title}. ${detail}. ${commaString(unlocked)} of ${commaString(available)} puzzles unlocked`
  // The one category every selected pack is of (undefined is Custom's), when they share one.
  const oneCategory = !all && selected > 0 && new Set(packs.map((item) => packGroupLabel(item.group))).size === 1
  const group = oneCategory ? packs[0].group : undefined
  const look = useMemo(() => (oneCategory ? { icon: packGroupIcon(group), ...packGroupColors(group, theme) } : { icon: 'format-list-checks', color: theme.colors.tertiary, onColor: theme.colors.onTertiary, container: theme.colors.tertiaryContainer, onContainer: theme.colors.onTertiaryContainer }), [oneCategory, group, theme])
  // The whole card is the one button, the count first, then which packs.
  return (
    <PageCard testID='packs-card' color={look.container} onPress={onPress} fill={fill} accessibilityRole='button' accessibilityLabel={spoken} accessibilityHint='Opens Choose Packs'>
      <Avatar.Icon size={40} icon={look.icon} color={look.onColor} style={{ backgroundColor: look.color }} testID='packs-card-badge' />
      <View style={styles.cardText}>
        <Text variant='titleMedium' style={[labelType, { color: look.onContainer }]}>
          {title}
        </Text>
        <Text variant='bodyMedium' style={[styles.cardDetail, { color: look.onContainer }]}>
          {detail}
        </Text>
        {/* Only once its fill can be seen: an empty track reads like a broken slider, and a few puzzles
                of every pack's 19,643 would still draw one. */}
        {selected > 0 && progress >= MIN_SHOWN_PROGRESS ? (
          <View style={styles.progressWrapper}>
            <ProgressBar progress={progress} color={look.color} style={[styles.progressBar, { backgroundColor: theme.colors.surface }]} />
          </View>
        ) : null}
      </View>
      <Icon source='chevron-right' size={24} color={look.onContainer} />
    </PageCard>
  )
})
PacksCard.displayName = 'PacksCard'

// Whether each written word is kept (useAutoSaveCustom: the Pass & Play pack), for a table writing its
// own words: a card like the packs card, in the secondary colors, the whole card switching it as well
// as its switch.
const KeepWordsCard = memo(({ value, onChange, fill = false }: { value: boolean; onChange: (value: boolean) => void; fill?: boolean }): JSX.Element => {
  const theme = useTheme()
  const toggle = useCallback(() => onChange(!value), [onChange, value])
  return (
    <PageCard testID='keep-words-card' color={theme.colors.secondaryContainer} onPress={toggle} fill={fill}>
      <Avatar.Icon size={40} icon='content-save-outline' color={theme.colors.onSecondary} style={{ backgroundColor: theme.colors.secondary }} />
      <View style={styles.cardText}>
        <Text variant='titleMedium' style={[labelType, { color: theme.colors.onSecondaryContainer }]}>
          Keep Each Word
        </Text>
        <Text variant='bodyMedium' style={[styles.cardDetail, { color: theme.colors.onSecondaryContainer }]}>
          Saves every word to your Pass & Play pack
        </Text>
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel='Keep each word' />
    </PageCard>
  )
})
KeepWordsCard.displayName = 'KeepWordsCard'

type SettingsRowProps = {
  difficulty: DifficultyFilter
  onChangeDifficulty: (value: DifficultyFilter) => void
  // Off while the table writes its own words, which have no difficulty to pick.
  showDifficulty: boolean
}

// The player's settings under their art: Difficulty, centered. While the table writes its own words,
// which have no difficulty, a line saying how that plays holds its place, so switching Packs and
// Write-In moves nothing (Jay, 2026-11-19: the row was the pill's 44pt one way and the reset button's
// 40 the other, and the reset went). Over what comes after it while Difficulty's popover is open, since
// it drops down over the packs card and Ready (zIndex only orders one parent's children).
const SettingsRow = memo(({ difficulty, onChangeDifficulty, showDifficulty }: SettingsRowProps): JSX.Element => {
  const host = useLoadoutPopoverHost()
  const theme = useTheme()
  return (
    <View testID='loadout-settings-row' style={[styles.settingsRow, isSettingOpen(host.openId) && styles.settingsRowOpen]}>
      {showDifficulty ? (
        <DifficultyPicker id={DIFFICULTY_PICKER_ID} host={host} value={difficulty} onChange={onChangeDifficulty} />
      ) : (
        <Text variant='bodyMedium' numberOfLines={2} style={[styles.writeNote, { color: theme.colors.onSurfaceVariant }]}>
          Players take turns writing words for each other.
        </Text>
      )}
    </View>
  )
})
SettingsRow.displayName = 'SettingsRow'

// The player's art, as a row of tiles (ArtRow), held still while the page is out of sight.
const PageArtRow = ({ selected, onSelect }: { selected: GameMode; onSelect: (mode: GameMode) => void }): JSX.Element => {
  const covered = useLoadoutCovered()
  return (
    <View style={styles.artRow}>
      <ArtRow selected={selected} onSelect={onSelect} paused={covered} />
    </View>
  )
}

// Single Player's one player, and their colors, first on the page (Jay, 2026-10-18): everything under
// it is theirs (their art, difficulty and packs), so picking another player switches the whole page.
// The active player's PlayerPicker, centered; a long name shrinks the pill rather than overflowing the
// gutters. Its guest is Player 1, the Pass & Play table's seat 1 (players.ts' SINGLE_PLAYER_SEAT_ID).
export const PlayerRow = memo((): JSX.Element => {
  const host = useLoadoutPopoverHost()
  const activeProfile = useActiveProfile()
  const { selectPlayer } = useProfilesActions()
  const handleSelect = useCallback((profile: Profile | null) => selectPlayer(profile?.id ?? null), [selectPlayer])
  return (
    <View style={styles.playerRow}>
      <PlayerPicker host={host} selectedId={activeProfile?.id ?? null} guestLabel={guestName(0)} onSelect={handleSelect} />
    </View>
  )
})
PlayerRow.displayName = 'PlayerRow'

type ChoiceOption = { value: string; label: string; icon: string }

// Two side by side, one picked (Paper's SegmentedButtons), in the primary colors Choose Packs' filter
// uses, raised off the board like the pills, its labels lettered like theirs (labelType). An open
// popover closes first.
const SegmentedChoice = memo(({ value, options, onChange, testID }: { value: string; options: readonly ChoiceOption[]; onChange: (value: string) => void; testID?: string }): JSX.Element => {
  const theme = useTheme()
  const { close } = useLoadoutPopoverHost()
  const buttons = useMemo(() => options.map((option) => ({ ...option, checkedColor: theme.colors.onPrimary, uncheckedColor: theme.colors.onPrimaryContainer, labelStyle: labelType, style: { backgroundColor: option.value === value ? theme.colors.primary : theme.colors.primaryContainer } })), [options, value, theme.colors.primary, theme.colors.onPrimary, theme.colors.primaryContainer, theme.colors.onPrimaryContainer])
  const handleChange = useCallback(
    (next: string | string[]) => {
      close()
      if (typeof next === 'string') onChange(next)
    },
    [close, onChange]
  )
  return <SegmentedButtons testID={testID} value={value} onValueChange={handleChange} buttons={buttons} style={styles.segmented} />
})
SegmentedChoice.displayName = 'SegmentedChoice'

// Add player (Jay, 2026-10-18): in the corners' strip, centered between Home
// and the cog, in their plain-glyph look (the same ink, size and slop), so it stays under the same
// point however many seats are added, for adding several in a row. Dimmed and off at eight. An open
// popover closes first, as it does for the cog, so none is left hanging over the new seat.
const AddPlayerButton = memo(({ disabled, onAdd }: { disabled: boolean; onAdd: () => void }): JSX.Element => {
  const theme = useTheme()
  const { close } = useLoadoutPopoverHost()
  const handlePress = useCallback(() => {
    close()
    onAdd()
  }, [close, onAdd])
  return <IconButton icon='account-plus' iconColor={theme.colors.onSurface} size={24} onPress={handlePress} disabled={disabled} hitSlop={4} accessibilityLabel='Add player' />
})
AddPlayerButton.displayName = 'AddPlayerButton'

// Where the table's words come from (Jay, 2026-10-18): the packs, each player's own, taking turns,
// or the players write them for each other, which takes two. Both labels fit a 360pt phone.
const SOURCE_OPTIONS: ChoiceOption[] = [
  { value: 'packs', label: 'Packs', icon: 'cards-outline' },
  { value: 'write', label: 'Write-In', icon: 'pencil-outline' }
]

// The room between the blocks, and around the page.
const BLOCK_GAP = 20
const PAGE_PADDING = 8
const PAGE_GUTTER = 16

export const isPlayerPickerOpen = (openId: string | null) => openId === PLAYER_PICKER_ID || isSeatPickerOpen(openId)
const isSettingOpen = (openId: string | null) => openId === DIFFICULTY_PICKER_ID

// A view's height, read before the first paint where the platform lets a layout effect read it: the
// web's DOM, and React Native's new architecture, whose views are DOM-like elements. So the page, laid
// out from measured heights, is right from its first frame (onLayout comes after the paint, which
// shifted the whole page a few frames in). Read as the page mounts; every later change comes through
// onLayout.
// Where nothing can be read (Jest), onLayout brings the first one too.
const useHeightBeforePaint = (ref: RefObject<View | null>, onHeight: (height: number) => void): void => {
  useLayoutEffect(() => {
    const height = (ref.current as unknown as { getBoundingClientRect?: () => { height: number } } | null)?.getBoundingClientRect?.().height
    if (height) onHeight(Math.round(height))
  }, [ref, onHeight])
}

// A block of the page: the players, or everything from the settings down to Ready. Lifted over the
// press away catcher (and everything after it) while one of the popovers it holds is open, so the
// popover's rows take their own taps. Lifting the whole group is what does it: on native, zIndex only
// orders the children of one parent, and the catcher is the page's.
//
// Its height eases to a new one (a row of seats more or less, a line more or less in the packs card)
// rather than jumping (Jay, 2026-10-18), so the centered page glides. The content inside is laid out at
// its new height at once (what's measured); only the group's own box eases. The first height lands as
// is. The lower group hangs from its foot (`end`).
type PageGroupProps = {
  testID: string
  lift: (openId: string | null) => boolean
  end?: boolean
  children: ReactNode
}
const PageGroup = ({ testID, lift, end = false, children }: PageGroupProps): JSX.Element => {
  const { openId } = useLoadoutPopoverHost()
  const motion = useLoadoutMotion()
  const [height, setHeight] = useState(0)
  const contentRef = useRef<View>(null)
  useHeightBeforePaint(contentRef, setHeight)
  const handleLayout = useCallback((event: LayoutChangeEvent) => setHeight(Math.round(event.nativeEvent.layout.height)), [])
  const eased = useEasedValue(height, motion && height > 0, REFLOW_MS, REFLOW_EASING)
  // Its own height until the first measurement lands.
  const easedStyle = useAnimatedStyle(() => (eased.value > 0 ? { height: eased.value } : {}))
  return (
    <Animated.View pointerEvents='box-none' style={[styles.groupBox, end && styles.groupBoxEnd, easedStyle, lift(openId) && styles.lifted]}>
      <View ref={contentRef} testID={testID} onLayout={handleLayout} pointerEvents='box-none' style={styles.group}>
        {children}
      </View>
    </Animated.View>
  )
}

// The card each word source shows under the choice and the settings row (Jay, 2026-10-18): both always
// mounted, laid over each other in one cell, the chosen one over the other, cross-fading on a switch.
// The one not chosen is invisible, untouchable and out of a screen reader's way (on the web also out of
// the keyboard's, once it has faded: CSS's visibility, which a transition holds back until the fade is
// over).
//
// The cell is as tall as the taller card, and both cards fill it (their `fill`), so a switch moves
// nothing on the page (Jay, 2026-11-19: it used to keep only the chosen card's height, and the centered
// page shifted by half the difference). A table of one only ever plays from the packs, so it has no
// Write-In card to make room for.
type SourceSwapProps = {
  source: WordSource
  choice: ReactNode
  packs: ReactNode
  write: ReactNode | null
}
const SourceSwap = ({ source, choice, packs, write }: SourceSwapProps): JSX.Element => {
  const motion = useLoadoutMotion()
  const onPacks = source === 'packs'
  const shown = useSharedValue(onPacks ? 1 : 0)
  const fadedBefore = useRef(false)
  useEffect(() => {
    const target = onPacks ? 1 : 0
    shown.value = motion && fadedBefore.current ? withTiming(target, { duration: SOURCE_FADE_MS }) : target
    fadedBefore.current = motion
  }, [shown, onPacks, motion])
  const packsStyle = useAnimatedStyle(() => ({ opacity: shown.value }))
  const writeStyle = useAnimatedStyle(() => ({ opacity: 1 - shown.value }))
  const hideAfterMs = motion ? SOURCE_FADE_MS : 0
  return (
    <>
      {choice}
      <View pointerEvents='box-none' style={styles.swap}>
        <Animated.View testID='loadout-packs-options' pointerEvents={onPacks ? 'auto' : 'none'} aria-hidden={!onPacks} style={[styles.swapLayer, packsStyle, swapLayerState(onPacks, hideAfterMs)]}>
          {packs}
        </Animated.View>
        {write ? (
          <Animated.View testID='loadout-write-options' pointerEvents={onPacks ? 'none' : 'auto'} aria-hidden={onPacks} style={[styles.swapLayer, styles.swapLayerOver, writeStyle, swapLayerState(!onPacks, hideAfterMs)]}>
            {write}
          </Animated.View>
        ) : null}
      </View>
    </>
  )
}

// The chosen layer over the other (its taps come first), and on the web the other out of sight once
// its fade is over.
const swapLayerState = (chosen: boolean, hideAfterMs: number): ViewStyle => {
  if (Platform.OS !== 'web') return chosen ? styles.swapLayerChosen : {}
  const visibility = chosen ? { visibility: 'visible' } : { visibility: 'hidden', transitionDelay: `${hideAfterMs}ms`, transitionProperty: 'visibility' }
  return { ...(chosen ? styles.swapLayerChosen : {}), ...(visibility as unknown as ViewStyle) }
}

// What the remove confirm says a player leaving would take with them (see getPnpRemovalLoss).
const removalMessage = ({ standing, word }: { standing: boolean; word: boolean }): string => [standing ? 'Their standing this session goes with them.' : '', word ? 'The word waiting on the board goes too.' : ''].filter(Boolean).join(' ')

// What New session's confirm says it clears.
const newSessionMessage = (standings: boolean, word: boolean): string => [standings ? "Everyone's standing starts over." : '', word ? 'The word waiting on the board goes too.' : ''].filter(Boolean).join(' ')

// Who a seat's switch would hand its standing to, for the confirm.
type PendingSwitch = { id: string; profile: Profile | null; title: string; message: string }

// The packs a setup page counts: every one with puzzles, the player's selected ones in Choose Packs'
// order (the player's own packs, then the built-in ones), and how much of those is unlocked.
// packsVersion is a change counter bumped whenever a custom pack is created, edited, deleted or
// imported, since getPuzzleManifest() otherwise looks pure to React.
export const useSelectedPacks = (selectedPackKeys: string[], unlockMap: ReturnType<typeof usePuzzleUnlocks>['unlockMap'], packsVersion: number) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- packsVersion is an intentional external invalidation trigger, not a value the memo body reads
  const manifest = useMemo(() => getPuzzleManifest().filter((item) => item.count > 0), [packsVersion])
  const selectedPacks = useMemo(() => {
    const selectedSet = new Set(selectedPackKeys)
    const selected = manifest.filter((item) => selectedSet.has(item.key))
    return [...selected.filter((item) => isCustomPackKey(item.key)), ...selected.filter((item) => !isCustomPackKey(item.key))]
  }, [manifest, selectedPackKeys])
  const progress = useMemo(() => getManifestUnlockProgress(selectedPacks, unlockMap), [selectedPacks, unlockMap])
  return { manifest, selectedPacks, ...progress }
}

// Hangman's setup page, /loadout/hangman (Jay, 2026-11-19: one page, where 1 Player and Pass & Play
// were two). It's always the table (roundSlice's pnp.session, one to eight seats), and how many sit
// at it decides how it plays: one player plays their own puzzles from their packs (what was 1 Player,
// picking a puzzle from a pack included); two or more take turns from the packs, or write words for
// each other (Packs | Write-In, shown once there are two).
//
// The page is one player's at a time: the focused seat's (ringed once there are two), the active player
// whenever the page is shown and whenever another seat is focused (a press on its pill; a press on the
// focused pill opens its picker), so the art, difficulty and packs card are theirs, as are the colors,
// their unlocked puzzles and their waiting round. Every guest seat is a player of its own
// (utils/players.ts' guestSeatKey), starting on colors no other seat is showing; seat 1's guest is the
// device's guest.
//
// Ready plays: one player on the packs picks up their own waiting round or draws them one from their
// packs, difficulty and art (so it never has a round to abandon); two or more go back to the pack turn
// under way or start the next one, the fair pick, whose player plays their own round the same way (see
// utils/packTurns.ts); writing goes back to the session under way (a round played, a word handed off or
// half typed) or starts one, the first seat writing. The page is one group centered under the corners,
// and scrolls only once it outgrows the room.
export const LoadoutScreen = (): JSX.Element => {
  const dispatch = useDispatch()
  const store = useStore<RootState>()
  const insets = useSafeAreaInsets()
  const { selectPlayer } = useProfilesActions()
  const { forgetGuestSeat, colorGuestSeats } = usePlayerData()
  const isFocused = useIsFocused()
  const session = useSelector((state: RootState) => state.round.pnp.session)
  const { players, standings, source } = session
  // A table of one plays their own puzzles, as 1 Player did.
  const single = players.length === 1
  const focusedSeat = getFocusedSeat(session)
  const sessionStarted = hasStandings(session)
  // The roster, for the seats' names in the confirms.
  const profiles = useProfiles()

  // The focused player's own: their art, difficulty and packs, their unlocked puzzles and their waiting
  // solo round (they're the active player, see the focus effect below).
  const { key: playerKey } = useActivePlayer()
  const { selectedPackKeys, setSelectedPackKeys } = usePackSelection()
  const { mode, difficulty, setDifficulty } = usePuzzleDefaults()
  const selectArt = useSelectArt()
  const { packsVersion } = useCatalogVersions()
  const { refreshCustomPacks } = useCatalogActions()
  const { requestStart, abandonDialog } = useStartSolo()
  const { autoSave, setAutoSave } = useAutoSaveCustom()
  const resumable = useSelector((state: RootState) => isRoundPlayable(selectSoloRound(state.round, playerKey)))
  // A word waiting to come back to at the table: half typed, handed off, or mid-guess.
  const wordWaiting = useSelector((state: RootState) => {
    const { pnp } = state.round
    if (pnp.phase === 'authoring') return Boolean(pnp.draft?.answer.trim())
    return (pnp.phase === 'handoff' || pnp.phase === 'playing') && isRoundPlayable(pnp)
  })
  // Something for Ready to go back to when the players write, and for New session to clear.
  const sessionUnderWay = sessionStarted || wordWaiting
  // Read again whenever a win, an import or a reset moves the count, so the packs card's bar is current
  // and a new draw prefers a puzzle the player hasn't solved yet.
  const { unlockMap } = usePuzzleUnlocks()
  // Two or more on the packs: the pack turn Ready plays, the one under way or the next (the fair
  // pick). Two plain values, so the page only re-renders when one of them moves.
  const turnSeatId = useSelector((state: RootState) => getPackTurnPlan(state).seatId)
  const turnContinues = useSelector((state: RootState) => getPackTurnPlan(state).continues)

  const { manifest, selectedPacks, totalUnlocked, totalAvailable, overallProgress } = useSelectedPacks(selectedPackKeys, unlockMap, packsVersion)
  // Choose Packs' Clear can leave nothing to draw from (the packs card says so): a lone player's, or
  // the turn's player's while the page is theirs (anyone else's turn shows their page instead, see
  // playTurn).
  const readyDisabled = source === 'packs' && (single || turnSeatId === focusedSeat.id) && selectedPacks.length === 0 && !resumable

  const [packsScreenVisible, setPacksScreenVisible] = useState(false)
  // The seat whose removal is waiting on its confirm (with what it would take, read as Remove was
  // pressed), the one whose switch is, and New session's.
  const [removing, setRemoving] = useState<{ id: string; message: string } | null>(null)
  const [switching, setSwitching] = useState<PendingSwitch | null>(null)
  const [clearing, setClearing] = useState<string | null>(null)

  // The table's focused seat's player becomes the active one, unless they already are: its profile
  // while the roster has it, otherwise the seat's own guest (pnpSession's seatPlayer), each guest seat
  // a player of its own.
  const activateFocusedSeat = useCallback(() => {
    const state = store.getState()
    const player = getSeatPlayer(state, getFocusedSeat(state.round.pnp.session).id)
    const { profileId, seatId } = state.activePlayer
    if (player && playerKeyFor(profileId, seatId) !== playerKeyFor(player.profileId, player.seatId)) selectPlayer(player.profileId, player.seatId)
  }, [store, selectPlayer])

  // Every guest seat at the table is given colors of its own as it's first shown (a new seat, one
  // handed back to a guest, a table stored before guest seats had them): utils/guestSeats.ts.
  useEffect(() => {
    colorGuestSeats()
  }, [players, colorGuestSeats])

  // While the page is the one showing, its focused seat is the active player: every time it's shown,
  // whoever a game (the device is handed around) or a share link left playing, and
  // whenever who plays for the focused seat changes from outside the page (a seated profile forgotten
  // because another game deleted it leaves the seat its own guest's).
  //
  // A table of one is whoever is playing, though: a player picked on another game's setup page takes
  // the seat (a profile, or back to the seat's guest for a guest), as 1 Player's page showed them,
  // rather than the seat taking the page back.
  const seatActivePlayer = useCallback(() => {
    const state = store.getState()
    const { players: seats } = state.round.pnp.session
    if (seats.length !== 1) return
    const [seat] = seats
    const active = selectProfile(state, state.activePlayer.profileId)
    if (active && active.id !== seat.profileId) dispatch(roundActions.setPnpSeatProfile({ id: seat.id, profile: { id: active.id, name: active.name } }))
    else if (state.activePlayer.profileId === null && seat.profileId !== null) dispatch(roundActions.setPnpSeatProfile({ id: seat.id, profile: null }))
  }, [store, dispatch])
  const focusedSeatKey = useSelector((state: RootState) => getSeatPlayerKey(state, getFocusedSeat(state.round.pnp.session).id))
  useEffect(() => {
    if (!isFocused) return
    seatActivePlayer()
    activateFocusedSeat()
  }, [isFocused, focusedSeatKey, seatActivePlayer, activateFocusedSeat])

  // A press on a seat that isn't the focused one: theirs is the page now, and a screen reader hears
  // whose.
  const handleFocus = useCallback(
    (seatId: string) => {
      const state = store.getState()
      const { session: current } = state.round.pnp
      if (current.focusedId === seatId || !current.players.some((player) => player.id === seatId)) return
      dispatch(roundActions.focusPnpSeat(seatId))
      activateFocusedSeat()
      AccessibilityInfo.announceForAccessibility(`Showing ${getSeatIdentity(current.players, seatId, state.profiles).name}`)
    },
    [store, dispatch, activateFocusedSeat]
  )

  const handleAdd = useCallback(() => dispatch(roundActions.addPnpPlayer()), [dispatch])

  // A seat dragged into a new place (SeatsRow): everything kept by seat goes with it.
  const handleReorder = useCallback((seatIds: string[]) => dispatch(roundActions.reorderPnpPlayers(seatIds)), [dispatch])

  // Straight away when nothing goes with the player; a confirm first when their standing or a word
  // waiting for them would. From the focused seat's glyph or any seat swiped away (SeatsRow). The
  // focus moves on when it was theirs, and what the seat's own guest kept
  // (their art, colors, packs, waiting round and unlocked puzzles) goes with the seat.
  const removeSeat = useCallback(
    (seatId: string) => {
      dispatch(roundActions.removePnpPlayer(seatId))
      if (store.getState().round.pnp.session.players.some((player) => player.id === seatId)) return
      activateFocusedSeat()
      void forgetGuestSeat(seatId)
    },
    [dispatch, store, activateFocusedSeat, forgetGuestSeat]
  )
  const handleRemove = useCallback(
    (seatId: string) => {
      const loss = getPnpRemovalLoss(store.getState().round.pnp, seatId)
      if (loss.standing || loss.word) setRemoving({ id: seatId, message: removalMessage(loss) })
      else removeSeat(seatId)
    },
    [store, removeSeat]
  )
  const handleRemoveConfirm = useCallback(() => {
    if (removing) removeSeat(removing.id)
    setRemoving(null)
  }, [removeSeat, removing])
  const handleRemoveCancel = useCallback(() => setRemoving(null), [])

  // Who sits in a seat; the focused seat's new player is the active one at once.
  const seatProfile = useCallback(
    (seatId: string, profile: Profile | null) => {
      dispatch(roundActions.setPnpSeatProfile({ id: seatId, profile: profile ? { id: profile.id, name: profile.name } : null }))
      activateFocusedSeat()
    },
    [dispatch, activateFocusedSeat]
  )
  // A seat's picker: straight away when the seat hasn't played this session, and after a confirm when
  // it has, since its standing stays with the seat and goes on under whoever sits there now. Picking
  // who's already there changes nothing.
  const handlePick = useCallback(
    (seatId: string, profile: Profile | null) => {
      const state = store.getState()
      const { session: current } = state.round.pnp
      const index = current.players.findIndex((player) => player.id === seatId)
      const seat = current.players[index]
      if (!seat || (seat.profileId ?? null) === (profile?.id ?? null)) return
      const { played, wins } = getStanding(current, seatId)
      if (played === 0) {
        seatProfile(seatId, profile)
        return
      }
      const nextName = profile?.name ?? guestName(index)
      setSwitching({ id: seatId, profile, title: `Switch to ${nextName}?`, message: `${nextName} takes over ${getSeatIdentity(current.players, seatId, state.profiles).name}'s standing this session: ${wins} of ${played} solved.` })
    },
    [store, seatProfile]
  )
  const handleSwitchConfirm = useCallback(() => {
    if (switching) seatProfile(switching.id, switching.profile)
    setSwitching(null)
  }, [seatProfile, switching])
  const handleSwitchCancel = useCallback(() => setSwitching(null), [])

  // New session: the same table with every standing cleared and any word waiting dropped, after a
  // confirm saying which. Pass & Play keeps no record of how a session ends, only of rounds actually
  // finished, so nothing is recorded.
  const openNewSession = useCallback(() => setClearing(newSessionMessage(sessionStarted, wordWaiting)), [sessionStarted, wordWaiting])
  const handleNewSessionConfirm = useCallback(() => {
    dispatch(roundActions.startPnpSession())
    setClearing(null)
  }, [dispatch])
  const handleNewSessionCancel = useCallback(() => setClearing(null), [])

  const handleSource = useCallback((next: string) => dispatch(roundActions.setPnpSource(next === 'write' ? 'write' : 'packs')), [dispatch])

  // A lone player's own solo round (two or more play theirs by turns, see playTurn).
  const goToSoloGame = useCallback(() => router.push(gameHref('solo')), [])
  const startPuzzle = useCallback((payload: GameStartPayload) => requestStart(payload, { onStarted: goToSoloGame }), [requestStart, goToSoloGame])

  // The focused player's waiting round when there's one to go back to, otherwise a new draw from their
  // whole selection. A round with a guess on it is always playable until it's decided, so the draw never
  // replaces one: this never asks to abandon anything.
  const playOwnRound = useCallback(() => {
    if (resumable) {
      goToSoloGame()
      return
    }
    const result = resolvePuzzle({ sourceMode: 'random', difficulty, mode, customPhrase: '', customHint: '' }, selectedPackKeys, unlockMap)
    if (!result.ok) {
      void alert('No Puzzles Available', result.error)
      return
    }
    startPuzzle(result.payload)
  }, [resumable, goToSoloGame, difficulty, mode, selectedPackKeys, unlockMap, startPuzzle])

  // The table on the packs: the pack turn under way, or the next one (the fair pick), on the solo game
  // from this door (gameHref('solo', 'pnp')), which makes the turn's player the active one and puts
  // their own round on the board: their waiting one, or a fresh draw from their packs, difficulty and
  // art, so nothing is abandoned (see GameScreen's PackTurnRound). A turn whose player has nothing to
  // draw from (no pack selected, nothing waiting) and isn't the page's shows the page as theirs
  // instead, where the packs card says why and Ready is off.
  const playTurn = useCallback(() => {
    const state = store.getState()
    const { seatId, continues } = getPackTurnPlan(state)
    const playerKey = getSeatPlayerKey(state, seatId) ?? GUEST_PLAYER_KEY
    const packKeys = state.playerSettings[playerKey]?.packKeys ?? null
    const canDraw = packKeys === null ? manifest.length > 0 : manifest.some((item) => packKeys.includes(item.key))
    if (!canDraw && !isRoundPlayable(selectSoloRound(state.round, playerKey))) {
      if (state.round.pnp.session.focusedId === seatId) return
      dispatch(roundActions.focusPnpSeat(seatId))
      activateFocusedSeat()
      AccessibilityInfo.announceForAccessibility(`It's ${getSeatIdentity(state.round.pnp.session.players, seatId, state.profiles).name}'s turn. Choose at least one pack to play.`)
      return
    }
    if (!continues) dispatch(roundActions.startPackTurn())
    router.push(gameHref('solo', 'pnp'))
  }, [store, manifest, dispatch, activateFocusedSeat])

  // Ready, for whatever the page is set to play.
  const handleReady = useCallback(() => {
    // The players write: back to the session under way, or a new one, the first seat writing for the
    // fair pick.
    if (source === 'write') {
      if (!sessionUnderWay) dispatch(roundActions.startPnpSession())
      router.push(gameHref('pnp'))
      return
    }
    if (single) playOwnRound()
    else playTurn()
  }, [source, sessionUnderWay, dispatch, single, playTurn, playOwnRound])
  // Whose turn Ready plays, by the name the page shows them by.
  const turnName = turnSeatId ? getSeatIdentity(players, turnSeatId, profiles).name : ''
  const packsHint = single ? (resumable ? 'Continues your puzzle' : 'Starts a new puzzle') : turnContinues ? `Continues ${turnName}'s turn` : `Starts with ${turnName}`
  const readyHint = source === 'write' ? (sessionUnderWay ? 'Continues the session' : 'Starts a new session') : packsHint

  // Stable identities: Choose Packs is memoized and stays mounted.
  const openPacksScreen = useCallback(() => setPacksScreenVisible(true), [])
  const closePacksScreen = useCallback(() => setPacksScreenVisible(false), [])
  // A puzzle started from Choose Packs' pack browser (a pick, or Play This Pack) closes Choose Packs
  // too: the abandon confirm, when the waiting round has a guess on it, opens over the page itself, and
  // the page should be clear when the player comes back from the round.
  const startFromPacksScreen = useCallback(
    (payload: GameStartPayload) => {
      setPacksScreenVisible(false)
      startPuzzle(payload)
    },
    [startPuzzle]
  )

  // Read through a ref by closeOverlay, so the shell's back listener needs nothing new each time.
  const packsScreenRef = useRef<PacksScreenHandle>(null)
  // Choose Packs' own pack browser and editor sit above it, so they close first, and Choose Packs
  // itself stays open while no pack is selected (as its close glyph and Done do). The confirms answer
  // back themselves (each registers as it opens, so it runs first); this is the page's fallback.
  const hasPacks = selectedPacks.length > 0
  const closeOverlay = useCallback(() => {
    if (removing || switching || clearing !== null) {
      setRemoving(null)
      setSwitching(null)
      setClearing(null)
    } else if (packsScreenVisible) {
      if (!packsScreenRef.current?.closeTopOverlay() && hasPacks) setPacksScreenVisible(false)
    } else return false
    return true
  }, [removing, switching, clearing, packsScreenVisible, hasPacks])
  const closeAllOverlays = useCallback(() => {
    setPacksScreenVisible(false)
    setRemoving(null)
    setSwitching(null)
    setClearing(null)
  }, [])

  // The scroll view runs the screen's full height, under the corners and the home indicator, so the
  // page scrolls up under them and fades there (FadingScrollView, Stats' treatment, Jay 2026-10-18)
  // rather than being cut off at the corners' strip; at rest it starts below the corners and ends above
  // the home indicator. The fade is the strip's height, so whatever passes under Home and the cog has
  // faded away there and the glyphs stay clear.
  const pagePadding = useMemo(() => ({ paddingBottom: insets.bottom + PAGE_PADDING, paddingTop: insets.top + CORNER_BAND_HEIGHT + PAGE_PADDING }), [insets.bottom, insets.top])

  // The focused player's art, settings and packs card.
  const artRow = <PageArtRow selected={mode} onSelect={selectArt} />
  const settingsRow = <SettingsRow difficulty={difficulty} onChangeDifficulty={setDifficulty} showDifficulty={source === 'packs'} />
  const packsCard = <PacksCard packs={selectedPacks} total={manifest.length} progress={overallProgress} unlocked={totalUnlocked} available={totalAvailable} onPress={openPacksScreen} fill />

  return (
    <LoadoutShell
      closeOverlay={closeOverlay}
      closeAllOverlays={closeAllOverlays}
      centerAction={<AddPlayerButton disabled={players.length >= MAX_PNP_PLAYERS} onAdd={handleAdd} />}
      overlays={
        <>
          {/* With two or more the packs are only browsed: every puzzle comes by turns, from each player's
              own selection. */}
          <PacksScreen ref={packsScreenRef} visible={packsScreenVisible} onDismiss={closePacksScreen} selectedKeys={selectedPackKeys} onChangeSelectedKeys={setSelectedPackKeys} packsVersion={packsVersion} onPacksChanged={refreshCustomPacks} mode={mode} difficulty={difficulty} onConfirm={single ? startFromPacksScreen : undefined} />
          <ConfirmDialog visible={removing !== null} icon='account-remove-outline' title={`Remove ${removing ? getSeatIdentity(players, removing.id, profiles).name : ''}?`} message={removing?.message ?? ''} confirmLabel='Remove' cancelLabel='Cancel' onConfirm={handleRemoveConfirm} onCancel={handleRemoveCancel} destructive />
          <ConfirmDialog visible={switching !== null} icon='account-switch-outline' title={switching?.title ?? ''} message={switching?.message ?? ''} confirmLabel='Switch' cancelLabel='Cancel' onConfirm={handleSwitchConfirm} onCancel={handleSwitchCancel} />
          <ConfirmDialog visible={clearing !== null} icon='restore' title='New Session?' message={clearing ?? ''} confirmLabel='New Session' cancelLabel='Cancel' onConfirm={handleNewSessionConfirm} onCancel={handleNewSessionCancel} />
          {abandonDialog}
        </>
      }
    >
      <FadingScrollView testID='loadout-page' style={styles.flex} fadeHeight={insets.top + CORNER_BAND_HEIGHT} contentContainerStyle={[styles.page, pagePadding]} alwaysBounceVertical={false} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps='handled'>
        {/* First, under everything a tap should reach while a popover is open (the lifted group). */}
        <LoadoutPressAway style={styles.pressAway} />
        <PageGroup testID='loadout-players' lift={isPlayerPickerOpen}>
          <SeatsRow players={players} focusedId={focusedSeat.id} standings={standings} showStandings={sessionStarted} onFocus={handleFocus} onPick={handlePick} onRemove={handleRemove} onReorder={handleReorder} removingId={removing?.id ?? null} onNewSession={sessionUnderWay ? openNewSession : undefined} />
          {artRow}
        </PageGroup>
        <PageGroup testID='loadout-options' lift={isSettingOpen} end>
          <SourceSwap
            source={source}
            choice={
              <>
                {single ? null : (
                  <View style={styles.sourceChoice}>
                    <SegmentedChoice testID='word-source' value={source} options={SOURCE_OPTIONS} onChange={handleSource} />
                  </View>
                )}
                {settingsRow}
              </>
            }
            packs={packsCard}
            write={single ? null : <KeepWordsCard value={autoSave} onChange={setAutoSave} fill />}
          />
          {/* Off, rather than an alert after the tap, while there's nothing to draw from (the packs card
              says why). */}
          <Button mode='contained' icon='play' onPress={handleReady} disabled={readyDisabled} accessibilityHint={readyHint} style={styles.ready} contentStyle={styles.readyContent} labelStyle={actionType}>
            Ready
          </Button>
        </PageGroup>
      </FadingScrollView>
    </LoadoutShell>
  )
}

const styles = StyleSheet.create({
  artRow: { alignSelf: 'stretch', marginTop: BLOCK_GAP },
  card: { alignSelf: 'stretch', marginTop: BLOCK_GAP },
  // Paper's Card.Content's padding, which the cards had before they were drawn here (see PageCard).
  cardContent: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  cardDetail: { marginTop: 2, opacity: 0.85 },
  // A card filling the word sources' cell, its content centered in it (see SourceSwap).
  cardFill: { flexGrow: 1 },
  // Raised off the board like the pills above it (the fleet's wells' shadow).
  cardSurface: { boxShadow: WELL_SHADOW },
  cardText: { flex: 1 },
  flex: { flex: 1 },
  group: { alignItems: 'center', alignSelf: 'stretch' },
  // The group's own box, whose height eases (its content keeps its own, see PageGroup).
  groupBox: { alignSelf: 'stretch' },
  // Hung from its foot, so a change of height moves what's above it, never Ready.
  groupBoxEnd: { justifyContent: 'flex-end' },
  // A group over the press away catcher (and everything after it) while its popover is open.
  lifted: { zIndex: 2 },
  // One group, centered in the room under the corners, inside the gutters the rest of the app keeps.
  // Once it outgrows the room it scrolls.
  page: { alignItems: 'center', flexGrow: 1, justifyContent: 'center', paddingHorizontal: PAGE_GUTTER, paddingVertical: PAGE_PADDING },
  // Centered, and never wider than the gutters, so a long name shrinks the pill instead of overflowing.
  playerRow: { alignItems: 'center', alignSelf: 'stretch', maxWidth: '100%' },
  // Over everything on the page but a lifted group (its height is the page's).
  pressAway: { zIndex: 1 },
  // PackRow's bar.
  progressBar: { borderRadius: 6, height: 6 },
  progressWrapper: { height: 6, marginTop: 8, overflow: 'hidden' },
  ready: { alignSelf: 'stretch', marginTop: BLOCK_GAP },
  readyContent: { height: 48 },
  segmented: { alignSelf: 'stretch', borderRadius: 20, boxShadow: WELL_SHADOW },
  // As tall as the Difficulty pill whichever way the words come, so a switch moves nothing.
  settingsRow: { alignItems: 'center', alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'center', marginTop: BLOCK_GAP, minHeight: 44 },
  // Over the word sources' cards (the chosen one's layer is lifted inside their cell, see SourceSwap)
  // and Ready.
  settingsRowOpen: { zIndex: 2 },
  sourceChoice: { alignSelf: 'stretch', marginTop: BLOCK_GAP },
  // The word sources' cards overlaid: a row of two whole-width layers, the second pulled back over the
  // first, so the row is as tall as the taller and each card fills it.
  swap: { alignSelf: 'stretch', flexDirection: 'row' },
  swapLayer: { alignItems: 'center', width: '100%' },
  swapLayerChosen: { zIndex: 1 },
  swapLayerOver: { marginLeft: '-100%' },
  writeNote: { flexShrink: 1, textAlign: 'center' }
})
