import Foundation
import SwiftData

@Model
final class Exam {
    var title: String = ""
    /// Legacy single-text study material. Kept only so existing exams can be
    /// folded into `notes` the first time they're opened; the UI uses `notes`.
    var studyMaterial: String = ""
    var date: Date = Date()
    /// When false, only the date matters (time is normalized to end of day).
    var hasTime: Bool = false
    var subject: Subject?

    /// Study notes, as many as you like. Deleting the exam deletes them too.
    @Relationship(deleteRule: .cascade, inverse: \StudyNote.exam)
    var notes: [StudyNote] = []

    /// Attached pictures. Deleting the exam deletes them too.
    @Relationship(deleteRule: .cascade, inverse: \ImageAttachment.exam)
    var images: [ImageAttachment] = []

    /// Any number of lead times. Deleting the exam takes them with it.
    @Relationship(deleteRule: .cascade, inverse: \Reminder.exam)
    var reminders: [Reminder] = []

    /// Legacy single reminder. Kept only so exams saved before multiple
    /// reminders existed can be folded into `reminders` when next opened.
    var reminderEnabled: Bool = false
    var reminderCount: Int = 1
    var reminderUnitRaw: String = ReminderUnit.days.rawValue
    var reminderOffset: TimeInterval = 0
    var notificationID: String?

    var createdAt: Date = Date()

    var reminderUnit: ReminderUnit {
        get { ReminderUnit(rawValue: reminderUnitRaw) ?? .days }
        set { reminderUnitRaw = newValue.rawValue }
    }

    /// Furthest ahead of the exam first, which is also firing order.
    var sortedReminders: [Reminder] {
        reminders.sorted { $0.offset > $1.offset }
    }

    /// Every pending notification this exam owns, legacy one included.
    var notificationIDs: [String] {
        (reminders.compactMap(\.notificationID) + [notificationID].compactMap { $0 })
    }

    var sortedNotes: [StudyNote] {
        notes.sorted { $0.order < $1.order }
    }

    var sortedImages: [ImageAttachment] {
        images.sorted { $0.order < $1.order }
    }

    init(title: String, date: Date, subject: Subject?) {
        self.title = title
        self.date = date
        self.subject = subject
        self.createdAt = Date()
    }
}
