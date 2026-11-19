import type { GamePreviewProps, GuidelessGameDefinition } from '@tastic/shell'
import { ComponentType, JSX } from 'react'
import { Portal } from 'react-native-paper'

import { CryptogramScreen } from '@/components/CryptogramScreen'
import { JumbleScreen } from '@/components/JumbleScreen'
import { PuzzleGameArt } from '@/components/PuzzleArt'
import { WordSearchScreen } from '@/components/WordSearchScreen'
import { CRYPTOGRAM_GAME_ID, JUMBLE_GAME_ID, type PuzzleGameId, WORD_SEARCH_GAME_ID } from '@/constants/games'

import { OWN_LOADOUT } from './ownLoadout'

// Nothing of their own on the Stats tab yet: these prototypes don't record rounds.
const NoStats = (): null => null

const puzzleGame = (id: PuzzleGameId, title: string, blurb: string, Screen: ComponentType): GuidelessGameDefinition => {
  // Its own Portal host keeps the fireworks and the solved card with this screen.
  const PlayScreen = (): JSX.Element => (
    <Portal.Host>
      <Screen />
    </Portal.Host>
  )
  const Preview = ({ width, height }: GamePreviewProps): JSX.Element => <PuzzleGameArt game={id} width={width} height={height} />
  return { id, title, blurb, Preview, reducers: {}, useLoadout: OWN_LOADOUT, PlayScreen, keepStatusBar: true, StatsSections: NoStats }
}

export const wordSearch = puzzleGame(WORD_SEARCH_GAME_ID, 'Word Search', 'Find every word hidden in a grid themed by your puzzle packs.', WordSearchScreen)
export const jumble = puzzleGame(JUMBLE_GAME_ID, 'Jumble', 'Put the letters back in order to spell answers from your packs.', JumbleScreen)
export const cryptogram = puzzleGame(CRYPTOGRAM_GAME_ID, 'Cryptogram', 'Crack the letter code to reveal the answer.', CryptogramScreen)
