import { act, renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { Provider as ReduxProvider } from 'react-redux'

import { ActiveGameProvider, useActiveGame } from '@/hooks/useActiveGame'
import { roundActions } from '@/redux/roundSlice'
import { store } from '@/redux/store'

// The app's store, as Providers.tsx hands it in (a module singleton, so the round slice is reset
// before every test). The redux-persist mock passes the round reducer straight through, so a
// rehydrated activeMode is just one already in the store when the provider is first asked.
const Wrapper = ({ children }: { children: ReactNode }) => (
  <ReduxProvider store={store}>
    <ActiveGameProvider>{children}</ActiveGameProvider>
  </ReduxProvider>
)

const renderActiveGame = () => {
  let renders = 0
  return renderHook(
    () => {
      renders += 1
      return useActiveGame()
    },
    { wrapper: Wrapper }
  ).then((utils) => ({ ...utils, renders: () => renders }))
}

const activeMode = () => store.getState().round.activeMode
const setActiveModeCalls = (dispatch: jest.SpyInstance) => dispatch.mock.calls.filter(([action]) => roundActions.setActiveMode.match(action)).map(([action]) => action.payload.mode)

describe('useActiveGame', () => {
  let dispatch: jest.SpyInstance

  beforeEach(() => {
    store.dispatch(roundActions.reset())
    dispatch = jest.spyOn(store, 'dispatch')
  })

  afterEach(() => {
    dispatch.mockRestore()
  })

  describe('markActive', () => {
    it('saves the open game, dispatching only when it changes', async () => {
      const { result } = await renderActiveGame()

      await act(async () => {
        result.current.markActive('solo')
        result.current.markActive('solo')
      })
      expect(activeMode()).toBe('solo')
      expect(setActiveModeCalls(dispatch)).toEqual(['solo'])

      await act(async () => {
        result.current.markActive('pnp')
      })
      expect(activeMode()).toBe('pnp')
      expect(setActiveModeCalls(dispatch)).toEqual(['solo', 'pnp'])
    })

    it('saves the door the game is played from, its own unless said', async () => {
      const { result } = await renderActiveGame()

      await act(async () => {
        result.current.markActive('solo', 'pnp')
      })
      expect(store.getState().round).toMatchObject({ activeMode: 'solo', activeDoor: 'pnp' })

      await act(async () => {
        result.current.markActive('solo')
      })
      expect(store.getState().round).toMatchObject({ activeMode: 'solo', activeDoor: 'solo' })
      expect(setActiveModeCalls(dispatch)).toEqual(['solo', 'solo'])
    })
  })

  describe('clearActive', () => {
    it('clears the saved game, dispatching only when one is saved', async () => {
      const { result } = await renderActiveGame()

      await act(async () => {
        result.current.clearActive()
      })
      expect(setActiveModeCalls(dispatch)).toEqual([])

      await act(async () => {
        result.current.markActive('pnp')
        result.current.clearActive()
        result.current.clearActive()
      })
      expect(activeMode()).toBeNull()
      expect(setActiveModeCalls(dispatch)).toEqual(['pnp', null])
    })
  })

  // Every screen reads this context; a new value on every move between screens would re-render all
  // of them.
  it('hands out the same value across re-renders, and nothing re-renders when the active game changes', async () => {
    const { result, rerender, renders } = await renderActiveGame()
    const before = result.current

    await rerender({})
    expect(result.current).toBe(before)

    const rendersBefore = renders()
    await act(async () => {
      result.current.markActive('solo')
      result.current.markActive('pnp')
      result.current.clearActive()
    })
    expect(renders()).toBe(rendersBefore)
    expect(result.current).toBe(before)
  })

  it('does nothing outside the provider', async () => {
    const { result } = await renderHook(() => useActiveGame(), { wrapper: ({ children }: { children: ReactNode }) => <ReduxProvider store={store}>{children}</ReduxProvider> })
    store.dispatch(roundActions.setActiveMode('pnp'))
    dispatch.mockClear()

    result.current.markActive('solo')
    result.current.clearActive()

    expect(dispatch).not.toHaveBeenCalled()
    expect(activeMode()).toBe('pnp')
  })
})
