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
  shows just the number (no "/100", no "Score:") circled in red, like a mark
  on a test paper, on the right of the row between the title column and the
  date, vertically centred: a round 44 pt circle with a 2 pt red outline, the
  number red, bold, 17 pt (14 pt for 100, so three digits fit). SwiftUI:
  `Text("\(score)").font(.system(size: score == 100 ? 14 : 17, weight:
  .bold)).monospacedDigit().foregroundStyle(.red).frame(width: 44, height:
  44).overlay(Circle().stroke(.red, lineWidth: 2))`, with
  `.accessibilityLabel("Score: \(score) out of 100")`. With no score nothing
  is shown.
- Backups include the score automatically, as part of the exam.

### 7. Past exams' dates are green

Web: `examDateColor` in `support/due.ts`, used by `ExamRow` in
`views/exams/ExamsView.tsx`.

- In the Exams list, an exam whose date has passed shows its date in green
  (`.green`) instead of red: a past exam is done, not overdue.
- Before that nothing changes: orange within two days, primary colour
  otherwise. An exam without a time is stored at the end of its day, so it
  turns green the day after.
- Assignments are unchanged: overdue ones stay red.
- iOS: add `examDateColor(for:now:)` next to `urgencyColor` in
  `Support/DueDateUrgency.swift` (green when `date < now`, else
  `urgencyColor(for: date, isDone: false, now: now)`), and use it for the
  date in `Views/Exams/ExamsView.swift` (line with
  `urgencyColor(for: exam.date, isDone: false)`).

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
