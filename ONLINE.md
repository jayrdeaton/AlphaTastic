# Online play with friends: the plan

A draft for Jay to approve (2026-11-19). Nothing here is built yet. The open choices are under Decisions at the end, each with a
recommendation. It follows HexFleet's `ONLINE.md` and builds on Tastic-Server as it stands, read from its code on 2026-11-19.

## What it is

- **You make a puzzle for someone and send it:** a Hangman word with its hint and art, a word list for Word Search, answers for
  Jumble, a phrase for Cryptogram, or a whole custom pack. They play it on their phone (or in a browser) whenever they like, and you
  see how it went: "Bob solved it with 2 misses."
- **Friends only:** you can only send to someone you've swapped a code or link with. No strangers, no search by name, no public
  gallery of packs, no chat.
- **Nothing is live:** a sent puzzle waits until it's opened, and a push says something arrived. Nobody waits on anybody.
- **One screen for the whole pack,** from Home: what's waiting for you at the top, your friends, then what you sent with how it went.
- **Per profile:** each profile has online on or off, off until someone turns it on. Jay's kids' profiles stay off.
- **Not in this:** live play, matchmaking, chat, public packs, leaderboards for sent puzzles, and mixing a friend on another phone into
  a pass-and-play table. The design leaves room for each.

It has five parts: one item format and one word filter in a package both sides import, a third kind of module on Tastic-Server,
the app's Friends screen and Send buttons, invite links on Games-Web, and moderation.

## 1. Links first, or the server first?

Jay asked whether the first step could be links alone, with no server. It can, and I'd start there, but links can't do what the
Friends screen is for.

**What's already here:**
- `buildPuzzleLink` (`src/utils/puzzleLink.ts`) builds a `/play?phrase=...&hint=...&mode=...` link. It has no caller today.
- The `/play` route (`src/app/play/index.tsx`, `PlayScreen`) opens such a link: it checks the phrase and hint against the input
  limits (128 and 80 characters) and starts the puzzle on Single Player's guest's solo board, asking first if that would abandon a
  round with guesses on it. Hangman only.
- Custom packs already travel as `.hangman` files: a custom pack's editor page in Choose Packs shares one (`PackEditorPage`'s
  Share, `shareCustomPackFile`) and `IncomingFileImport` opens one behind a confirm card ("Import "Dinosaurs"?").
- The web build at `games.infinitetoken.com/hangman/` plays a `/hangman/play?...` link with nothing installed (checked on a local
  serve of the export, 2026-10-19).

**What links alone can do:** carry a puzzle one way, to anyone, through whatever they already message with, and play in a browser
for someone without the app. No server, no player, no account to delete, no push permission, no native build.

**What they can't:** tell you whether it was played or how it went, keep a history, show anything waiting in the app, or let
anyone block a sender (there's no sender, only a message). The answer also sits in the link in plain text today, so a glance at the
message spoils it.

**Recommendation (decision 1):** slice 0 is links, then the server. Slice 0 builds the parts the server version needs anyway (the
item format, the filter, a way to write a puzzle for every game, a board that plays someone else's puzzle without touching your
own round), so nothing is thrown away, and it shows whether the family actually sends puzzles before any money or Apple paperwork
goes in. A "Send result" button on the result card carries a line back ("I solved Jay's word with 2 misses"), the way Wordle's
grid travels. Links stay afterwards, for sending to someone who doesn't want online.

## 2. What gets sent: one item for every game

Every send is one item: short structured text and the game it's for. The same shape travels in a link (slice 0) and through the
server (slice 1 on).

```ts
type Item =
  | { game: 'hangman'; phrase: string; hint: string | null; art: string }
  | { game: 'wordsearch'; title: string; words: string[]; options: WordSearchOptions }
  | { game: 'jumble'; answers: { answer: string; hint: string | null }[]; options: JumbleOptions }
  | { game: 'cryptogram'; phrase: string; hint: string | null; options: CryptogramOptions }
  | { game: 'pack'; label: string; puzzles: { answer: string; hint: string | null }[] }
```

- **The ids are the app's** (`src/constants/games.ts`: `hangman`, `wordsearch`, `jumble`, `cryptogram`), and the options are
  `src/utils/puzzleOptions.ts`' own (`grid` and `directions`; `answers` and `length`; `length` and `headStart`), so the friend
  plays exactly what you set up.
- **Only the words travel.** The receiving phone builds the board from them as it does from a pack: the grid and its filler
  (`drawWordSearch`'s placement and `cleanFiller`), the scramble, the cipher. That keeps an item a few hundred bytes and means the
  generated letters always pass through the app's own blocked-word rerolls (`src/utils/blockedWords.ts`).
- **The limits are the ones the app already keeps,** checked as you type and again on arrival:
  - Hangman: the phrase up to 128 characters and the hint up to 80 (`PnpWordPrompt`'s inputs), normalized to letters and spaces
    as today (`normalizePhrase`). `art` is the sender's art id; an id the receiver doesn't know falls back to the default, as
    `findMode` does now.
  - Word Search: each word at least 4 letters and no longer than the grid (`MIN_WORD_LETTERS`, `src/utils/wordSearch.ts`), no
    word inside another, and as many as the grid takes (8, 10 or 14). A title of up to 60 characters stands in for the pack's name
    in the header (the pack editor's label limit).
  - Jumble: the count the options say (3, 5 or 10), each answer fitting the length setting (`fitsRules` and `JUMBLE_LENGTHS`,
    `src/utils/jumble.ts`: Short one word of 4 to 7 letters, Medium up to two words and 5 to 12 letters, Long up to three words and
    7 to 16, at least 3 different letters).
  - Cryptogram: two or more words, 14 or more letters with 8 or more different ones, no word over 12 letters, and no more letters
    than the length allows (28, 36 or 44; `src/utils/cryptogram.ts`).
  - A pack: a name up to 60 characters and its words as the pack editor takes them (128 and 80). The editor has no cap on how many
    words a pack holds today; a sent pack needs one (decision 15).
- **A pack goes by file in slice 0,** as it already does: a pack of a few hundred words is too long for a link most messaging apps
  will carry whole.

## 3. One word filter, on the phone and on the server

Everything a person writes goes through one filter: answers, hints, Word Search titles, pack names, and profile names (which become
your name to your friends). HexFleet's plan raised guideline 1.2 for player names alone; here the words themselves are written by
players too.

- **Three lists exist today, none of them right as they stand:**
  - `src/utils/blockedWords.ts` matches anywhere in a string, read both ways. That's right for random letters (filler, a scramble,
    a cipher) but would refuse CLASS, GRASS and SCRAP if used on written words.
  - Hangman-Scrapers' `scripts/contentFilter.ts` matches whole words (profanity and slurs, sexual words, drug words) after folding
    accents. That's the packs' own rule, and the right model for written words, but it lives in a Node script the app can't import.
  - Tastic-Server's `src/tags.ts` reads look-alikes (A55 is ASS) for leaderboard tags only. The server's player names have no
    filter at all: `checkName` in `src/matches.ts` only checks 1 to 24 characters.
- **The filter:** whole words, after folding accents and look-alikes (the tags table: 0 as O, 1 as I, 3 as E, 4 as A, 5 as S, 7 as T,
  8 as B, @ as A, $ as S, ! and | as I), against the scrapers' terms plus the slurs only `blockedWords.ts` has today (chink, coon,
  gook, kike, spic, dyke). Words run together are caught where the scrapers' patterns already allow it (`fuck\w*`).
- **Where it runs:** the composer checks as you type and keeps Send off with "Pick another word" (never saying which); the server
  checks every item and name again and refuses with a 400; a link (slice 0) is checked on the phone that opens it, and so is a
  `.hangman` pack file as it's imported (words that fail are left out, and the card says how many). The web build runs the same
  check, so a hand-made link can't put a slur on a page under games.infinitetoken.com.
- **It's a speed bump, not a wall.** Spaced-out letters or a clever spelling will get through some of the time. Report and Block
  (section 9) are what catch the rest.
- **Strictness (decision 11):** the packs' list as it is, drug words included, since the same children who play the packs would read
  what's sent.

The filter and the item checks live in a package both sides import (decision 3), the way HexFleet's rules are
`@tastic/hexfleet-engine` and CardTastic's are `@tastic/cardtastic-engine`: `AlphaTastic-Engine`, publishing
`@tastic/alphatastic-engine`. It holds the item types and `checkItem`, `normalizePhrase`, the per-game fit rules above (the checks,
not the board generators), the filter, the link encoding and `RULES_VERSION`. Hangman-Scrapers could import the filter too, so the
packs and the players share one list; that part is optional.

## 4. The server: a third kind of module

AlphaTastic plugs into Tastic-Server, not a new server. It keeps everything the server already does for players and adds what a
sent puzzle needs.

**Why not a match:** HexFleet's `TurnRules` (`src/games/types.ts`) almost fits a Hangman word (two seats, the guesser's one "plan"
being the result), but nearly everything around it is wrong for this:
- A match waits in a lobby until every person locks in (`canStart`, `seats.ready`), and is found by a code made for it
  (`matches.code` is required and unique), so every word would need a new code swapped.
- Every turn gets 72 hours and then the late seats forfeit (`TURN_HOURS`, server-wide in `src/matches.ts`), and the core words
  the pushes itself: "Turn 3 against Sam: your move.", "Defeat against Sam." (`turnPushes`).
- A pack has no result at all, and nobody wins or loses a puzzle someone made for them.

So AlphaTastic is a third kind of module beside `TurnRules` and `BoardRules` (decision 2):

```ts
interface SendRules<Item, Result> {
  game: string // 'alphatastic', the app's X-Game
  version: string // @tastic/alphatastic-engine's RULES_VERSION
  title: string // 'AlphaTastic', the pushes' title
  checkItem(input: unknown): Checked<Item> // shape, limits and the filter
  checkResult(item: Item, input: unknown): Checked<Result> // null for an item with no result (a pack)
  sentPush(item: Item, from: string): string // "Jay sent you a word to guess."
  resultPush(item: Item, result: Result, by: string): string // "Bob solved your word with 2 misses."
}
```

registered in a `SENDS` registry (`src/games/index.ts`) under the same `X-Game` lookup the gate does today
(`rules?.version ?? board?.version` gains a third term).

**What it reuses unchanged:** players with no sign-in and their JWTs, the version gate (426 for any other `X-Rules-Version`, no
compatibility code), the per-address rate limits, Expo pushes, `DELETE /players/me`, the deploy (one Elastic Beanstalk machine behind
Caddy at play.infinitetoken.com), the Supabase database and its migrations, and the hand-run admin script pattern
(`src/admin/deletePlayer.ts`).

**New, and server-wide** (HexFleet could use friends for "play again with Sam" without a new code):
- **Tables** (one migration, 008, with row level security on each, as 003 does for the rest):
  - `friends` (player, friend, since), one row each way.
  - `friend_invites` (code, from player, the item waiting on it if any, created, expires, used by).
  - `items` (id, game, from player, to player, the item as JSON, status sent/opened/done, result JSON, created, opened, done). The
    other side's id goes null when a player is deleted, so a friend's Sent list keeps the result as "Deleted player", the way match
    seats keep theirs now (`ON DELETE SET NULL`).
  - `blocks` (player, blocked, since).
  - `reports` (id, reporter, reported player, item, reason, a copy of what was reported, created, handled).
  - `players.banned_at`, for a player who may no longer send.
- **The API** (every route behind the gate and a token, like the rest):

  | Request | What it does |
  |---------|--------------|
  | `POST /friends/invites` `{ item? }` | A code, single use, 7 days, optionally carrying your first puzzle for whoever redeems it |
  | `GET /friends/invites/:code` | Who it's from and which game is waiting, never the puzzle itself |
  | `POST /friends/invites/:code/accept` | Makes you friends, and the waiting puzzle becomes theirs |
  | `GET /friends`, `DELETE /friends/:id` | Your friends (name, tag, color), and unfriending, which drops what's waiting between you |
  | `POST /items` `{ to, item }` | Sends a puzzle to one or more friends, each their own copy |
  | `GET /items` | What's waiting for you and what you sent, with statuses and results, newest first |
  | `POST /items/:id/open`, `POST /items/:id/result` | Marks it opened, then sends how it went (once) |
  | `DELETE /items/:id` | The sender unsends it before it's opened; the receiver clears it from their list |
  | `POST /blocks`, `DELETE /blocks/:id`, `GET /blocks` | Blocking a player, unblocking and listing them |
  | `POST /reports` `{ item?, player, reason }` | A report, which also hides the item from you |

- **Who judges a guess (decision 7):** the receiving phone plays the puzzle with the whole answer in hand, as Pass & Play does now,
  and sends the result. The server only checks the result's shape. Hiding the answer on the server would mean a round trip per
  letter for nothing: a friend who peeks only spoils their own puzzle, and nothing here is ranked.
- **Pushes:** "Jay sent you a word to guess.", "Jay made you a word search.", "Jay shared a pack: Dinosaurs.", "Bob solved your word
  with 2 misses.", "Bob found all 10 words in 3:12.", "Sam took your invite and has your word." Each module words its own, as
  HexFleet's does. Two small changes in `src/push.ts`: `deliver` takes a title and a game rather than an `AnyTurnRules`, and a
  push's `data` names an item as well as a match.
- **One phone, several profiles (a server change):** a player per profile (section 5) means several players on one phone with one
  push token, but `updatePlayer` moves a token to the newest player that sends it ("since it's one device"), so only the last
  profile would get pushes. The fix: the app sends an install id with its token (kept in the Keychain beside the players), and the
  token only moves away from players with another install id. HexFleet's one player per phone is unaffected.
- **Names:** `checkName` gains the filter, for every game's players.
- **No deadlines and no socket at first:** a puzzle waits until it's opened. The Friends screen fetches when it opens, when the app
  comes back to the foreground and when a push lands; a live `items:changed` event can come later through `src/realtime.ts`'
  `player:<id>` rooms.
- **Limits:** sends rate limited per player (say 60 an hour), at most 20 unopened items from one friend, the invite routes on the
  same 60-a-minute limit as match codes. A banned player can't send or make invites.
- **Deleting a player** (`deletePlayer`) also drops their friendships, blocks, invites and unopened items, and their side of opened
  ones. Their reports keep the copy of what was reported until it's handled (section 9).
- **Release order** is HexFleet's: deploy the server, then publish the app update straight after. A change to the item's shape is
  a new `RULES_VERSION`, and older apps get the 426 and "Update AlphaTastic to keep playing online".

## 5. Who's online: a player per profile, and the switch

- **A player per profile (decision 4).** Each profile with online on is its own server player, with the profile's name, tag and
  color (the server already keeps a tag and color per player for CardTastic's boards). Things sent to Kid go to Kid. HexFleet makes
  one player per phone; CardTastic's daily boards were planned with a player per profile (Tastic-Server's CLAUDE.md, Daily
  leaderboards). The Guest never goes online: a friend needs a name and a chip to know who you are, and the switch needs a
  profile to belong to.
- **Where tokens live:** the Keychain (`expo-secure-store`), one per profile id, as HexFleet keeps its one. In slice 1, before the
  native build, AsyncStorage, as HexFleet's slice 1 did. On the web, the site's storage.
- **The switch (decisions 5 and 6):** online on or off per profile, AlphaTastic's own, in `playerSettings` beside the profile's art,
  difficulty and packs. Off for every profile until someone turns it on, from the Profiles screen or the Friends screen, behind a
  confirm that says what it does ("Friends you swap a code with can send this profile puzzles"). Off hides the profile's inbox and
  stops its pushes (`PATCH /players/me { pushToken: null }`); its server player stays until Delete Online Data. A profile with online
  off can still sit at any table on this phone.
- **Renaming or recoloring a profile** updates its player (`PATCH /players/me`), so friends see the new name.
- **Deleting a profile** deletes its server player too: `usePlayerData`'s `forgetPlayer`, the one path for the Profiles screen's
  delete and the self-heal when another game deletes a profile, calls `DELETE /players/me` with that profile's token.

## 6. The Friends screen

- **Getting there:** Home has the trophy and the cog and nothing else (`@tastic/shell`'s `HomeScreen.tsx`), and `PackDefinition`
  has no field for another button. So the shell needs one (a release of `@tastic/shell`): a button of the pack's own in the corners'
  strip, between the trophy and the cog, like the setup page's Add player, with a count of what's waiting across this phone's online
  profiles. Shown only while some profile has online on (decision 8 covers the name).
- **The screen,** on the board like Stats, under the corners:
  - A profile picker at the top, only when more than one profile here has online on, opening on the active player if theirs is on.
  - **Waiting for you:** each row the friend's chip and name, the game's icon and what it is ("A word to guess", "A word search: Our
    Garden", "A pack: Dinosaurs, 24 words"). A tap opens that game's board; a pack opens the same preview card as a `.hangman`
    file ("Add to My Packs").
  - **Friends:** your friends' chips, and Add a Friend: Share a Link, or Have a Code? with a Paste button (HexFleet's
    `ClipboardPasteButton`, which takes a code or a whole link).
  - **Sent:** what you sent, newest first, with where it stands: "Waiting for Bob", "Bob is playing", "Bob solved it with 2
    misses", "Bob missed it", "Bob added it to their packs". A blocked or reported send just stays at "Waiting", so nobody learns
    they were reported.
  - Every received row and friend has a menu with Report and Block (section 9).
- **Playing a received puzzle:**
  - Hangman: the board with the sender's art in your own colors, kept in its own slot in the round slice (by item id), so it never
    abandons your solo round or touches a Pass & Play session, and leaving keeps it for later like any board. When it's decided the
    result goes to the server and the card says "You solved Jay's word" with Back (to Friends) and Next (the next thing waiting, if
    any).
  - Word Search, Jumble and Cryptogram: their screens with the written puzzle in place of a pack draw. They don't save a game in
    progress today, so one left halfway waits to be played again from the start.
- **Stats (decision 14):** a received Hangman word counts in the receiver's Pass & Play record (it's a word a person wrote for them),
  and nothing counts for the sender. The puzzle games have no stats yet (`NoStats`).
- **Web:** the same screen in the browser at `/hangman/`, a player per profile in the site's storage, no pushes: it fetches when the
  tab comes back. That's what lets someone with no app take an invite (section 8).

## 7. Sending from the setup pages

**Hangman: a friend is a kind of seat.** The setup page is one page for one to eight seats now, with no 1 Player or Pass & Play
mode, so online doesn't add a mode either.
- A seat's picker gets a Friends section after the profiles: the friends of the table's online profile, then Invite a Friend. The
  picker is @tastic/profile's `ProfilePicker`, whose rows are a color section, Guest, the profiles and Manage, with no room for
  rows of an app's own, so @tastic/profile needs a release that takes extra rows.
- **The rule for now (decision 9):** a table with a friend seat has exactly one seat on this phone, a profile with online on (the
  sender), and any number of friend seats. Mixing a friend into a pass-and-play table of several people here is left for later:
  the session's standings and turns assume everyone is at this table.
- With a friend at the table, Write-In is the only source (the Packs | Write-In switch hides), and Ready becomes Send. The word
  prompt (`PnpWordPrompt`) opens over the setup page, titled "Your Word for Sam", with Keep This Word as today and Send in place of
  Next; with several friends seated its For row adds Everyone, and each gets their own copy. A toast says "Sent to Sam", and the page
  stays as it was for the next one.
- **Invite a Friend** makes the seat an invite seat ("New friend"). Send then writes the word and opens the share sheet with an
  invite link, the word waiting on the code: whoever opens it becomes your friend with your word already in their list (decision
  10). The invite is the first send.
- A seat holding a friend has no standing badge; how it went is on the Friends screen.

**Word Search, Jumble and Cryptogram: write your own.** Their setup page (`PuzzleLoadoutScreen`) draws every puzzle from a pack
today, with no way to write one.
- A source switch like Hangman's: From Packs | Write My Own. Write My Own opens a composer page (a `FullScreenLayer` like the pack
  editor) with the fields the game needs, checked live against the page's own settings: Word Search's title and words for the grid
  picked, Jumble's answers for the count and length picked, Cryptogram's phrase for the length picked, each with an optional hint.
- A For pill under the player picker: Me, your friends, or Invite a Friend, shown only with Write My Own and a profile with online
  on. Ready plays it yourself (handy to try it first) or reads Send.

**Packs:** a custom pack's editor page in Choose Packs, which already has Share (as a `.hangman` file), gets Send to a Friend beside
it (a friend picker, then Send). The pack arrives as a preview the friend adds or not. Custom packs are the phone's, not a player's
(`hangman:custom_packs_v1`, one key), so an added pack joins the phone's packs and the receiving player's selection, as a
`.hangman` import does now.

## 8. Invite links

HexFleet's setup, with AlphaTastic as a second game on it.

- **The link:** `https://games.infinitetoken.com/hangman/join/K7Q2PX`. The web path stays `/hangman` (the app's identity is still
  Hangman's, Jay's call), so it sits where the hub's other invites do (`invitePath`, Games-Web's `src/utils/appLinks.ts`).
- **The share:** "Jay sent you a puzzle in AlphaTastic. Code K7Q2PX" and the link. The message names the person, so the page
  can be the same for everyone.
- **The page,** on Games-Web, as HexFleet's: the code with Copy, Play in Your Browser (`/hangman/friends?code=K7Q2PX`), the store
  buttons, and Open in AlphaTastic (`hangman://join/K7Q2PX`). The same preview for every invite.
- **Tying the domain to the app:** AlphaTastic joins Games-Web's online games list (`OnlineGame` in `src/constants/site.ts`), from
  which the `apple-app-site-association` and `assetlinks.json` files are built (`appleAppSiteAssociation`, `assetLinks`): app ID
  `com.infinitetoken.Hangman` on both platforms (`app.json`). In the app: `ios.associatedDomains`, an Android intent filter
  (https, `games.infinitetoken.com`, `/hangman/join`, `autoVerify`) beside the file and content filters already there, and
  `+native-intent` turning `/hangman/join/<code>` into the app's own route, as it already keeps `file:` and `content:` URLs away
  from the router. All native config, so a native build you run.
- **After installing from the page:** iOS doesn't carry a link through an install, so with no friends yet the Friends screen leads
  with Have a Code?, and Paste takes the code or the whole link.
- **Making a profile on the way in:** someone taking an invite with no profile makes one there (a name and a color), with online
  turned on for it.
- **Slice 0's links** (`/hangman/play?...`) open the web build until the native build with the associated domain is out; the page
  offers Open in AlphaTastic (`hangman://play?...`) for someone who has the app.

## 9. Moderation (guideline 1.2), kept small

As I read 1.2, an app where people send each other content needs four things: a filter for objectionable material, a way to report
offensive content with timely responses, a way to block abusive users, and published contact details. The app-store-prep skill goes
through the guidelines properly when it's time, including whether App Review wants anything more (a terms screen, say).

- **Keep the surface small:** invite-only (nobody can reach you without a code or link you shared), no search, no public gallery of
  packs, no chat, short fields (128, 80 and 60 characters), and nothing anyone posts is shown to anyone but the friend it was sent to.
- **The filter** is section 3, on the phone and on the server, for words, hints, titles, pack names and names.
- **Report,** on every received puzzle (its row, and its board's corner while playing it) and on every friend: a reason (Offensive,
  Bullying, Something else) and Send. It hides the item at once and offers Block in the same card.
- **Where reports reach Jay (decision 12):** the server emails each one to support@infinitetoken.com as it comes in (Amazon SES in
  the same AWS account as the server), with what was reported, who sent it and who reported it. A hand-run admin script, like
  `src/admin/deletePlayer.ts`, removes an item and bans a player from sending (`players.banned_at`). "Timely" means Jay answers
  within a day or two; 1.2 gives no number.
- **Block:** unfriends, hides everything from them, and stops them becoming your friend again (their codes just say "This invite
  isn't available"). Unblock is in Settings' ONLINE section.
- **Contact:** the hub's support page (`games.infinitetoken.com/support`, already in `store.config.json`) and a Report a Problem
  row in Settings' ONLINE section.
- **Slice 0 is lighter but not empty:** the filter on both ends, and Report on an opened link puzzle as an email to support with the
  puzzle in it. There's no one to block, which is one reason not to build more on links than slice 0.

## 10. Apple's other rules and privacy

- **Account deletion (5.1.1(v)):** Delete Online Data in Settings' ONLINE section, for the active profile (`DELETE /players/me`),
  and deleting a profile does it too (section 5). Google Play's web route is Games-Web's `/delete-data/<slug>` page, which HexFleet
  already has, plus an AlphaTastic one; Tastic-Server's `deletePlayer.ts` handles those emails.
- **Sign-in rules (4.8):** don't apply, with no third-party sign-in.
- **Privacy:** the App Privacy answers change (an identifier, a push token, names, and the puzzles and packs people send, all linked
  to the player), and so does the hub's privacy policy (`games.infinitetoken.com/privacy`): what's sent, who sees it (only the friend
  it went to), how long reports are kept (until handled, then 30 days), and how to delete it all.
- **Age rating:** stays 13+ as far as content goes, since the filter holds sent words to the packs' rule. Re-answer the age rating
  questions with online in, and check whether any of them asks about content people share.
- **Export compliance:** unchanged (HTTPS through the OS, the Keychain's own encryption), as for HexFleet.

## 11. Keeping it out of the store release until it's ready

- **A build flag:** `EXPO_PUBLIC_ONLINE`, as HexFleet's slice 1 had. Off, there's no Friends button, no Send, no friend rows, and no
  push permission is asked.
- **Rollout (decision 13):** AlphaTastic's next store submission goes without online, so 1.2 isn't part of that review. Then the
  family and friends on TestFlight (the `preview` profile with the flag on, and the server's AlphaTastic module live), then on in
  production once Report, Block, the email and Delete Online Data are in. HexFleet ended up with online in every build (its decision
  6, 2026-11-17); AlphaTastic can do the same at that last step.
- **Both builds carry the same native modules** (expo-notifications, expo-secure-store, expo-clipboard), so they share one
  fingerprint, and OTA updates reach both.

## 12. Build order

**Slice 0, links** (an ordinary update, no server, no native build):
- `@tastic/alphatastic-engine` started: the item format, its checks, the filter and the link encoding (the item as JSON in one
  query parameter, so the answer isn't readable at a glance; not a secret).
- Write My Own for Word Search, Jumble and Cryptogram (their composers), and a Share Link button beside Ready for all four games.
- `/play` opening all four games, filtered, onto a board of its own that never abandons a round. The result card's Send Result.
- The filter on `.hangman` imports, and Report as an email on a link puzzle.

**Slice 1, done when two simulators send each other a word and see the result, through a locally run server:**
- Tastic-Server: `SendRules`, the `SENDS` registry and the gate, migration 008, friends and invites, items, the name filter.
- The app: the flag, a player per profile with the switch (tokens in AsyncStorage for now), the Friends screen (codes only, no
  links), friend seats and Send on the Hangman setup page, the For pill on the puzzle games', received puzzles on their boards.
- No pushes, so no new native modules yet.

**Slice 2, everything friends outside the family need** (one native build by you):
- Pushes (with the install id change in `updatePlayer`), the Keychain, invite links in the app, Have a Code? with Paste.
- Report, Block and the report emails (SES set up and out of its sandbox), the admin script, Delete Online Data.
- Send to a Friend for packs, Invite a Friend as the first send.
- Releases of @tastic/shell (the Home button) and @tastic/profile (the picker's extra rows).

**Slice 3, out to friends:** the server released (a Tastic-Server tag deploys it), Games-Web released with the invite page and
AlphaTastic in its association files (before the TestFlight build, so the files are live when friends install), the App Privacy
answers and the privacy policy, then the TestFlight build you run and submit.

**Later:** a friend seat at a pass-and-play table, sending a puzzle straight from the packs ("send this one to Sam" after solving
it), saving a puzzle game halfway, live updates over the socket, pushes on the web, stats and achievements for sending, and one
online switch for the whole fleet.

## Decisions

All still defaults, until Jay says otherwise:

1. **Links first.** Default: slice 0 is links alone (no server), then the server for the Friends screen, results and history.
   The other way: straight to the server, skipping links. Links cost little, keep working afterwards for people without online, and
   everything they need (the item format, the filter, the composers, the separate board) the server version needs too.
2. **How AlphaTastic plugs into Tastic-Server.** Default: a third kind of module, `SendRules`, with friends, items, blocks and reports
   added to the server. The other way: each puzzle as a two-seat HexFleet-style match, which brings a lobby, a code per puzzle,
   72-hour forfeits and turn-worded pushes, and has nothing for packs.
3. **A package for the shared rules.** Default: `AlphaTastic-Engine`, publishing `@tastic/alphatastic-engine` (the item checks, the
   filter, the link encoding, `RULES_VERSION`), a private repo like `HexFleet-Engine`. The other way: copy the checks into the
   server, which then drifts from the app's.
4. **Who a player is online.** Default: one server player per profile with online on; the Guest never goes online. The other way:
   one player per phone like HexFleet's, where everything sent to the phone shows for whoever's holding it.
5. **The kids' switch.** Default: a plain switch per profile, off until turned on, behind a confirm that says what it does. Your kids'
   profiles stay off. The other way: a parent's PIN to turn it on, if a kid flipping it themselves is a worry.
6. **Where the switch lives.** Default: AlphaTastic's own, in `playerSettings`. The other way: a field on the fleet's shared roster
   (a @tastic/profile release), so one switch also turns off HexFleet's online for a kid. Worth doing once a second game needs it.
7. **Who judges a guess.** Default: the receiving phone plays with the answer in hand and reports the result. The other way: the
   server judges each guess, a round trip per letter, to stop a peek that only spoils the peeker's own puzzle.
8. **The screen's name and way in.** Default: Friends, as a button between Home's trophy and cog with a count of what's waiting (a
   @tastic/shell release). The other way: Online, HexFleet's word.
9. **Friend seats.** Default: a table with a friend seat has one seat on this phone (an online profile) and any number of friends.
   The other way: friends mixed into a pass-and-play table, left for later.
10. **Invite codes.** Default: single use, good for 7 days, carrying your first puzzle, so the invite is the first send. The other
    way: one standing friend code per profile, which anyone who sees it could use.
11. **How strict the filter is.** Default: the packs' own list (profanity, slurs, sexual words, drug words), whole words with
    look-alikes read as letters, for everything written including names. The other way: profanity and slurs only, letting drug words
    through as the packs' 13+ titles do.
12. **Where reports go.** Default: an email per report to support@infinitetoken.com through Amazon SES, plus a hand-run script to
    remove an item or ban a sender. The other way: a table you check with a script, which is cheaper but only as timely as you
    remember to run it.
13. **Rollout.** Default: AlphaTastic's next store submission without online (the `EXPO_PUBLIC_ONLINE` flag off), TestFlight for the
    family and friends, then on in production once slice 2 is done. The other way: online in every build from the start, as HexFleet
    ended up, with 1.2's pieces in the first submission.
14. **Stats.** Default: a received Hangman word counts in the receiver's Pass & Play record and nothing counts for the sender; the
    puzzle games wait for their own stats. The other way: an Online record of its own.
15. **Limits.** Default: a sent pack up to 200 words, at most 20 unopened puzzles from one friend, 60 sends an hour, and no expiry
    (the sender can unsend until it's opened).
16. **The link format in slice 0.** Default: the item as encoded JSON in one parameter, in place of today's `?phrase=&hint=&mode=`,
    with no support for the old form. Nothing makes links in the old form today (`buildPuzzleLink` has no caller, and the old
    `hangman.infinitetoken.com` links stopped resolving on 2026-10-22), so nothing out there would break. Raised here because keeping
    old links working would be backwards compatibility, which is your call.
