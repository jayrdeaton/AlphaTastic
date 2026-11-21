import { CRYPTOGRAM_GAME_ID, JUMBLE_GAME_ID, PUZZLE_GAME_IDS, type PuzzleGameId, WORD_SEARCH_GAME_ID } from '@/constants/games'

export type PuzzleLength = 'short' | 'medium' | 'long'
export type WordSearchOptions = { grid: 'small' | 'medium' | 'large'; directions: 'straight' | 'diagonal' | 'backward' }
export type JumbleOptions = { answers: '3' | '5' | '10'; length: PuzzleLength }
export type CryptogramOptions = { length: PuzzleLength; headStart: '1' | '3' | '5' }
export type PuzzleOptionsByGame = { [WORD_SEARCH_GAME_ID]: WordSearchOptions; [JUMBLE_GAME_ID]: JumbleOptions; [CRYPTOGRAM_GAME_ID]: CryptogramOptions }
// What a player has changed, by game. Anything left out is at its default.
export type PlayerPuzzleOptions = { [G in PuzzleGameId]?: Partial<PuzzleOptionsByGame[G]> }

export type PuzzleSettingChoice = { value: string; label: string; icon: string }
// `caption` is the short name over the pill's pick (Jay, 2026-11-19, as Difficulty's), where `label`
// is the setting's whole name.
export type PuzzleSetting = { key: string; label: string; caption: string; choices: PuzzleSettingChoice[] }
export type PuzzleGameSetup = { title: string; settings: PuzzleSetting[]; defaults: Record<string, string> }

const LENGTH_CHOICES: PuzzleSettingChoice[] = [
  { value: 'short', label: 'Short', icon: 'signal-cellular-1' },
  { value: 'medium', label: 'Medium', icon: 'signal-cellular-2' },
  { value: 'long', label: 'Long', icon: 'signal-cellular-3' }
]

// Each puzzle game's own setup: its name and the choices its setup screen offers.
export const PUZZLE_GAME_SETUP: Record<PuzzleGameId, PuzzleGameSetup> = {
  [WORD_SEARCH_GAME_ID]: {
    title: 'Word Search',
    settings: [
      {
        key: 'grid',
        label: 'Grid size',
        caption: 'Grid',
        choices: [
          { value: 'small', label: 'Small', icon: 'grid-large' },
          { value: 'medium', label: 'Medium', icon: 'grid' },
          { value: 'large', label: 'Large', icon: 'view-comfy' }
        ]
      },
      {
        key: 'directions',
        label: 'Directions',
        caption: 'Directions',
        choices: [
          { value: 'straight', label: 'Straight', icon: 'arrow-right' },
          { value: 'diagonal', label: 'Diagonal', icon: 'arrow-top-right' },
          { value: 'backward', label: 'Backward', icon: 'swap-horizontal' }
        ]
      }
    ],
    defaults: { grid: 'medium', directions: 'diagonal' }
  },
  [JUMBLE_GAME_ID]: {
    title: 'Jumble',
    settings: [
      {
        key: 'answers',
        label: 'Answers',
        // Its picks already say answers.
        caption: 'Round',
        choices: [
          { value: '3', label: '3 answers', icon: 'numeric-3-circle-outline' },
          { value: '5', label: '5 answers', icon: 'numeric-5-circle-outline' },
          { value: '10', label: '10 answers', icon: 'numeric-10-circle-outline' }
        ]
      },
      { key: 'length', label: 'Answer length', caption: 'Length', choices: LENGTH_CHOICES }
    ],
    defaults: { answers: '5', length: 'medium' }
  },
  [CRYPTOGRAM_GAME_ID]: {
    title: 'Cryptogram',
    settings: [
      { key: 'length', label: 'Answer length', caption: 'Length', choices: LENGTH_CHOICES },
      {
        key: 'headStart',
        label: 'Letters solved at the start',
        caption: 'Head start',
        choices: [
          { value: '1', label: '1 letter', icon: 'numeric-1-circle-outline' },
          { value: '3', label: '3 letters', icon: 'numeric-3-circle-outline' },
          { value: '5', label: '5 letters', icon: 'numeric-5-circle-outline' }
        ]
      }
    ],
    defaults: { length: 'medium', headStart: '3' }
  }
}

export const puzzleOptionsFor = <G extends PuzzleGameId>(game: G, stored: PlayerPuzzleOptions[G] | undefined): PuzzleOptionsByGame[G] => ({ ...PUZZLE_GAME_SETUP[game].defaults, ...stored }) as unknown as PuzzleOptionsByGame[G]

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

// What comes back from storage: only known games, settings and choices are kept.
export const sanitizePuzzleOptions = (value: unknown): PlayerPuzzleOptions | undefined => {
  if (!isRecord(value)) return undefined
  const next: Record<string, Record<string, string>> = {}
  for (const game of PUZZLE_GAME_IDS) {
    const stored = value[game]
    if (!isRecord(stored)) continue
    const kept = Object.fromEntries(PUZZLE_GAME_SETUP[game].settings.flatMap(({ key, choices }) => (choices.some((choice) => choice.value === stored[key]) ? [[key, stored[key] as string]] : [])))
    if (Object.keys(kept).length > 0) next[game] = kept
  }
  return Object.keys(next).length > 0 ? (next as PlayerPuzzleOptions) : undefined
}
