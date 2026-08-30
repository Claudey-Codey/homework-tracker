import Foundation
import SwiftData

/// One lead time before an assignment is due or an exam starts — "1 week
/// before", "30 minutes before". An item can carry as many as it likes, so
/// this is a model rather than fields on the parent.
///
/// The two parent links are both optional and only one is ever set: SwiftData
/// wants a concrete inverse for each relationship, and a shared reminder type
/// beats two near-identical ones.
@Model
final class Reminder {
    var count: Int = 1
    var unitRaw: String = ReminderUnit.days.rawValue
    /// The pending notification, so it can be cancelled when things change.
    var notificationID: String?

    var assignment: Assignment?
    var exam: Exam?

    var unit: ReminderUnit {
        get { ReminderUnit(rawValue: unitRaw) ?? .days }
        set { unitRaw = newValue.rawValue }
    }

    /// Lead time in seconds.
    var offset: TimeInterval { unit.offset(count: count) }

    init(count: Int, unit: ReminderUnit) {
        self.count = count
        self.unitRaw = unit.rawValue
    }
}
