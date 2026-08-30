import Foundation
import SwiftData

/// One step in an assignment's optional to-do list.
@Model
final class ChecklistItem {
    var text: String = ""
    var isDone: Bool = false
    /// Explicit ordering — SwiftData relationships come back unordered.
    var order: Int = 0
    var assignment: Assignment?

    init(text: String, isDone: Bool = false, order: Int) {
        self.text = text
        self.isDone = isDone
        self.order = order
    }
}
