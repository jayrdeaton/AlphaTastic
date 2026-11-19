import type { FontSource } from 'expo-font'
import type { TextStyle } from 'react-native'

import { TITLE_FONT_ADVANCES } from './titleFontAdvances.generated'

// AlphaTastic's title font (Jay, 2026-11-19): the board's own sketch letters, Hershey Roman Simplex,
// made into a font by scripts/buildTitleFont.mjs. Titles only: in small body text a thin single-stroke
// letter reads worse than the system font. The shell loads it behind the splash screen (the pack's
// `fonts`) and letters its own titles with it (the pack's `titleStyle`: Home's cards, Stats, every hud
// dialog) and labels (`labelStyle`: the picker pills, the Stats screen's tabs and headings, the Settings
// sheet's sections); Hangman's own titles and labels use `titleType` and `labelType` too.
export const TITLE_FONT = 'AlphaSketch'
// The same letters with a heavier pen, for small labels.
export const LABEL_FONT = 'AlphaSketchBold'
const TITLE_LETTER_SPACING = 1

export const TITLE_FONTS: Record<string, FontSource> = { [TITLE_FONT]: require('../../assets/fonts/AlphaSketch.otf'), [LABEL_FONT]: require('../../assets/fonts/AlphaSketch-Bold.otf') }

// A title's lettering, laid over its own type: in capitals, like the puzzles and the wordmark (Jay,
// 2026-11-19: "like the actual puzzles"), a touch apart. One weight: the font has no bold, and a
// synthesized one would thicken the pen unevenly. Screen readers still read the title as written.
export const titleType: TextStyle = { fontFamily: TITLE_FONT, fontWeight: 'normal', textTransform: 'uppercase', letterSpacing: TITLE_LETTER_SPACING }

// A small label's lettering (Jay, 2026-11-19: the Stats screen and the pickers too): the picker pills,
// the Stats tabs and section headings, the Settings sheet's sections. Laid over each label's own type,
// keeping its spacing, in the heavier pen and at one size, 14pt (Jay, 2026-11-19: in the title's pen
// the Stats cards' 12pt headings looked thin beside their bold numbers, and then small; the pills were
// 13pt and the tabs 14pt, and at 15pt ACHIEVEMENTS no longer fit its tab on a phone).
export const labelType: TextStyle = { fontFamily: LABEL_FONT, fontWeight: 'normal', textTransform: 'uppercase', fontSize: 14, lineHeight: 20 }

// A character the font doesn't have is drawn in the fallback font, about this wide.
const FALLBACK_ADVANCE = 600

// The largest size up to `maxSize` (and no smaller than `minSize`) at which `text`, set in capitals in
// titleType, fits `width` on one line: capitals are wide, and a long pack name ("Countries &
// Territories") overran a phone's header. From the font's own widths, so it works on the web too,
// where adjustsFontSizeToFit does nothing. Past `minSize` the title is cut short as before.
export const fitTitleSize = (text: string, width: number, maxSize: number, minSize = 16): number => {
  const letters = [...text.toUpperCase()]
  const units = letters.reduce((sum, letter) => sum + (TITLE_FONT_ADVANCES[letter] ?? FALLBACK_ADVANCE), 0)
  if (units === 0 || width <= 0) return maxSize
  const fits = ((width - letters.length * TITLE_LETTER_SPACING) * 1000) / units
  return Math.max(minSize, Math.min(maxSize, Math.floor(fits)))
}
