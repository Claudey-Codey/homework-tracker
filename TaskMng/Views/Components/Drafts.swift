import Foundation

/// In-progress checklist step held by `AssignmentFormView` before it is
/// committed to a `ChecklistItem` on save.
struct DraftChecklistItem: Identifiable, Equatable {
    let id = UUID()
    var text: String
    var isDone: Bool
}

/// In-progress note held by `ExamFormView` or `AssignmentFormView` before it
/// is committed to a `StudyNote` on save.
struct DraftNote: Identifiable, Equatable {
    let id = UUID()
    var text: String
}

/// In-progress reminder held by the assignment and exam forms before it is
/// committed to a `Reminder` on save.
struct DraftReminder: Identifiable, Equatable {
    let id = UUID()
    var count: Int
    var unit: ReminderUnit

    /// Lead time in seconds — also what the list is sorted and de-duped by.
    var offset: TimeInterval { unit.offset(count: count) }

    /// "1 week before", "30 minutes before".
    var label: String { "\(count) \(unit.name(for: count)) before" }
}
