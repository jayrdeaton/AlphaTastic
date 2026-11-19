import { JUMBLE_GAME_ID, PUZZLE_GAME_IDS } from '@/constants/games'
import { PUZZLE_GAME_SETUP, puzzleOptionsFor } from '@/utils/puzzleOptions'

describe("the puzzle games' settings", () => {
  it.each(PUZZLE_GAME_IDS)('gives every setting of %s a default among its choices', (game) => {
    const { settings, defaults } = PUZZLE_GAME_SETUP[game]

    expect(Object.keys(defaults).sort()).toEqual(settings.map(({ key }) => key).sort())
    for (const { key, choices } of settings) expect(choices.map(({ value }) => value)).toContain(defaults[key])
  })

  it('fills in whatever a player has not changed', () => {
    expect(puzzleOptionsFor(JUMBLE_GAME_ID, { answers: '10' })).toEqual({ answers: '10', length: 'medium' })
    expect(puzzleOptionsFor(JUMBLE_GAME_ID, undefined)).toEqual({ answers: '5', length: 'medium' })
  })
})
