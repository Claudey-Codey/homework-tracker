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
- Comments use `///` above declarations and explain why, in plain sentences.
