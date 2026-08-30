import SwiftUI
import SwiftData
import UniformTypeIdentifiers

/// Add or edit an exam. Presented as a sheet.
struct ExamFormView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss

    @Query(filter: #Predicate<Subject> { $0.isActive },
           sort: \Subject.name) private var subjects: [Subject]

    private let existing: Exam?

    @State private var title: String
    @State private var notes: [DraftNote]
    @State private var editingNote: DraftNote?
    @State private var importingNote = false
    @State private var importError: String?
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

                Section {
                    ForEach(notes) { note in
                        Button { editingNote = note } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(NoteText.title(of: note.text))
                                    .font(.body)
                                    .foregroundStyle(.primary)
                                    .lineLimit(1)
                                Text(NoteText.preview(of: note.text))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                        }
                    }
                    .onDelete { notes.remove(atOffsets: $0) }

                    Button {
                        let note = DraftNote(text: "")
                        notes.append(note)
                        editingNote = note
                    } label: {
                        Label("Add Note", systemImage: "square.and.pencil")
                    }

                    Button {
                        importingNote = true
                    } label: {
                        Label("Import .md File…", systemImage: "square.and.arrow.down")
                    }
                } header: {
                    Text("Study material")
                } footer: {
                    Text(notes.isEmpty
                         ? "Add as many notes as you like — one per topic, chapter, or worksheet."
                         : "Tap a note to edit it, swipe to delete.")
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
            // Closing the editor on an untouched note discards it, so tapping
            // "Add Note" and backing out doesn't leave an empty row behind.
            .sheet(item: $editingNote, onDismiss: discardEmptyNotes) { note in
                StudyNoteEditorView(text: binding(for: note))
            }
            // Importing straight into a new note, so you don't have to create
            // an empty one first.
            .fileImporter(isPresented: $importingNote,
                          allowedContentTypes: [.markdownText, .plainText, .text]) { result in
                importNote(result)
            }
            .alert("Couldn't Import File",
                   isPresented: Binding(get: { importError != nil },
                                        set: { if !$0 { importError = nil } })) {
                Button("OK", role: .cancel) { importError = nil }
            } message: {
                Text(importError ?? "")
            }
        }
    }

    private func importNote(_ result: Result<URL, Error>) {
        do {
            let url = try result.get()
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }

            let contents = try String(contentsOf: url, encoding: .utf8)
            guard !contents.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                importError = "That file is empty."
                return
            }
            // Fall back to the filename as a heading if the file has no title.
            let hasHeading = contents.trimmingCharacters(in: .whitespacesAndNewlines)
                .hasPrefix("#")
            let name = url.deletingPathExtension().lastPathComponent
            let text = hasHeading ? contents : "# \(name)\n\n\(contents)"
            withAnimation { notes.append(DraftNote(text: text)) }
        } catch {
            importError = error.localizedDescription
        }
    }

    /// Bridges a `DraftNote` back to its slot in `notes` so the editor writes through.
    private func binding(for note: DraftNote) -> Binding<String> {
        guard let index = notes.firstIndex(where: { $0.id == note.id }) else {
            return .constant(note.text)
        }
        return $notes[index].text
    }

    private func discardEmptyNotes() {
        notes.removeAll { $0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
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
