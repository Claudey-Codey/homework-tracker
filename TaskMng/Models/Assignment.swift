import Foundation
import SwiftData

@Model
final class Assignment {
    var title: String = ""
    var dueDate: Date = Date()
    /// When false, only the date matters (time is normalized to end of day).
    var hasTime: Bool = false
    var isDone: Bool = false
    var subject: Subject?

    /// Optional to-do list. Deleting the assignment takes its steps with it.
    @Relationship(deleteRule: .cascade, inverse: \ChecklistItem.assignment)
    var checklist: [ChecklistItem] = []

    /// Any number of lead times. Deleting the assignment takes them with it.
    @Relationship(deleteRule: .cascade, inverse: \Reminder.assignment)
    var reminders: [Reminder] = []

    /// Legacy single reminder. Kept only so assignments saved before multiple
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

    /// Furthest ahead of the due date first, which is also firing order.
    var sortedReminders: [Reminder] {
        reminders.sorted { $0.offset > $1.offset }
    }

    /// Every pending notification this assignment owns, legacy one included.
    var notificationIDs: [String] {
        (reminders.compactMap(\.notificationID) + [notificationID].compactMap { $0 })
    }

    var sortedChecklist: [ChecklistItem] {
        checklist.sorted { $0.order < $1.order }
    }

    var checklistDoneCount: Int {
        checklist.count { $0.isDone }
    }

    init(title: String, dueDate: Date, subject: Subject?) {
        self.title = title
        self.dueDate = dueDate
        self.subject = subject
        self.createdAt = Date()
    }
}
