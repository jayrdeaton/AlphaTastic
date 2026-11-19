// The pack's games, by the ids in their routes (/loadout/<id>, /play/<id>).
export const HANGMAN_GAME_ID = 'hangman'
export const WORD_SEARCH_GAME_ID = 'wordsearch'
export const JUMBLE_GAME_ID = 'jumble'
export const CRYPTOGRAM_GAME_ID = 'cryptogram'

// The games played from a pack by one player, each with its own setup screen (see PuzzleLoadoutScreen).
export const PUZZLE_GAME_IDS = [WORD_SEARCH_GAME_ID, JUMBLE_GAME_ID, CRYPTOGRAM_GAME_ID] as const
export type PuzzleGameId = (typeof PUZZLE_GAME_IDS)[number]
export type GameId = typeof HANGMAN_GAME_ID | PuzzleGameId

export const isPuzzleGameId = (id: string | undefined): id is PuzzleGameId => PUZZLE_GAME_IDS.includes(id as PuzzleGameId)
