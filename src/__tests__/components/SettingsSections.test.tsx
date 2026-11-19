import { Provider, type ThemeSettings, useThemeSettings } from '@rific/auto-paper'
import { FeedbackPressProvider } from '@rific/feedback-press'
import { ToastProvider } from '@rific/toaster'
import { PackProvider, SettingsDialog } from '@tastic/shell'
import { fireEvent, render as rtlRender, waitFor } from '@testing-library/react-native'
import { type ReactElement, type ReactNode, useEffect } from 'react'
import * as RNPaper from 'react-native-paper'
import { Portal } from 'react-native-paper'
import { Provider as ReduxProvider } from 'react-redux'

import { PuzzleDefaultsProvider } from '@/components/PuzzleDefaultsProvider'
import { release } from '@/constants/release'
import { pack } from '@/games/pack'
import { KeyboardLayoutContext } from '@/hooks/useKeyboardLayout'
import { activePlayerActions } from '@/redux/activePlayerSlice'
import { playerSettingsActions } from '@/redux/playerSettingsSlice'
import { roundActions } from '@/redux/roundSlice'
import { store } from '@/redux/store'
import { alert } from '@/utils/alert'
import { pickHangmanFile, shareProgressBackupFile } from '@/utils/hangmanFile'
import { GUEST_PLAYER_KEY } from '@/utils/players'
import { mergePuzzleUnlocks } from '@/utils/unlocks'

// The backup's only ways out to the device: the share sheet / file picker (hangmanFile.ts, not
// meaningfully unit-testable here), the alert, and AsyncStorage through mergePuzzleUnlocks.
// parseProgressBackup stays real, since its shape check is what the invalid-backup tests exercise.
jest.mock('@/utils/hangmanFile', () => ({
  pickHangmanFile: jest.fn(),
  shareProgressBackupFile: jest.fn()
}))
jest.mock('@/utils/alert', () => ({
  alert: jest.fn().mockResolvedValue(undefined)
}))
jest.mock('@/utils/unlocks', () => ({
  ...jest.requireActual('@/utils/unlocks'),
  mergePuzzleUnlocks: jest.fn()
}))
const mockRefreshUnlocks = jest.fn()
jest.mock('@/hooks/useCatalog', () => ({ ...jest.requireActual('@/hooks/useCatalog'), useCatalogActions: () => ({ refreshUnlocks: mockRefreshUnlocks, refreshCustomPacks: jest.fn() }) }))
const mockPickHangmanFile = jest.mocked(pickHangmanFile)
const mockShareProgressBackupFile = jest.mocked(shareProgressBackupFile)
const mockAlert = jest.mocked(alert)
const mockMergePuzzleUnlocks = jest.mocked(mergePuzzleUnlocks)

// The live theme settings, for the harmony.
let capturedSettings: ThemeSettings | null = null
const ThemeCapture = () => {
  const { settings } = useThemeSettings()
  useEffect(() => {
    capturedSettings = settings
  }, [settings])
  return null
}

// The app's nesting: the pack, whose sections the shell's sheet shows, the store (the backup is the active player's),
// FeedbackPressProvider outside auto-paper's Provider (its Portal.Host and theme), a ToastProvider for
// the update-error toast, and the player's puzzle defaults for the art.
const mockSetLayout = jest.fn()
const Wrapper = ({ children }: { children: ReactNode }) => (
  <PackProvider pack={pack}>
    <ReduxProvider store={store}>
      <FeedbackPressProvider paper={RNPaper}>
        <Provider statusBar={false} initialValue={{ appearance: 'light' }}>
          <ToastProvider>
            <KeyboardLayoutContext.Provider value={{ layout: 'qwerty', setLayout: mockSetLayout }}>
              <PuzzleDefaultsProvider>
                <ThemeCapture />
                {/* As every route has: the sheet is a Portal, and its sections read these providers. */}
                <Portal.Host>{children}</Portal.Host>
              </PuzzleDefaultsProvider>
            </KeyboardLayoutContext.Provider>
          </ToastProvider>
        </Provider>
      </FeedbackPressProvider>
    </ReduxProvider>
  </PackProvider>
)
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: Wrapper })

describe("SettingsSections, in the shell's Settings sheet", () => {
  beforeEach(() => {
    store.dispatch(activePlayerActions.setActivePlayer(null))
    store.dispatch(playerSettingsActions.reset())
    store.dispatch(roundActions.reset())
    mockSetLayout.mockClear()
    mockRefreshUnlocks.mockClear()
    mockPickHangmanFile.mockReset()
    mockShareProgressBackupFile.mockReset()
    mockAlert.mockClear()
    mockMergePuzzleUnlocks.mockReset()
  })

  it("shows the fleet sheet's shared rows plus Hangman's keyboard section and its version", async () => {
    const { getByText, getByLabelText } = await render(<SettingsDialog visible onDismiss={jest.fn()} />)

    expect(getByText('Settings')).toBeTruthy()
    expect(getByLabelText(/^Sound (on|off)$/)).toBeTruthy()
    expect(getByText('APPEARANCE')).toBeTruthy()
    expect(getByText('KEYBOARD')).toBeTruthy()
    expect(getByText('QWERTY')).toBeTruthy()
    expect(getByText(`VERSION ${release.otaVersion}`)).toBeTruthy()
  })

  // Hangman is portrait-locked by the OS, has no edge-swipe controls and no how-to-play guide yet,
  // so none of those rows apply.
  it('leaves out Lock Orientation, Edge Guard and How to Play', async () => {
    const { queryByText } = await render(<SettingsDialog visible onDismiss={jest.fn()} />)

    expect(queryByText('Lock Orientation')).toBeNull()
    expect(queryByText('Edge Guard')).toBeNull()
    expect(queryByText('How to Play')).toBeNull()
  })

  it('switches the keyboard layout when ABC is picked', async () => {
    const { getByText } = await render(<SettingsDialog visible onDismiss={jest.fn()} />)

    await fireEvent.press(getByText('ABC'))

    expect(mockSetLayout).toHaveBeenCalledWith('abc')
  })

  // The player picker's color page has no harmony control, so it's here. The live theme's harmony is
  // the active player's: Theme's PlayerThemeSync files the change under them (see Theme.test.tsx).
  it("sets the player's harmony from its HARMONY row, with the one in use checked", async () => {
    const { getByText, getByLabelText } = await render(<SettingsDialog visible onDismiss={jest.fn()} />)
    expect(getByText('HARMONY')).toBeTruthy()
    expect(getByLabelText('Split').props.accessibilityState).toMatchObject({ checked: true })

    await fireEvent.press(getByLabelText('Triadic'))

    expect(capturedSettings?.harmony).toBe('triadic')
    expect(getByLabelText('Triadic').props.accessibilityState).toMatchObject({ checked: true })
  })

  // Art is picked on the setup page's art row (Jay, 2026-11-19), not here.
  it('has no art section', async () => {
    const { queryByText, queryAllByLabelText } = await render(<SettingsDialog visible onDismiss={jest.fn()} />)

    expect(queryByText('ART')).toBeNull()
    expect(queryAllByLabelText(/ art$/)).toHaveLength(0)
  })

  it('renders nothing while closed', async () => {
    const { queryByText } = await render(<SettingsDialog visible={false} onDismiss={jest.fn()} />)

    expect(queryByText('Settings')).toBeNull()
    expect(queryByText('KEYBOARD')).toBeNull()
  })

  describe('Backup', () => {
    it('has a BACKUP section with Export and Import, saying what the file holds', async () => {
      const { getByText } = await render(<SettingsDialog visible onDismiss={jest.fn()} />)

      expect(getByText('BACKUP')).toBeTruthy()
      expect(getByText('Export')).toBeTruthy()
      expect(getByText('Import')).toBeTruthy()
      expect(getByText(/unlocked puzzles/)).toBeTruthy()
    })

    it("shares the active player's progress backup file from Export", async () => {
      mockShareProgressBackupFile.mockResolvedValue(true)
      const { getByText } = await render(<SettingsDialog visible onDismiss={jest.fn()} />)

      await fireEvent.press(getByText('Export'))

      await waitFor(() => expect(mockShareProgressBackupFile).toHaveBeenCalledTimes(1))
      expect(mockShareProgressBackupFile).toHaveBeenCalledWith(GUEST_PLAYER_KEY)
      expect(mockAlert).not.toHaveBeenCalled()
    })

    it("exports and imports a profile's own unlocked puzzles while they're the active player", async () => {
      store.dispatch(activePlayerActions.setActivePlayer('profile-a'))
      const payload = JSON.stringify({ unlocks: { animals: ['lion'] } })
      mockShareProgressBackupFile.mockResolvedValue(true)
      mockPickHangmanFile.mockResolvedValue(payload)
      mockMergePuzzleUnlocks.mockResolvedValue({ importedCount: 1, addedCount: 1 })
      const { getByText } = await render(<SettingsDialog visible onDismiss={jest.fn()} />)

      await fireEvent.press(getByText('Export'))
      await fireEvent.press(getByText('Import'))

      await waitFor(() => expect(mockMergePuzzleUnlocks).toHaveBeenCalledWith('profile-a', payload))
      expect(mockShareProgressBackupFile).toHaveBeenCalledWith('profile-a')
    })

    it("says so when sharing isn't available, or fails", async () => {
      mockShareProgressBackupFile.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('share failed'))
      const { getByText } = await render(<SettingsDialog visible onDismiss={jest.fn()} />)

      await fireEvent.press(getByText('Export'))
      await waitFor(() => expect(mockAlert).toHaveBeenCalledWith("Couldn't Share", 'Sharing is not available on this device.'))
      await fireEvent.press(getByText('Export'))
      await waitFor(() => expect(mockAlert).toHaveBeenCalledWith("Couldn't Share", expect.stringContaining('Something went wrong')))
    })

    it('does nothing when the file picker is canceled', async () => {
      mockPickHangmanFile.mockResolvedValue(null)
      const { getByText } = await render(<SettingsDialog visible onDismiss={jest.fn()} />)

      await fireEvent.press(getByText('Import'))

      await waitFor(() => expect(mockPickHangmanFile).toHaveBeenCalled())
      expect(mockMergePuzzleUnlocks).not.toHaveBeenCalled()
      expect(mockRefreshUnlocks).not.toHaveBeenCalled()
    })

    it('merges a picked backup, tells its screen, and reports the counts', async () => {
      const payload = JSON.stringify({ unlocks: { animals: ['lion'] } })
      mockPickHangmanFile.mockResolvedValue(payload)
      mockMergePuzzleUnlocks.mockResolvedValue({ importedCount: 3, addedCount: 2 })
      const { getByText } = await render(<SettingsDialog visible onDismiss={jest.fn()} />)

      await fireEvent.press(getByText('Import'))

      await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('Import Complete', 'Merged 3 entries. Added 2 new unlocks.'))
      expect(mockMergePuzzleUnlocks).toHaveBeenCalledWith(GUEST_PLAYER_KEY, payload)
      expect(mockRefreshUnlocks).toHaveBeenCalledTimes(1)
    })

    // parseProgressBackup (the real one) is what catches both: a custom pack export has a `pack` key,
    // not `unlocks`, so it's rejected before mergePuzzleUnlocks ever runs rather than merging nothing.
    it.each([
      ['not JSON', 'not valid json'],
      ['a custom pack, not a backup', JSON.stringify({ pack: { key: 'custom:abc', label: 'My Pack', puzzles: [] } })]
    ])('rejects a picked file that is %s, without merging', async (_kind, raw) => {
      mockPickHangmanFile.mockResolvedValue(raw)
      const { getByText } = await render(<SettingsDialog visible onDismiss={jest.fn()} />)

      await fireEvent.press(getByText('Import'))

      await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('Invalid Backup', expect.any(String)))
      expect(mockMergePuzzleUnlocks).not.toHaveBeenCalled()
      expect(mockRefreshUnlocks).not.toHaveBeenCalled()
    })
  })
})
