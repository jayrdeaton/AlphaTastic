import { roundActions } from '@/redux/roundSlice'
import { store } from '@/redux/store'

// A fresh table is one seat on the packs (Jay, 2026-11-19: one setup page for any number of players).
// The table the Pass & Play suites were written against: Player 1 and Player 2, writing words for each
// other. Call it right after the round slice is reset.
export const seatTwoWriting = (): void => {
  store.dispatch(roundActions.addPnpPlayer())
  store.dispatch(roundActions.setPnpSource('write'))
}
