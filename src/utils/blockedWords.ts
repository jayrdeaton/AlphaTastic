// Random letters can spell anything, in any direction, and children play these games. Generated text (a
// word search's filler, a jumble's scramble, a cipher) is rerolled when it spells one of these. The
// answers themselves come from the packs, which are filtered already.
export const BLOCKED_WORDS = ['ANAL', 'ANUS', 'ARSE', 'ASS', 'BITCH', 'BOOB', 'CHINK', 'COCK', 'COON', 'CRAP', 'CUM', 'CUNT', 'DAMN', 'DICK', 'DIKE', 'DILDO', 'DYKE', 'FAG', 'FUCK', 'GOOK', 'HOMO', 'JIZZ', 'KIKE', 'KKK', 'MILF', 'NAZI', 'NIGGA', 'NIGGER', 'PENIS', 'PISS', 'PORN', 'PUSSY', 'RAPE', 'RETARD', 'SEX', 'SHIT', 'SLUT', 'SPIC', 'TITS', 'TRANNY', 'TWAT', 'VAGINA', 'WANK', 'WHORE']

const reversed = (text: string): string => [...text].reverse().join('')

// Whether the letters spell a blocked word, read from either end.
export const spellsBlockedWord = (text: string): boolean => BLOCKED_WORDS.some((word) => text.includes(word) || text.includes(reversed(word)))
