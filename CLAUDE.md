# TaskMng

A school assignment and exam tracker, built twice with the same design and
features:

- `web/`: React 18 + TypeScript + Vite, data in IndexedDB through Dexie. It
  installs on an iPhone from Safari (Add to Home Screen). Pushing `web/**` to
  `main` deploys it to GitHub Pages (`.github/workflows/deploy-web.yml`).
- `TaskMng/`: the native SwiftUI + SwiftData iOS app (iOS 17+), set up with
  `project.yml` (XcodeGen) or by hand as described in `README.md`.

## Current focus: the web app only

Make changes in `web/` only. Don't edit `TaskMng/` unless the user asks to
update the iOS app.

Every user-facing change to the web app goes in the **iOS backlog** below, in
the same commit, so the iOS app can be brought up to date later without
reading old diffs. Write each entry so it can be ported without opening the
web code: what it does, the edge cases, the exact wording, and which Swift
files it touches.

## Updating the iOS app

When the user asks to update the iOS app:

1. Work through the backlog from the top (oldest first). Port the behaviour,
   not the React code: use SwiftUI equivalents (`Menu`, `.swipeActions`,
   `.alert` with a `TextField`, `.fileImporter`, `PhotosPicker`, …).
2. Use the file map below to find the Swift counterpart of each web file.
3. The cloud container can't build Swift: there's no Xcode. Use only APIs
   available on iOS 17, re-read the code carefully, and tell the user that it
   wasn't compiled, so they build it in Xcode and try it on a device.
4. New `.swift` files appear automatically with `xcodegen generate`. People
   who made the Xcode project by hand must drag them in, so name every new
   file in your message to the user.
5. New permissions go in `project.yml` as `INFOPLIST_KEY_…` and in the
   README's manual setup steps.
6. Remove each entry from the backlog once it's ported, in the same commit.

### File map (web → iOS)

| Web (`web/src/`) | iOS (`TaskMng/`) |
|---|---|
| `db.ts` | `Models/*.swift`, `TaskMngApp.swift` |
| `views/NotesSection.tsx` | `Views/Components/NotesSection.swift` |
| `views/scanner/DocumentScanner.tsx`, `support/scan/*` | `Views/Components/CaptureViews.swift` (VisionKit's scanner) |
| `support/images.ts` (file sorting, names) | `Support/AttachmentImport.swift`, `Views/Components/Drafts.swift` |
| `views/assignments/AssignmentForm.tsx` | `Views/Assignments/AssignmentFormView.swift` |
| `views/exams/ExamForm.tsx` | `Views/Exams/ExamFormView.swift` |
| `views/assignments/*`, `views/exams/*` | `Views/Assignments/*`, `Views/Exams/*` |
| `views/subjects/*`, `views/account/*`, `views/settings/*` | `Views/Subjects/*`, `Views/Account/*`, `Views/Settings/*` |
| `views/ReminderEditor.tsx`, `support/reminders.ts` | `Views/Components/ReminderEditor.swift`, `Support/NotificationManager.swift` |
| `ui/*` (stand-ins for SwiftUI controls) | built-in SwiftUI views |
| `styles.css` (iOS look-alike tokens) | system styles |

## iOS backlog

Web changes the iOS app doesn't have yet, oldest first.

### 1. Check the attachment rework on a device

The one Add… menu, Scan Document, Take Photo, Choose File…, Paste Image,
rename and reorder were written for iOS (commit "Add files from one Add menu,
with scanning, drop, paste, rename and reorder") but never compiled. Build it
in Xcode and fix anything that doesn't compile or work. Check especially:

- that touch-and-hold reorders attachments in the form without an Edit button
  (`.onMove`);
- the two-line Scan Document and Choose File… items in the menu;
- the camera permission text, which comes from `project.yml`.

### 2. Restore a closed new form for 5 seconds

Web: `support/formDraft.ts`, `views/RestoredDraftBanner.tsx`, and their use in
`AssignmentForm.tsx` and `ExamForm.tsx`.

- When a **New** Assignment or **New** Exam form closes without saving (Cancel
  or swiping it down) and something was entered, keep everything in the form
  in memory: title, subject, due date and time, reminders, to-do steps
  including the half-typed "Add a step", notes, and attachments with their
  data. A form that still has only its default values isn't kept.
- If the same kind of form is opened again within **5 seconds** of closing, it
  opens with those values. After 5 seconds it opens empty.
- A restored form shows a row above the first section: secondary text
  "Restored your draft." with a small blue capsule button on the right
  (`.buttonStyle(.borderedProminent)`, `.buttonBorderShape(.capsule)`,
  `.controlSize(.small)`), labelled "Reset" with the `arrow.counterclockwise`
  symbol.
- The first change to any field hides that row for good. Closing again keeps
  the edited values, and reopening in time shows the row again.
- Reset empties the form back to its defaults and drops the kept values.
- Save drops the kept values. Edit forms (an existing assignment or exam)
  never keep or restore anything.
- Keep it in memory only, for example a small `@Observable` store or a static
  dictionary keyed "new-assignment" and "new-exam", with the time the form
  closed. Write to it in the form's `.onDisappear` unless the form was saved.
  Reset is easiest by giving the form a new `.id(UUID())` from its parent so
  every `@State` starts over.

### 3. Document scanner: match the scan's name

Web: `views/scanner/DocumentScanner.tsx`, `support/scan/*`.

The web app now has its own scanner, modelled on the one in Notes. iOS
already uses that very scanner (VisionKit's `VNDocumentCameraViewController`),
which does page detection, Auto capture, cropping and filters itself, so
there's nothing else to port. One difference to fix: the web names a scan
"Scan – Nov 18.pdf", and iOS names it "Scan – Nov 18". Add ".pdf" on iOS,
numbering a repeat as "Scan – Nov 18 (2).pdf" with the number before the
extension.

### 4. Exam rows: counts instead of note titles

Web: `ExamRow` in `views/exams/ExamsView.tsx`.

An exam's row in the Exams list no longer lists its study notes by title or
has separate "1 image" / "2 PDFs" lines. Like an assignment's row, it shows
one line of counts: note icon and number, photo icon and number, PDF icon and
number, each only when there is at least one. iOS: change the exam row in
`Views/Exams/ExamsView.swift` to match the counts line in
`Views/Assignments/AssignmentRow.swift`.

### 5. Tabs go back to their first page

Web: `selectTab` in `App.tsx`, `popToRoot` in `ui/NavStack.tsx`.

- Tapping the tab you're already on goes back to that tab's first page with
  the usual Back animation, however many pages deep you are (Account → Edit
  Account → photo picker goes straight back to Account).
- Leaving a tab also sends it back to its first page, without animation, so
  returning to Account shows the Account page, not Edit Account or Settings.
- Only Account opens pages today, but this applies to every tab.
- iOS: give each tab's `NavigationStack` a `path` array, and select tabs
  through a custom `Binding` on `TabView`'s selection. When the new value
  equals the current one, empty that tab's path (inside `withAnimation`).
  Otherwise empty the path of the tab being left.

(The web also fixed a bug where swiping down a note opened from a New
Assignment or New Exam form closed the form too. SwiftUI's nested sheets
don't have that problem, so there's nothing to port.)

### 6. Exam score out of 100

Web: `Exam.score` and `examScore` in `db.ts`, `ExamForm.tsx` (`scoreInput`),
`ExamRow` in `views/exams/ExamsView.tsx`.

- An exam has an optional score out of 100: a whole number from 0 to 100.
  iOS: add `var score: Int?` to the `Exam` model (optional, so existing
  stores migrate without a default). (On the web, exams saved during an
  earlier free-text version may hold a string; `examScore` reads "88" as 88
  and "18/20" as 90. iOS never had the free-text version, so it needs none
  of that.)
- New and Edit Exam forms (`Views/Exams/ExamFormView.swift`) get a section
  between "Exam" and "Study material": header "Score", one row with a
  `TextField` (placeholder "e.g. 88", `.keyboardType(.numberPad)`) and
  secondary text "/ 100" on the right, and the footer "Out of 100. Shown on
  the exam in the Exams list. Leave it empty until you get your result."
- The field only takes digits: anything else is dropped, leading zeros are
  removed ("095" → "95"), and a keystroke that would make it more than 100 is
  ignored (typing "125" leaves "12"). Filter in `.onChange(of:)`.
- On Save an empty field stores `nil`, so clearing it removes the score.
- The score is part of a New Exam's 5-second draft (backlog item 2): it's
  kept and restored with the rest, and a form with only a score typed counts
  as not empty.
- In the Exams list (`Views/Exams/ExamsView.swift`), an exam with a score
  shows just the number (no "/100", no "Score:") on the right of the row
  between the title column and the date, vertically centred: 16 pt bold,
  monospaced digits, centred in a fixed 40 pt wide, 26 pt tall slot so one-,
  two- and three-digit scores line up. With no score nothing is shown.
- The score's colour depends on the score: 85–100 green (`.green`), 70–84
  orange (`.orange`), 0–69 red (`.red`). Web: `scoreColor` in
  `support/due.ts`; on iOS add `scoreColor(for:)` next to `urgencyColor` in
  `Support/DueDateUrgency.swift`.
- A perfect 100 also sits in a light green rounded rectangle filling that
  40 × 26 pt slot (corner radius 7, green at 18% opacity, like the subject
  capsule's tint). No other score has a background.
- SwiftUI: `Text("\(score)").font(.system(size: 16, weight:
  .bold)).monospacedDigit().foregroundStyle(scoreColor(for: score)).frame(width:
  40, height: 26).background(score == 100 ? Color.green.opacity(0.18) :
  .clear, in: RoundedRectangle(cornerRadius: 7))`, with
  `.accessibilityLabel("Score: \(score) out of 100")`.
- The date column on the right of an exam's row has a fixed minimum width
  (58 pt, right-aligned), so the scores line up in one column from
  row to row whatever the date's width: `.frame(minWidth: 58, alignment:
  .trailing)`.
- Backups include the score automatically, as part of the exam.

### 7. Past exams' dates are green

Web: `examDateColor` in `support/due.ts`, used by `ExamRow` in
`views/exams/ExamsView.tsx`.

- In the Exams list, an exam whose date has passed shows its date in green
  (`.green`) instead of red: a past exam is done, not overdue.
- Before that nothing changes: orange within two days, primary colour
  otherwise. An exam without a time is stored at the end of its day, so it
  turns green the day after.
- Once an exam has a score (backlog item 6), its date is secondary grey
  (`.secondary`) whatever the date, so the score's colour is the only colour
  on the row. Without a score the rules above apply.
- Assignments are unchanged: overdue ones stay red.
- iOS: add `examDateColor(for:hasScore:now:)` next to `urgencyColor` in
  `Support/DueDateUrgency.swift` (`.secondary` when it has a score, green
  when `date < now`, else `urgencyColor(for: date, isDone: false, now:
  now)`), and use it for the date in `Views/Exams/ExamsView.swift` (line
  with `urgencyColor(for: exam.date, isDone: false)`), passing
  `exam.score != nil`.

### 8. Custom subject colour

Web: `CustomSwatch` in `ui/Swatches.tsx` (`allowsCustom`), used by
`SubjectForm` in `views/subjects/SubjectsView.tsx`.

- New and Edit Subject keep all 11 palette colours and add a 12th circle at
  the end of the Color grid: a colour wheel (rainbow). Tapping it opens the
  system colour picker; the colour chosen there becomes the subject's colour.
- While the subject's colour isn't one of the palette colours, the rainbow
  circle is the selected one: a rainbow ring around a smaller circle of the
  chosen colour, with the white checkmark. Picking a palette colour again
  moves the selection back to that colour.
- An existing subject whose colour isn't in the palette opens with the
  rainbow circle selected.
- Stored like any other colour: `colorHex` as "#RRGGBB", upper case, no
  opacity.
- iOS (`Views/Subjects/SubjectsView.swift`): after the `ForEach` in the
  Color grid, add `ColorPicker("Custom color", selection:,
  supportsOpacity: false).labelsHidden()` (it draws the rainbow circle and
  presents the picker itself), bound to a `Binding<Color>` that reads
  `Color(hex: colorHex)` and writes back a hex string. Add the Color → hex
  conversion to `Support/Color+Hex.swift` (via `UIColor(color).getRed(…)`).
  Show the chosen colour and checkmark over it when `colorHex` isn't in
  `SubjectPalette.colors`, letting taps through (`.allowsHitTesting(false)`).

### 9. Hebrew and English text both start on the left

Web: the `[dir="auto"]` and `.navbar-title` rules in `styles.css`, and
`AutoDirection` in `views/exams/StudyNoteEditor.tsx`.

- Every piece of text the user types starts on the left, whatever its
  language, like Google Docs: titles and subjects in the lists, text fields,
  and every line of a note. Before, Hebrew lines sat on the right.
- The letters and punctuation must still read correctly: each line keeps its
  own reading direction (taken from its first letter), so "מלכים פרק א' + פרק
  ג'" keeps its apostrophes and plus in place; only the alignment changes.
- In notes, bullets, numbers and the quote bar always sit on the left, even on
  a Hebrew line.
- Titles that are centred (navigation bar, alerts) stay centred, but a Hebrew
  title keeps its own reading direction there too, so the apostrophe at the
  end of "סיכום פרק א'" doesn't jump to the wrong side.
- iOS: in `Support/MarkdownStyler.swift`, `paragraphStyle(for:)` sets
  `alignment = .natural` ("Hebrew right, English left"). Change it to
  `.left`, keep `baseWritingDirection = .natural` for body and headings, and
  use `.leftToRight` for `.bullet`, `.numbered` and `.quote` so the "• "
  glyph and number stay on the left. Elsewhere SwiftUI's `Text` and
  `TextField` already follow the layout direction (left in an English UI);
  check on a device that Hebrew titles in the Assignments and Exams rows,
  the subject list and the form fields start on the left, and add
  `.multilineTextAlignment(.leading)` and `.frame(maxWidth: .infinity,
  alignment: .leading)` where one doesn't.

### 10. Subjects moves from the tab bar into Account

Web: `App.tsx`, `views/account/AccountView.tsx`,
`views/subjects/SubjectsView.tsx`, and the subject pickers in
`AssignmentForm.tsx` and `ExamForm.tsx`.

- The tab bar has three tabs: Assignments, Exams, Account. Subjects is no
  longer a tab. iOS: remove the `SubjectsView` tab from
  `Views/RootTabView.swift` and renumber the Account tag (and anything that
  selects it) from 3 to 2.
- Account's row of links is now Edit Account, **Subjects**, Settings, in that
  order, in the same section. Subjects uses the `books.vertical` symbol and
  pushes the Subjects page (`NavigationLink`, in
  `Views/Account/AccountView.swift`).
- The Subjects page (`Views/Subjects/SubjectsView.swift`) is pushed, so it
  loses its own `NavigationStack` and gets the usual Back button. Its Edit
  button moves to the trailing side, before +, since Back holds the leading
  spot. Everything else (large title "Subjects", the empty state, swipe to
  delete, toggles, add/edit sheet) is unchanged.
- In the New/Edit Assignment and Exam forms, the disabled row shown when
  there are no subjects now reads "No subjects yet. Add them in Account,
  under Subjects." (`AssignmentFormView.swift`, `ExamFormView.swift`).
- With item 5, leaving the Account tab also leaves the Subjects page, so
  coming back shows Account.

### 11. Tab switch animation

Web: `selectTab` in `App.tsx`, `.tab-pane.entering` and `.tab-highlight` in
`styles.css`.

- Switching tabs cross-fades the pages: the tab being opened fades in
  (0.22 s, ease-out) over the one being left, which stays still underneath.
- The tab bar's grey selected-tab highlight slides to the tapped tab (0.4 s
  spring) and swells slightly on the way, like iOS 26's tab bar but without
  the Liquid Glass lens. It doesn't swell when the app opens.
- The tab being left goes back to its first page (item 5) only after the
  fade, so it doesn't visibly jump during it. Tapping the tab you're on still
  pops to its first page with the Back animation and no fade.
- iOS: nothing to write. The system `TabView` already cross-fades tab
  content on iOS 18 and later and slides the selection on iOS 26; iOS 17
  switches instantly, which is fine. Don't add a custom tab bar for it. Check
  on a device that item 5's path reset doesn't show during the fade; if it
  does, empty the left tab's path after a short delay (about 0.25 s).

### 12. New app icon: the Toggle, with Dark and Tinted versions

Web: `web/scripts/icon.svg`, `icon-dark.svg`, `icon-tinted.svg`, rendered by
`web/scripts/render-icons.mjs`. The iOS files are ready in
`web/scripts/ios-app-icon/`.

- The icon is now an iPhone switch turned on, with a tick in its white knob:
  green track on a white-to-light-grey background. It replaces the blue
  checklist icon. The iOS app has no app icon yet (no asset catalog), so this
  is its first.
- iOS switches app icons with the Home Screen's appearance (Light, Dark,
  Tinted, iOS 18 and later; iOS 17 always shows Light). Web apps can't: the
  web only picks the dark Home Screen icon if the phone is in dark mode when
  it's added. The native app should get all three, like the Claude app:
  - `AppIcon.png`: Light, opaque, no alpha.
  - `AppIcon-Dark.png`: the same switch in slightly brighter green, knob
    `#F2F2F7`, on a clear background. iOS draws its dark background behind it.
  - `AppIcon-Tinted.png`: greys on a clear background (track and tick
    `#8A8A8A`, knob white). iOS turns them into the chosen tint colour, the
    knob being the brightest part.
- iOS: create `TaskMng/Assets.xcassets/` with a `Contents.json`
  (`{"info":{"author":"xcode","version":1}}`) and
  `AppIcon.appiconset/` holding the three PNGs and this `Contents.json`:
  ```json
  {
    "images" : [
      { "filename" : "AppIcon.png", "idiom" : "universal", "platform" : "ios", "size" : "1024x1024" },
      { "appearances" : [ { "appearance" : "luminosity", "value" : "dark" } ],
        "filename" : "AppIcon-Dark.png", "idiom" : "universal", "platform" : "ios", "size" : "1024x1024" },
      { "appearances" : [ { "appearance" : "luminosity", "value" : "tinted" } ],
        "filename" : "AppIcon-Tinted.png", "idiom" : "universal", "platform" : "ios", "size" : "1024x1024" }
    ],
    "info" : { "author" : "xcode", "version" : 1 }
  }
  ```
  Add `ASSETCATALOG_COMPILER_APPICON_NAME: AppIcon` to the settings in
  `project.yml`. In the README's manual setup, add a step to drag
  `Assets.xcassets` into the project (or, if Xcode made its own, drop the
  three PNGs into its AppIcon set and set Appearances to "Any, Dark,
  Tinted"). On a device, check all three in Home Screen ▸ Edit ▸ Customize.

### 13. Cat avatar preset

Web: `avatarPresets` in `support/account.ts`, image
`web/public/avatars/avatar-cat.png`.

- A 17th avatar preset, "Cat": the Aurora image (rainbow blur with the yellow
  and green circles) turned into a cat. The yellow circle is the head: two
  pointed ears on top and three whiskers out of each side, all in the same
  yellow. The green circle is the body: a thick tail in the same green rises
  from its right side and curls over at the top. Flat, no face, no shadow,
  like the circles.
- It comes second in the Presets grid, right after Aurora, labelled "Cat".
- iOS: copy `web/public/avatars/avatar-cat.png` (400 × 400) to
  `TaskMng/Resources/Avatars/`, and add `cat` after `aurora` in
  `AvatarPreset` in `Support/Account.swift`
  (`case aurora, cat, sunset, ocean, mint, confetti, violet`). People who made
  the Xcode project by hand must drag the new PNG into the project.

## Working on the web app

- Run commands in `web/`: `npm ci`, `npm run dev`, `npm run typecheck`, and
  `npm run build` (type check plus Vite build). There's no test runner; check
  changes in a browser with Playwright, which is pre-installed in the cloud
  container.
- `ui/` holds hand-built stand-ins for SwiftUI controls (`Sheet`, `List` and
  `Section`, `SwipeRow`, `Menu`, `Alert`, `Prompt`, …), named after their
  SwiftUI counterparts. Reuse them before adding new ones.
- Colours, sizes and fonts are the tokens at the top of `styles.css`, the
  Apple system colours for light and dark. Don't add one-off colours.
- Text fields' placeholders contain a zero-width space so Safari doesn't
  offer AutoFill. In Playwright, find them with a regex such as
  `getByPlaceholder(/itle \(optional/)` rather than the exact text.
- To try the scanner without a phone, give Chromium a fake camera:
  `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream
  --use-file-for-fake-video-capture=scene.y4m`, where `scene.y4m` is a video
  (YUV 4:2:0) of a page on a desk. Make the page with a real camera
  projection (a tilted A4 rectangle through a pinhole camera), not by placing
  corners by hand, or the straightened page's proportions can't be checked.
- Comments use `///` above declarations and explain why, in plain sentences.
