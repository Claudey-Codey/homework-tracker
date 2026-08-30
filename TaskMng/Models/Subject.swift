import Foundation
import SwiftData

/// A school subject the student is (or isn't currently) taking.
/// Only `isActive` subjects appear in the assignment / exam pickers.
@Model
final class Subject {
    var name: String = ""
    var isActive: Bool = true
    var colorHex: String = "#007AFF"
    var createdAt: Date = Date()

    // Deleting a subject nullifies the link on its assignments/exams
    // rather than deleting them.
    @Relationship(deleteRule: .nullify, inverse: \Assignment.subject)
    var assignments: [Assignment] = []

    @Relationship(deleteRule: .nullify, inverse: \Exam.subject)
    var exams: [Exam] = []

    init(name: String, isActive: Bool = true, colorHex: String = "#007AFF") {
        self.name = name
        self.isActive = isActive
        self.colorHex = colorHex
        self.createdAt = Date()
    }
}
