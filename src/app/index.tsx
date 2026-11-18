import { HomeScreen } from '@tastic/shell'
import { JSX } from 'react'
import { Portal } from 'react-native-paper'

// Home is the shell's: the hero and a card per game. Its own Portal host keeps the Settings sheet under
// the pack's providers, whose sections read them.
const HomeRoute = (): JSX.Element => (
  <Portal.Host>
    <HomeScreen />
  </Portal.Host>
)

export default HomeRoute
