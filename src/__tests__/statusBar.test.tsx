import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

import appJson from '../../app.json'

// react-native-screens sets the bar per screen, which needs UIViewControllerBasedStatusBarAppearance on
// (app.json), and with it on, every React Native StatusBar logs an error (a red box in a dev build). An
// app linked against the iOS 27 SDK can't set the bar through one anyway: that component only sets it
// app-wide, which UIKit ignores there. So nothing in the app may mount one. The bar's ink is set per
// screen instead (PackRoot's useScreenOptions); the shell turns auto-paper's own StatusBar off.

const SRC = join(__dirname, '..')
// The one app file outside src/: expo-router's entry (src/app/_layout.tsx, the old App.tsx's
// replacement, is under src/ and scanned with the rest).
const ENTRY = join(SRC, '..', 'index.js')

/** Every app source file (tests and mocks left out). */
function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' || name === '__mocks__' ? [] : sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

describe('the status bar', () => {
  it('is never a StatusBar component: no source file imports expo-status-bar or React Native StatusBar', () => {
    const files = [...sourceFiles(), ENTRY]
    // Guards the scan itself: the routes and the root layout have to be in it.
    expect(files).toEqual(expect.arrayContaining([join(SRC, 'app', '_layout.tsx'), join(SRC, 'games', 'hangman.tsx'), join(SRC, 'components', 'PackRoot.tsx')]))

    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8')
      return /from ['"]expo-status-bar['"]/.test(source) || /import\s*\{[^}]*\bStatusBar\b[^}]*\}\s*from ['"]react-native['"]/.test(source)
    })
    expect(offenders.map((file) => relative(SRC, file))).toEqual([])
  })

  it('has iOS let each screen set it', () => {
    expect(appJson.expo.ios.infoPlist.UIViewControllerBasedStatusBarAppearance).toBe(true)
  })
})
