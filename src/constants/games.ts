// The pack's games, by the ids in their routes (/loadout/<id>, /play/<id>) and the shell's store.
export const HANGMAN_GAME_ID = 'hangman'
export const WORD_SEARCH_GAME_ID = 'wordsearch'
export type GameId = typeof HANGMAN_GAME_ID | typeof WORD_SEARCH_GAME_ID
