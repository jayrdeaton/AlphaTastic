import type { ThemeSettings } from '@rific/auto-paper'

export type LiveTheme = Pick<ThemeSettings, 'color' | 'harmony'>

// What a fresh install starts on: auto-paper's first swatch, Hangman's own red.
export const DEFAULT_THEME: LiveTheme = { color: '#f44336', harmony: 'split-complementary' }

let live = DEFAULT_THEME

// The colors on screen. In this pack they belong to whoever is playing (PlayerThemeSync, see PackRoot),
// but the shell's Home keeps the theme on its seats' colors through the pack's seatTheme. So seatTheme
// answers with this, and Home always finds the theme already right and changes nothing.
export const getLiveTheme = (): LiveTheme => live
export const setLiveTheme = (theme: LiveTheme): void => {
  live = theme
}
