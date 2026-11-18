import { RootLayout } from '@tastic/shell'
import { render } from '@testing-library/react-native'

import RootRoute from '@/app/_layout'
import { pack } from '@/games/pack'
import { packStore, persistor } from '@/redux/store'

jest.mock('@tastic/shell', () => ({ ...jest.requireActual('@tastic/shell'), RootLayout: jest.fn(() => null) }))

describe('the root layout', () => {
  it("is the shell's, handed the pack and its store", async () => {
    await render(<RootRoute />)

    expect(jest.mocked(RootLayout).mock.calls[0][0]).toEqual({ pack, store: packStore, persistor })
  })
})
