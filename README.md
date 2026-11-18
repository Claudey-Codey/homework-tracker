# TaskMng — School Assignment & Exam Manager

A native SwiftUI + SwiftData iOS app to track assignments, homework, and exams.

> **There's also a web version** in [`web/`](web/README.md). It has the same
> design and features, and installs on an iPhone from Safari (Add to Home
> Screen) with no Mac or Apple account needed.

## Features
- **Assignments** dashboard — all homework + projects, grouped Overdue / This Week / Later, sortable, searchable.
- **Homework** dashboard — homework only.
- **Exams** dashboard — each exam has a date, subject, and study-material notes.
- **Attachments** — one **Add…** menu for an assignment's content or an exam's study material: write a note, scan a worksheet into a PDF, take a photo, pick from Photos, or choose files (images and PDFs are attached, `.md`/`.txt` files become notes). Swipe to rename or delete, touch and hold to reorder; tap one to view it, share it to open in Books or save to Files.
- **Subjects** — add the subjects you're taking, give each a color, toggle them on/off.
- **+ to add** everywhere, with due date, type (homework/project), and subject pickers.
- **Reminders** — optional local notifications before a due date or exam.
- Native look: system components, SF Symbols, Dark Mode + Dynamic Type, swipe to delete, tap to edit.

## Requirements
- **Full Xcode** (free, Mac App Store). The Command Line Tools alone cannot build iOS apps.
- iOS **17+** (needed for SwiftData). An iPhone on iOS 17 or newer, or the Simulator.

---

## Getting it running

### Step 1 — Install Xcode
1. Mac App Store → search **Xcode** → **Install** (large download).
2. In Terminal: `sudo xcode-select -s /Applications/Xcode.app`
3. Open Xcode once and let it install additional components.

### Step 2 — Make the project
**Option A — manual (recommended for a first app, no extra tools):**
1. Xcode → **File ▸ New ▸ Project… ▸ iOS ▸ App** → Next.
2. Product Name: `TaskMng`. Interface: **SwiftUI**. Storage: **SwiftData**. Language: **Swift**.
3. Save it — you can save into `/Users/tuni/code/taskmng` (let it create its own subfolder, or point it here).
4. In Xcode's file navigator, **delete the template `ContentItem`/`Item.swift` and the default `ContentView.swift`** (Move to Trash).
5. **Drag the `TaskMng/` source folders** from this project (Models, Views, Support, `TaskMngApp.swift`) into the Xcode project navigator. When prompted, check **"Copy items if needed"** and **"Create groups"**, and make sure the **TaskMng target** is checked.
6. If Xcode's template also generated its own `TaskMngApp.swift`, keep only one `@main` (delete the template's, keep the one from this repo).
7. Set the deployment target to **iOS 17.0** (project ▸ target ▸ General ▸ Minimum Deployments).
8. Let the app use the camera (for scanning and photos): project ▸ target ▸ **Info** ▸ hover any row ▸ **+** ▸ choose **Privacy - Camera Usage Description**, and set it to *Scan worksheets and take photos to attach to assignments and exams.* Without it the app closes when you tap Scan Document or Take Photo.

**Option B — generate the project with XcodeGen (one command):**
```bash
brew install xcodegen
cd /Users/tuni/code/taskmng
xcodegen generate
open TaskMng.xcodeproj
```
(`project.yml` in this folder configures it.)

### Step 3 — Run in the Simulator
Pick an iPhone simulator in the toolbar and press **⌘R**. Try it: add a subject, then an assignment, then an exam.

### Step 4 — Run on your own iPhone (free Apple ID)
1. On the iPhone: **Settings ▸ Privacy & Security ▸ Developer Mode** → On (it restarts).
2. Plug the iPhone into the Mac; trust the computer.
3. In Xcode: project ▸ target ▸ **Signing & Capabilities** → check **Automatically manage signing** → **Team** → *Add an Account…* and sign in with your Apple ID (this creates a free **Personal Team**).
4. If signing complains about the bundle ID, change it to something unique like `com.yourname.TaskMng`.
5. Select your iPhone as the run destination → **⌘R**.
6. On the iPhone: **Settings ▸ General ▸ VPN & Device Management** → trust your developer profile.

> **Free-account note:** apps signed this way **stop opening after 7 days** — just re-run from Xcode to refresh them. Removing that limit (and TestFlight / the App Store) needs the **Apple Developer Program, $99/year** — not required for personal use.

---

## Project structure
```
TaskMng/
  TaskMngApp.swift              @main App + SwiftData container
  Models/
    Subject.swift              Subject (name, color, isActive)
    Assignment.swift           Assignment + AssignmentType enum
    Exam.swift                 Exam (title, study material, date)
  Views/
    RootTabView.swift          4-tab layout, asks for notification permission
    Assignments/
      AssignmentsView.swift    All-assignments dashboard + reusable list core
      HomeworkView.swift       Homework-only dashboard
      AssignmentRow.swift      A single assignment row
      AssignmentFormView.swift Add/edit sheet
    Exams/
      ExamsView.swift          Exams dashboard + row
      ExamFormView.swift       Add/edit sheet
    Subjects/
      SubjectsView.swift       Manage subjects + add/edit sheet
  Support/
    NotificationManager.swift  Local reminders + ReminderLead options
    Color+Hex.swift            Hex→Color + subject color palette
    DueDateUrgency.swift       Grouping + urgency colors
```

## Notes
- The all-assignments dashboard shows homework **and** projects; **exams are a separate tab**.
- If your iPhone is on iOS < 17, SwiftData isn't available — tell your helper and it can be swapped for Core Data.
