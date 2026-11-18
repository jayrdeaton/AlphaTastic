import { getAchievementCatalogRows } from '@tastic/achievements'
import { AchievementCatalogSection, ActivityStatSection, StatRow, StatSection } from '@tastic/hud/chrome'
import type { PackStatsReset } from '@tastic/shell'
import { JSX, useCallback, useMemo } from 'react'
import { useSelector } from 'react-redux'

import { ACHIEVEMENT_CATALOG, VISIBLE_MODE_COUNT } from '@/constants/achievements'
import { useCatalogActions, useCatalogVersions } from '@/hooks/useCatalog'
import { useGameStats } from '@/hooks/useGameStats'
import { usePlayerData } from '@/hooks/usePlayerData'
import { usePlayerPuzzleUnlocks } from '@/hooks/usePuzzleUnlocks'
import type { RootState } from '@/redux/store'
import { commaString } from '@/utils/commaString'
import { playerKeyFor } from '@/utils/players'
import { getPuzzleManifest } from '@/utils/puzzleCatalog'
import { getProfileStatsView } from '@/utils/statsEngine'
import { createDefaultProfileStats } from '@/utils/statsValidation'
import { getManifestUnlockProgress, getUnlockedCountForPack } from '@/utils/unlocks'

type StatsViewProps = { profileId: string | null }

// A rate with nothing played shows a dash, not 0%.
const winRate = (wins: number, played: number): string => (played > 0 ? `${Math.round((wins / played) * 100)}%` : '-')
const count = (n: number): string => commaString(n)

// The record shown: every round on the device under Everyone (null), or one profile's own.
const useShownStats = (profileId: string | null) => {
  const { stats: deviceStats, unlocked } = useSelector((state: RootState) => state.achievements)
  const profileBucket = profileId ? deviceStats.profiles[profileId] : undefined
  const stats = useMemo(() => (profileId ? getProfileStatsView(profileBucket ?? createDefaultProfileStats()) : deviceStats), [profileId, profileBucket, deviceStats])
  const rows = useMemo(() => getAchievementCatalogRows(ACHIEVEMENT_CATALOG, deviceStats, stats, unlocked, profileId), [deviceStats, stats, unlocked, profileId])
  return { stats, rows }
}

// Hangman's sections on the shell's Stats tab (GameDefinition.StatsSections).
export const HangmanStatsSections = ({ profileId }: StatsViewProps): JSX.Element => {
  const { stats, rows } = useShownStats(profileId)
  const { packsVersion } = useCatalogVersions()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- packsVersion is an intentional external invalidation trigger, not a value the memo body reads
  const manifest = useMemo(() => getPuzzleManifest().filter((item) => item.count > 0), [packsVersion])
  const { unlockMap } = usePlayerPuzzleUnlocks(profileId ? playerKeyFor(profileId) : null)
  const { totalUnlocked, totalAvailable } = useMemo(() => getManifestUnlockProgress(manifest, unlockMap), [manifest, unlockMap])
  const packsComplete = useMemo(() => manifest.filter((item) => getUnlockedCountForPack(unlockMap, item.key) >= item.count).length, [manifest, unlockMap])
  const achievementsEarned = rows.filter((row) => row.unlockedAt !== undefined).length

  return (
    <>
      <StatSection label='PROGRESS'>
        <StatRow label='Puzzles Unlocked' value={`${count(totalUnlocked)} / ${count(totalAvailable)}`} />
        <StatRow label='Packs Completed' value={`${count(packsComplete)} / ${count(manifest.length)}`} />
        <StatRow label='Achievements Earned' value={`${achievementsEarned} / ${ACHIEVEMENT_CATALOG.length}`} />
        <StatRow label='Custom Packs Created' value={count(stats.customPacksCreated)} />
      </StatSection>

      {/* Solo and Pass & Play stay separate, as in the stats themselves (see statsEngine): a Pass & Play
          round is two people on one device, not the player's own record. */}
      <StatSection label='SOLO'>
        <StatRow label='Played' value={count(stats.solo.played)} />
        <StatRow label='Won' value={count(stats.solo.wins)} />
        <StatRow label='Lost' value={count(stats.solo.losses)} />
        <StatRow label='Win Rate' value={winRate(stats.solo.wins, stats.solo.played)} />
        <StatRow label='Current Streak' value={count(stats.soloStreak.currentWinStreak)} />
        <StatRow label='Best Streak' value={count(stats.soloStreak.bestWinStreak)} />
        <StatRow label='Flawless Wins' value={count(stats.flawlessWins)} />
        <StatRow label='Wins Without a Hint' value={count(stats.noHintWins)} />
        <StatRow label='Modes Won' value={`${stats.wonModeIds.length} / ${VISIBLE_MODE_COUNT}`} />
        <StatRow label='Letters Guessed' value={count(stats.lettersGuessed)} />
        <StatRow label='Letters Correct' value={count(stats.lettersCorrect)} />
      </StatSection>

      <StatSection label='PASS & PLAY'>
        <StatRow label='Rounds Played' value={count(stats.pnp.played)} />
        <StatRow label='Words Solved' value={count(stats.pnp.wins)} />
        <StatRow label='Words Missed' value={count(stats.pnp.losses)} />
        <StatRow label='Solve Rate' value={winRate(stats.pnp.wins, stats.pnp.played)} />
      </StatSection>

      <ActivityStatSection stats={stats} />
    </>
  )
}

// The pack's one achievement list (PackDefinition.AchievementList). hud draws gold and silver darker
// in light mode, so they show on the whiteboard.
export const HangmanAchievementList = ({ profileId }: StatsViewProps): JSX.Element => {
  const { rows } = useShownStats(profileId)
  return <AchievementCatalogSection rows={rows} />
}

// The stats screen's Reset follows its player picker: one profile's own record and unlocked puzzles
// (the totals under Everyone keep the rounds they played), or everything.
export const statsReset: PackStatsReset = {
  useReset: () => {
    const { resetAll } = useGameStats()
    const { resetPlayer } = usePlayerData()
    const { refreshUnlocks } = useCatalogActions()
    return useCallback(
      (profileId: string | null) => {
        if (profileId) void resetPlayer(profileId)
        else void resetAll().then(refreshUnlocks)
      },
      [resetAll, resetPlayer, refreshUnlocks]
    )
  },
  labels: (name) => (name ? { label: `Reset ${name}'s Stats`, title: `Reset ${name}?`, body: `This permanently erases ${name}'s stats, achievements and unlocked puzzles. The totals under Everyone stay. This cannot be undone.` } : { label: 'Reset All Stats', title: 'Reset Everything?', body: 'This permanently erases every stat, achievement and unlocked puzzle. This cannot be undone.' })
}
