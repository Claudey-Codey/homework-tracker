import SwiftUI
import SwiftData

/// Add or edit an exam. Presented as a sheet.
struct ExamFormView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @Query(filter: #Predicate<Subject> { $0.isActive },
           sort: \Subject.name) private var subjects: [Subject]

    private let existing: Exam?

    @State private var title: String
    @State private var notes: [DraftNote]
    @State private var images: [DraftImage]
    @State private var date: Date
    @State private var hasTime: Bool
    @State private var subject: Subject?
    @State private var reminders: [DraftReminder]

    init(exam: Exam? = nil) {
        self.existing = exam
        _title = State(initialValue: exam?.title ?? "")
        // Existing notes win; an exam saved before notes existed gets its old
        // single-blob study material folded in as the first note.
        let existingNotes = (exam?.sortedNotes ?? []).map { DraftNote(text: $0.text) }
        let legacy = (exam?.studyMaterial ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if existingNotes.isEmpty && !legacy.isEmpty {
            _notes = State(initialValue: [DraftNote(text: legacy)])
        } else {
            _notes = State(initialValue: existingNotes)
        }
        _images = State(initialValue: (exam?.sortedImages ?? []).map { DraftImage($0) })
        _date = State(initialValue: exam?.date ?? Self.defaultExamDate())
        _hasTime = State(initialValue: exam?.hasTime ?? false)
        _subject = State(initialValue: exam?.subject)
        // Saved reminders win; an exam from before multiple reminders existed
        // gets its single lead time folded in as the first one.
        let savedReminders = (exam?.sortedReminders ?? []).map {
            DraftReminder(count: $0.count, unit: $0.unit)
        }
        if savedReminders.isEmpty, let exam, exam.reminderEnabled {
            _reminders = State(initialValue: [
                DraftReminder(count: exam.reminderCount, unit: exam.reminderUnit)
            ])
        } else {
            _reminders = State(initialValue: savedReminders)
        }
    }

    private var canSave: Bool {
        subject != nil || !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Exam") {
                    TextField("Title (optional)", text: $title)

                    if subjects.isEmpty {
                        Text("No subjects yet. Add them in the Subjects tab.")
                            .foregroundStyle(.secondary)
                    } else {
                        Picker("Subject", selection: $subject) {
                            Text("None").tag(Subject?.none)
                            ForEach(subjects) { Text($0.name).tag(Subject?.some($0)) }
                        }
                    }

                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    Toggle("Set a time", isOn: $hasTime.animation())
                    if hasTime {
                        DatePicker("Time", selection: $date, displayedComponents: .hourAndMinute)
                    }
                }

                NotesSection(
                    header: "Study material",
                    emptyFooter: "Add as many notes as you like — one per topic, chapter, or worksheet.",
                    notes: $notes,
                    images: $images)

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
            .navigationTitle(existing == nil ? "New Exam" : "Edit Exam")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }.disabled(!canSave)
                }
            }
        }
    }

    private func save() {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let finalDate = hasTime ? date : Self.endOfDay(date)

        let exam: Exam
        if let existing {
            exam = existing
        } else {
            exam = Exam(title: trimmedTitle, date: finalDate, subject: subject)
            context.insert(exam)
            try? context.save()
        }
        exam.title = trimmedTitle
        exam.date = finalDate
        exam.hasTime = hasTime
        exam.subject = subject

        // Rebuild notes from the drafts, and retire the legacy blob now that
        // its content lives on as a note.
        for old in exam.notes { context.delete(old) }
        exam.notes = []
        for (index, draft) in notes.enumerated() {
            let text = draft.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { continue }
            let note = StudyNote(text: text, order: index)
            note.exam = exam
            context.insert(note)
        }
        exam.studyMaterial = ""

        // Images are kept rather than rebuilt, so their bytes aren't rewritten
        // on every save.
        context.commitImages(images, replacing: exam.images) { $0.exam = exam }

        // Cancel every pending notification, then rebuild the reminders from
        // the drafts the same way the notes are rebuilt above.
        NotificationManager.shared.cancel(ids: exam.notificationIDs)
        for old in exam.reminders { context.delete(old) }
        exam.reminders = []
        exam.notificationID = nil
        // Retire the legacy fields now that their lead time lives on as a row,
        // so an empty list doesn't get re-seeded next time this opens.
        exam.reminderEnabled = !reminders.isEmpty
        exam.reminderOffset = reminders.map(\.offset).max() ?? 0

        let name = trimmedTitle.isEmpty ? (subject?.name ?? "Exam") : trimmedTitle
        let topics = notes
            .map { NoteText.title(of: $0.text) }
            .filter { $0 != "New Note" }
        let body = topics.isEmpty
            ? "\(name) exam is coming up."
            : "\(name) exam. Study: \(topics.joined(separator: ", "))"

        for draft in reminders {
            let reminder = Reminder(count: draft.count, unit: draft.unit)
            reminder.exam = exam
            context.insert(reminder)

            let fireDate = finalDate.addingTimeInterval(-draft.offset)
            guard fireDate > Date() else { continue }
            // The id is minted here rather than awaited back, so the reminder
            // knows what to cancel even before the request is registered.
            let id = UUID().uuidString
            reminder.notificationID = id
            Task {
                await NotificationManager.shared.schedule(
                    title: "Exam in \(draft.count) \(draft.unit.name(for: draft.count))",
                    body: body, at: fireDate, id: id)
            }
        }
        dismiss()
    }

    private static func defaultExamDate() -> Date {
        let calendar = Calendar.current
        let inAWeek = calendar.date(byAdding: .day, value: 7, to: Date()) ?? Date()
        return calendar.startOfDay(for: inAWeek)
    }

    private static func endOfDay(_ date: Date) -> Date {
        Calendar.current.date(bySettingHour: 23, minute: 59, second: 0, of: date) ?? date
    }
}
