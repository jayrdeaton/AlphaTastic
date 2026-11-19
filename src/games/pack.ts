import type { PackDefinition } from '@tastic/shell'
import type { Href } from 'expo-router'

import { BoardBackground } from '@/components/BoardBackground'
import { HangmanAchievementList, statsReset } from '@/components/HangmanStats'
import { PackHero } from '@/components/PackHero'
import { PackProviders, PackToaster, useFeedbackSounds, useScreenOptions } from '@/components/PackRoot'
import { SettingsSections } from '@/components/SettingsSections'
import { HANGMAN_GAME_ID } from '@/constants/games'
import { release } from '@/constants/release'
import { labelType, TITLE_FONTS, titleType } from '@/constants/typography'
import { hangman } from '@/games/hangman'
import { cryptogram, jumble, wordSearch } from '@/games/puzzleGames'
import { useActivePlayer } from '@/hooks/useActivePlayer'
import { store, storeSource } from '@/redux/store'
import { gameHref, loadoutHref } from '@/utils/navigation'

export const games = [hangman, wordSearch, jumble, cryptogram]

// The board a cold launch goes back to: the Hangman game that was open, or its setup page if none is
// marked (a web page reloaded after leaving the board).
const resumeHref = (gameId: string): Href | null => {
  if (gameId !== HANGMAN_GAME_ID) return null
  const { activeMode, activeDoor } = store.getState().round
  return (activeMode ? gameHref(activeMode, activeDoor ?? activeMode) : loadoutHref()) as unknown as Href
}

// The app as a @tastic/shell pack: Home (the hero and a card per game), stats, profiles, Settings and
// the root are the shell's; the games, their setup page and everything drawn on the board are here.
// The active player's profile (null for a guest), for the Stats screen to open on.
const useStatsPlayer = (): string | null => useActivePlayer().profileId

export const pack: PackDefinition = {
  ...storeSource,
  name: 'AlphaTastic',
  wordmark: ['Alpha', 'Tastic'],
  colorCaption: 'AlphaTastic only',
  games,
  // Every game's setup page starts with who's playing, so Home doesn't carry a picker too.
  homePlayerPicker: false,
  resumeHref,
  HeroTitle: PackHero,
  Backdrop: BoardBackground,
  Provider: PackProviders,
  Toaster: PackToaster,
  useScreenOptions,
  useFeedbackSounds,
  SettingsSections,
  // The board's own letters, as a font, for every title and label (constants/typography.ts).
  fonts: TITLE_FONTS,
  titleStyle: titleType,
  labelStyle: labelType,
  // Stats open on whoever is playing (Jay, 2026-11-19): a profile, or Everyone for a guest.
  useStatsPlayer,
  AchievementList: HangmanAchievementList,
  resetStats: statsReset,
  statsGameTitles: false,
  edgeGuard: false,
  otaVersion: release.otaVersion
}
