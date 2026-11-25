import { Provider as AutoPaperProvider } from '@rific/auto-paper'
import { render } from '@testing-library/react-native'
import { useLocalSearchParams } from 'expo-router'
import { isValidElement } from 'react'
import { Provider as ReduxProvider } from 'react-redux'

import EditProfilePage from '@/app/profile/[id]'
import { PaletteSwatch } from '@/components/PaletteSwatch'
import { activePlayerActions } from '@/redux/activePlayerSlice'
import { DEFAULT_HARMONY, playerThemeActions } from '@/redux/playerThemeSlice'
import { store } from '@/redux/store'

// The shell's Edit Profile screen stands in as a probe: the swatch its Color grid would draw, from the
// renderer the page hands it.
let mockDrawn: unknown = null
jest.mock('@tastic/shell', () => ({
  ...jest.requireActual('@tastic/shell'),
  EditProfileRoute: () => {
    mockDrawn = require('@tastic/profile').useProfileSwatchRenderer()?.('#f44336', 28, 'colorPage') ?? null
    return null
  }
}))

const ALICE = 'alice-id'
const drawnHarmony = () => (isValidElement(mockDrawn) && mockDrawn.type === PaletteSwatch ? (mockDrawn.props as { harmony: string }).harmony : null)

const renderPage = (id: string) => {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id })
  return render(
    <ReduxProvider store={store}>
      <AutoPaperProvider statusBar={false} initialValue={{ harmony: 'triadic' }}>
        <EditProfilePage />
      </AutoPaperProvider>
    </ReduxProvider>
  )
}

describe('the Edit Profile route', () => {
  beforeEach(() => {
    mockDrawn = null
    store.dispatch(activePlayerActions.setActivePlayer(null))
    store.dispatch(playerThemeActions.removePlayer(ALICE))
  })

  it("draws the Color grid's swatches as the palettes the profile's own harmony gives", async () => {
    store.dispatch(playerThemeActions.setPlayerTheme({ playerKey: ALICE, theme: { color: '#f44336', harmony: 'analogous' } }))
    await renderPage(ALICE)
    expect(drawnHarmony()).toBe('analogous')
  })

  it('uses the live harmony while the profile is the one playing', async () => {
    store.dispatch(playerThemeActions.setPlayerTheme({ playerKey: ALICE, theme: { color: '#f44336', harmony: 'analogous' } }))
    store.dispatch(activePlayerActions.setActivePlayer(ALICE))
    await renderPage(ALICE)
    expect(drawnHarmony()).toBe('triadic')
  })

  it('uses the default harmony for a profile with none kept, and for New Profile', async () => {
    await renderPage(ALICE)
    expect(drawnHarmony()).toBe(DEFAULT_HARMONY)
    await renderPage('new')
    expect(drawnHarmony()).toBe(DEFAULT_HARMONY)
  })
})
