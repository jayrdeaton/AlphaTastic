import { createContext, JSX, ReactNode, useContext, useMemo } from 'react'
import { useStore } from 'react-redux'

import { type PlayMode, roundActions } from '@/redux/roundSlice'
import type { RootState } from '@/redux/store'

export type ActiveGame = {
  // The game screen marks its mode as it comes into focus, and which of the setup page's modes it
  // belongs to (see gameHref).
  markActive: (mode: PlayMode, door?: PlayMode) => void
  // Called as it leaves, however the player got off it.
  clearActive: () => void
}

const ActiveGameContext = createContext<ActiveGame>({ markActive: () => {}, clearActive: () => {} })

// Which Hangman board was open when the app went away, kept in the round slice. The shell remembers
// that the game was open (GameDefinition.resumable) and, on a cold launch, asks the pack where to go
// (PackDefinition.resumeHref, which reads what's marked here).
export const ActiveGameProvider = ({ children }: { children: ReactNode }): JSX.Element => {
  const store = useStore<RootState>()

  const value = useMemo<ActiveGame>(
    () => ({
      markActive: (mode, door = mode) => {
        const { activeMode, activeDoor } = store.getState().round
        if (activeMode !== mode || activeDoor !== door) store.dispatch(roundActions.setActiveMode(mode, door))
      },
      clearActive: () => {
        if (store.getState().round.activeMode !== null) store.dispatch(roundActions.setActiveMode(null))
      }
    }),
    [store]
  )

  return <ActiveGameContext.Provider value={value}>{children}</ActiveGameContext.Provider>
}

export const useActiveGame = (): ActiveGame => useContext(ActiveGameContext)
