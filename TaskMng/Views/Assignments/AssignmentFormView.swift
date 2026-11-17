import SwiftUI
import SwiftData

/// Add or edit an assignment. Presented as a sheet.
struct AssignmentFormView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @Query(filter: #Predicate<Subject> { $0.isActive },
           sort: \Subject.name) private var subjects: [Subject]

    private let existing: Assignment?

    @State private var title: String
    @State private var dueDate: Date
    @State private var hasTime: Bool
    @State private var subject: Subject?
    @State private var notes: [DraftNote]
    @State private var images: [DraftImage]
    @State private var reminders: [DraftReminder]
    /// Held as plain drafts rather than live `ChecklistItem`s so a brand-new
    /// assignment (not yet inserted) can have a list, and Cancel really cancels.
    @State private var checklist: [DraftChecklistItem]
    @State private var newStep = ""

    /// Which step field holds the cursor, so Return can move it down the list.
    private enum FocusTarget: Hashable {
        case step(UUID)
        case newStep
    }
    @FocusState private var focusedStep: FocusTarget?

    init(assignment: Assignment? = nil) {
        self.existing = assignment
        _title = State(initialValue: assignment?.title ?? "")
        _dueDate = State(initialValue: assignment?.dueDate ?? Self.defaultDueDate())
        _hasTime = State(initialValue: assignment?.hasTime ?? false)
        _subject = State(initialValue: assignment?.subject)
        _notes = State(initialValue: (assignment?.sortedNotes ?? []).map { DraftNote(text: $0.text) })
        _images = State(initialValue: (assignment?.sortedImages ?? []).map { DraftImage($0) })
        // Saved reminders win; an assignment from before multiple reminders
        // existed gets its single lead time folded in as the first one.
        let saved = (assignment?.sortedReminders ?? []).map {
            DraftReminder(count: $0.count, unit: $0.unit)
        }
        if saved.isEmpty, let assignment, assignment.reminderEnabled {
            _reminders = State(initialValue: [
                DraftReminder(count: assignment.reminderCount, unit: assignment.reminderUnit)
            ])
        } else {
            _reminders = State(initialValue: saved)
        }
        _checklist = State(initialValue: (assignment?.sortedChecklist ?? []).map {
            DraftChecklistItem(text: $0.text, isDone: $0.isDone)
        })
    }

    private var trimmedTitle: String {
        title.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Assignment name", text: $title)
                }

                Section("Subject") {
                    if subjects.isEmpty {
                        Text("No subjects yet. Add them in the Subjects tab.")
                            .foregroundStyle(.secondary)
                    } else {
                        Picker("Subject", selection: $subject) {
                            Text("None").tag(Subject?.none)
                            ForEach(subjects) { Text($0.name).tag(Subject?.some($0)) }
                        }
                    }
                }

                NotesSection(
                    header: "Content",
                    emptyFooter: "Optional. Write down what the assignment asks for, or anything you need to remember.",
                    notes: $notes,
                    images: $images)

                Section {
                    ForEach($checklist) { $item in
                        HStack(spacing: 12) {
                            CheckBox(isOn: item.isDone, size: .body) {
                                item.isDone.toggle()
                                // Was this the last one outstanding?
                                let others = checklist.filter { $0.id != item.id }
                                return item.isDone && others.allSatisfy(\.isDone)
                            }

                            TextField("Step", text: $item.text)
                                .focused($focusedStep, equals: .step(item.id))
                                .submitLabel(.next)
                                .onSubmit { advance(after: item.id) }
                                .strikethrough(item.isDone)
                                .foregroundStyle(item.isDone ? .secondary : .primary)
                        }
                    }
                    .onDelete { checklist.remove(atOffsets: $0) }

                    HStack(spacing: 12) {
                        Image(systemName: "plus.circle.fill")
                            .font(.body)
                            .foregroundStyle(.green)
                        TextField("Add a step", text: $newStep)
                            .focused($focusedStep, equals: .newStep)
                            .submitLabel(.next)
                            .onSubmit(addStepAndContinue)
                    }
                } header: {
                    Text("To-do list")
                } footer: {
                    if filledSteps.isEmpty {
                        Text("Optional. Break the assignment into steps and tick them off.")
                    } else {
                        Text("\(filledSteps.count { $0.isDone }) of \(filledSteps.count) done. Return starts the next step; swipe to delete.")
                    }
                }

                Section("Due") {
                    DatePicker("Due date", selection: $dueDate, displayedComponents: .date)
                    Toggle("Set a time", isOn: $hasTime.animation())
                    if hasTime {
                        DatePicker("Time", selection: $dueDate, displayedComponents: .hourAndMinute)
                    }
                }

                Section {
                    ReminderEditor(reminders: $reminders)
                } header: {
                    Text("Reminders")
                } footer: {
                    Text(reminders.isEmpty
                         ? "Optional. Add as many as you like — a week before, a day before, an hour before."
                         : "Tap one to change it, swipe to delete.")
                }
            }
            .navigationTitle(existing == nil ? "New Assignment" : "Edit Assignment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(trimmedTitle.isEmpty)
                }
            }
        }
    }

    /// Blank rows are scratch space while typing — they never count or save.
    private var filledSteps: [DraftChecklistItem] {
        checklist.filter { !isBlank($0.text) }
    }

    private func isBlank(_ text: String) -> Bool {
        text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    @discardableResult
    private func addStep() -> Bool {
        let trimmed = newStep.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        withAnimation {
            checklist.append(DraftChecklistItem(text: trimmed, isDone: false))
        }
        newStep = ""
        return true
    }

    /// Return inside a step drops the cursor into a fresh step below it, so a
    /// whole list can be typed straight through. Return on a blank step ends
    /// the run and clears the leftover row — the way Reminders behaves.
    private func advance(after id: UUID) {
        guard let index = checklist.firstIndex(where: { $0.id == id }) else { return }

        guard !isBlank(checklist[index].text) else {
            focusedStep = nil
            withAnimation { _ = checklist.remove(at: index) }
            return
        }

        // Don't stack blank rows if one is already waiting below.
        if index + 1 < checklist.count, isBlank(checklist[index + 1].text) {
            focus(.step(checklist[index + 1].id))
            return
        }

        let next = DraftChecklistItem(text: "", isDone: false)
        withAnimation { checklist.insert(next, at: index + 1) }
        focus(.step(next.id))
    }

    /// Return in the "add a step" field commits it and hands the cursor to a
    /// blank step, so typing can continue without tapping the field again.
    private func addStepAndContinue() {
        guard addStep() else {
            focusedStep = nil
            return
        }
        let next = DraftChecklistItem(text: "", isDone: false)
        checklist.append(next)
        focus(.step(next.id))
    }

    /// A row inserted in this update doesn't exist yet as far as focus is
    /// concerned — giving SwiftUI a tick to build it makes the jump land.
    private func focus(_ target: FocusTarget) {
        DispatchQueue.main.async { focusedStep = target }
    }

    private func save() {
        // Anything still sitting in the "add a step" field counts as added.
        addStep()

        let finalDate = hasTime ? dueDate : Self.endOfDay(dueDate)

        let assignment: Assignment
        if let existing {
            assignment = existing
        } else {
            assignment = Assignment(title: trimmedTitle,
                                    dueDate: finalDate, subject: subject)
            context.insert(assignment)
            try? context.save()
        }
        assignment.title = trimmedTitle
        assignment.dueDate = finalDate
        assignment.hasTime = hasTime
        assignment.subject = subject

        // Rebuild the checklist from the drafts. The lists are tiny, so
        // replacing wholesale beats diffing.
        for old in assignment.checklist { context.delete(old) }
        assignment.checklist = []
        for (index, draft) in checklist.enumerated() {
            let text = draft.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { continue }
            let item = ChecklistItem(text: text, isDone: draft.isDone, order: index)
            item.assignment = assignment
            context.insert(item)
        }

        // Notes are rebuilt from their drafts the same way.
        for old in assignment.notes { context.delete(old) }
        assignment.notes = []
        for (index, draft) in notes.enumerated() {
            let text = draft.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { continue }
            let note = StudyNote(text: text, order: index)
            note.assignment = assignment
            context.insert(note)
        }

        // Images are kept rather than rebuilt, so their bytes aren't rewritten
        // on every save.
        context.commitImages(images, replacing: assignment.images) { $0.assignment = assignment }

        // Cancel every pending notification, then rebuild the reminders from
        // the drafts the same way the checklist is rebuilt above.
        NotificationManager.shared.cancel(ids: assignment.notificationIDs)
        for old in assignment.reminders { context.delete(old) }
        assignment.reminders = []
        assignment.notificationID = nil
        // Retire the legacy fields now that their lead time lives on as a row,
        // so an empty list doesn't get re-seeded next time this opens.
        assignment.reminderEnabled = !reminders.isEmpty
        assignment.reminderOffset = reminders.map(\.offset).max() ?? 0

        let subjectName = subject?.name ?? "class"
        for draft in reminders {
            let reminder = Reminder(count: draft.count, unit: draft.unit)
            reminder.assignment = assignment
            context.insert(reminder)

            let fireDate = finalDate.addingTimeInterval(-draft.offset)
            guard fireDate > Date() else { continue }
            // The id is minted here rather than awaited back, so the reminder
            // knows what to cancel even before the request is registered.
            let id = UUID().uuidString
            reminder.notificationID = id
            let body = "\(trimmedTitle) for \(subjectName) is due in \(draft.count) \(draft.unit.name(for: draft.count))."
            Task {
                await NotificationManager.shared.schedule(
                    title: "Assignment due soon", body: body, at: fireDate, id: id)
            }
        }
        dismiss()
    }

    private static func defaultDueDate() -> Date {
        let calendar = Calendar.current
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: Date()) ?? Date()
        return calendar.startOfDay(for: tomorrow)
    }

    private static func endOfDay(_ date: Date) -> Date {
        Calendar.current.date(bySettingHour: 23, minute: 59, second: 0, of: date) ?? date
    }
}
