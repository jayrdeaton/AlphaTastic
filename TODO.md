# TODO

Found during the 2026-10-14 README pass. The Title Case and em dash items were done 2026-10-16.

## Dead code and data

1. **Unloaded data files.** `src/data/geography.json`, `sports.json`, `themePacks.json`, and `geographyLandmarks.json` are tracked, but nothing in the manifest or loaders references them. Either delete them or add them to `puzzleCatalog.generated.ts` (and to the private companion repo that generates `src/data/`, so they don't come back or disappear on the next drop-in).
2. **Unused `src/modes/shared/letterforms.ts`** (264 lines). Only the Hershey version (`letterformsHershey.ts`) is imported. Delete it unless it's being kept on purpose.
3. **Share links can be opened but not created.** `buildPuzzleLink` in `src/utils/puzzleLink.ts` has no UI caller (only its test uses it). The app handles incoming `alphatastic://play` links, but there's no Share button. Either add one (Pass & Play's Hand Off screen is a natural spot) or drop the builder.

## Tests and docs

4. **Possible flaky test.** One full Jest run had 2 failures out of 392, and a re-run passed all 30 suites. Run the suite a few times under load to find which test is timing-sensitive.

## Expo SDK 58 follow-ups (2026-10-16)

Deferred to ship SDK 58 the same day:

- **Check it on a device.** Verify, typecheck and an iOS prebuild pass, but nothing ran on hardware: launch (SDK 58's scene life cycle), the drawers opening and closing by drag and by backdrop tap (`@rific/drawer` 0.7.2), scrolling the pack and puzzle lists (`@rific/scroll-view` 0.9.2) and swiping a toast away (`@rific/toaster` 0.8.1). Those three only had their gesture-handler 3 peer ranges raised, and their tests mock gesture-handler.
- **React Native 0.88 strict types.** `@infinitetoken/tsconfig` 0.6 resolves React Native 0.88's legacy types, and React Native drops them after 0.88. Checked 2026-10-16 with `customConditions: ["react-native"]` only: this app's own code fails in 5 places (`src/components/PackEditorDrawer.tsx:211`, `:226`, `:286`, `src/components/PnpWordPrompt.tsx:168`, `:188`, all TS2322), plus package source it type-checks (`@rific/scroll-view` 27, `@rific/auto-paper` 3, `@tastic/core` 1, `@rific/updater` 1; see those repos' TODO.md).
- **`alphaTasticFile.test.ts` stubs `document`.** It used to run under `@jest-environment jsdom`; React Native's jest setup now redefines `window`, which jsdom rejects, and jsdom can't load under the expo preset, so the file stubs the single `document.createElement('a')` call the download fallback makes. If more web-only tests need a DOM, find a way to run them in a real web environment (jest-expo's web preset, say) instead of growing the stub.


## Router pass follow-ups (2026-10-17)

Checked in the web preview only (Home, both loadouts, a solo round, Pass & Play through Ready, resume after a reload for both modes, leaving and Continue, the abandon confirm, a share link over a guessed round, Stats). Still to check on a device, ideally in the same new native build as the SDK 58 check above (expo-router and react-native-screens are native):

- **A cold launch resumes without flashing Home** on iOS and Android, and the game appears without a push (the `resume` param).
- **Android back** on every screen: the game (back to the loadout, even after a resume with nothing beneath), the loadout (closes an open drawer first, then Home), Stats, Home (leaves the app), and over the result card, the prompt, the hand-off card and Settings.
- **The status bar ink follows the in-app theme** (pick Light with the system in Dark, and the reverse). Only shows in a release build, not a dev client.
- **A `.alphatastic` file opened from Messages or Files** shows the import card over whatever screen is up and doesn't land on not-found (`+native-intent`).
- **A `alphatastic://play?...` link** opened cold, and opened while a game is up (it should pop back to that game screen, not stack a second one).
- **A launch link replayed after the update card's Restart (Android).** `IncomingFileImport` now clears expo-linking's cached launch URL (iOS replayed it through `getLinkingURL`), but on Android expo-router reads React Native's `Linking.getInitialURL()` (the activity's intent), which that doesn't reset. If a shared link or `.alphatastic` file that cold-launched the app comes back after a Restart, have `+native-intent`'s `redirectSystemPath` return `/` when `initial` is true and `Linking.getLinkingURL()` is already null.

## Portrait screen optional on Google Play (2026-11-21)

Before the first Android build (or the next build of both platforms, whichever comes first): add `"./plugins/withOptionalFeatures"` to the end of `app.json`'s `plugins`. The plugin declares `android.hardware.screen.portrait` not required, so Google Play stops reading the portrait lock as a hardware requirement that keeps some devices from installing the app (Play Console flags it before review; CLAUDE.md, "Portrait screen optional on Google Play"). The line moves both platforms' fingerprints, so don't add it between a build and its over-the-air updates. Check with `npx expo config --type introspect`: the manifest gains `<uses-feature android:name="android.hardware.screen.portrait" android:required="false"/>`.

## AlphaTastic rename, what's left (2026-11-25)

The rename is done in code, config, the repo, the folder, the Vercel project and the sites (CLAUDE.md, "The rename finished"). Left:

- **App Store Connect:** move the HangmanTastic record to bundle ID `com.infinitetoken.AlphaTastic` and rename it AlphaTastic (the bundle ID only changes while no build has been uploaded to the record; otherwise make a new record), then `eas metadata:push`.
- **A new native build of both platforms** (Jay runs it): the name, scheme, bundle ID, Android package and file type are all native. `npx expo prebuild --clean` first for a local build. Pair it with the Google Play portrait item above, since both move the fingerprint.
- **The web deploy, in order:** this project's web build at `/alphatastic/` first, then the Games-Web release (`/hangman/` then 308s there). Production is still 1.0.2 from before the shell.
- **AlphaTastic listing:** `store.config.json`'s subtitle ("Classic Hangman. No Ads."), description and keywords still describe Hangman alone. Rewrite them for the four games (the `app-store-prep` skill), keeping "Hangman" in the subtitle for search, and new screenshots and art to match.
- **README:** the intro is AlphaTastic's, but Features and Under the hood still describe the app from before `@tastic/shell` (two doors, drawers, `/loadout?mode=`).
