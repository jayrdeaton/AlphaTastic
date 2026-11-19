import { HarmonyPicker, useAutoPaperTheme, useThemeSettings } from '@rific/auto-paper'
import { Button, SegmentedButtons } from '@rific/feedback-press'
import { JSX } from 'react'
import { StyleSheet, View } from 'react-native'
import { Text } from 'react-native-paper'

import { useActivePlayer } from '@/hooks/useActivePlayer'
import { useCatalogActions } from '@/hooks/useCatalog'
import { useKeyboardLayout } from '@/hooks/useKeyboardLayout'
import { alert } from '@/utils/alert'
import { pickHangmanFile, shareProgressBackupFile } from '@/utils/hangmanFile'
import { mergePuzzleUnlocks, parseProgressBackup } from '@/utils/unlocks'

import { SettingsSection } from './SettingsSection'

const KEYBOARD_BUTTONS = [
  { value: 'qwerty', label: 'QWERTY' },
  { value: 'abc', label: 'ABC' }
]

// The pack's own rows in the shell's Settings sheet (PackDefinition.SettingsSections), under Sound,
// Haptics and Appearance. The sheet renders through a Portal, so every screen that opens it sits in a
// Portal.Host of its own, inside the pack's providers these read.
export const SettingsSections = (): JSX.Element => {
  const { colors } = useAutoPaperTheme()
  const { layout, setLayout } = useKeyboardLayout()
  const { key: playerKey } = useActivePlayer()
  const { refreshUnlocks } = useCatalogActions()
  const { settings: themeSettings, set: setThemeSettings } = useThemeSettings()

  const handleExport = async () => {
    try {
      const shared = await shareProgressBackupFile(playerKey)
      if (!shared) void alert("Couldn't Share", 'Sharing is not available on this device.')
    } catch {
      void alert("Couldn't Share", 'Something went wrong sharing your progress backup. Please try again.')
    }
  }

  const handleImport = async () => {
    const raw = await pickHangmanFile()
    if (!raw) return

    try {
      parseProgressBackup(raw)
      const result = await mergePuzzleUnlocks(playerKey, raw)
      refreshUnlocks()
      void alert('Import Complete', `Merged ${result.importedCount} entries. Added ${result.addedCount} new unlocks.`)
    } catch {
      void alert('Invalid Backup', 'Could not read that as a Hangman progress backup file.')
    }
  }

  return (
    <>
      {/* How the player's two other colors are drawn from their color (the picker's color page has no
          harmony control): icons only, since six labels don't fit the sheet. */}
      <SettingsSection label='HARMONY'>
        <HarmonyPicker value={themeSettings.harmony} onChange={(harmony) => setThemeSettings({ harmony })} showLabels={false} />
      </SettingsSection>
      <SettingsSection label='KEYBOARD'>
        <SegmentedButtons value={layout} onValueChange={(value) => setLayout(value as typeof layout)} buttons={KEYBOARD_BUTTONS} />
      </SettingsSection>
      {/* Outlined, like the sheet's own Check for Updates. The file holds the unlocked puzzles only:
          stats and achievements aren't in it. */}
      <SettingsSection label='BACKUP'>
        <View style={styles.backupButtons}>
          <Button mode='outlined' icon='export-variant' onPress={() => void handleExport()} style={styles.backupButton}>
            Export
          </Button>
          <Button mode='outlined' icon='import' onPress={() => void handleImport()} style={styles.backupButton}>
            Import
          </Button>
        </View>
        <Text variant='bodySmall' style={{ color: colors.onSurfaceVariant }}>
          Saves your unlocked puzzles to a file. Importing one adds its puzzles to yours.
        </Text>
      </SettingsSection>
    </>
  )
}

const styles = StyleSheet.create({
  backupButton: { flex: 1 },
  backupButtons: { flexDirection: 'row', gap: 12 }
})
